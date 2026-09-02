# MI20 Arbo

SharePoint-hosted replacement of the Access **BASE ARBO MI20** IHM (version 1.6.6) for documentary production plans (**PPD**) and **bordereaux** (BX).

Inspired by that Access app. This is an independent work tool for the project team. It does **not** claim Bombardier, CAF, or RATP branding. Demo data is **synthetic**, not a production dump.

Source of truth for modules and mappings: [`docs/handoff/`](docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md). Screen checklist: [`docs/MODULES.md`](docs/MODULES.md).

## Temporary public demo (not Alstom production)

Shareable HTTPS test link (GitHub Pages, no Entra, no SharePoint):

**https://amineux.github.io/MI20-Arbo/**

Hash routes (`#/documents`, `#/import-ppd`, `#/bordereaux`) — GitHub Pages 404s path URLs.

**Parcours démo (3 clics)** on Accueil: Documents → Import PPD (charger `Import_Rapide_exemple.xlsx` + appliquer) → créer un bordereau.

In-browser demo (localStorage + official `fixtures/` via SheetJS). **Not** Alstom production — Azure + Entra + `BT_BTPIIMaroc-GestionDoc` ([`docs/DEPLOY_SHAREPOINT.md`](docs/DEPLOY_SHAREPOINT.md)).

Rebuild locally:

```bash
VITE_STATIC_DEMO=true VITE_BASE=/MI20-Arbo/ npm run build:pages
```

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (deploys on `main`).

## Architecture

```
SharePoint page
  └─ SPFx web part (iframe)  ──or──  Embed web part
        └─ React 18 + Fluent UI v9  (apps/web)
              └─ REST  /api/*
                    └─ Node 22 Fastify API  (apps/api)   ← equivalent of ASP.NET Minimal APIs
                          ├─ SQLite (demo) / Azure SQL script (docs/sql/azure.sql)
                          └─ FileStorage: local storage/  or Microsoft Graph (SharePoint library)
```

Why Node instead of ASP.NET Core 8: this environment and the SPFx toolchain are already Node/TypeScript. The API is a thin Fastify surface (Minimal API style). Domain rules live in `packages/domain` so PPD mapping is unit-tested without a web host. A future ASP.NET host can call the same rules if you port the package.

| Folder | Role |
|--------|------|
| `packages/domain` | PPD `import_columns` mapping, LIGNE parse, LDD `UCase(Trim(Nom))`, jalon unpivot, Excel I/O (SheetJS) |
| `apps/api` | Fastify + better-sqlite3 + import/export/bordereau/lookups |
| `apps/web` | Fluent UI v9 SPA (French labels) |
| `spfx/` | SPFx 1.18 web part that iframes the SPA |
| `docs/handoff/` | Access schemas, config `[PPD]`, column map |

## Local demo

Requires **Node 22**.

```bash
npm install
npm test          # domain unit tests + API PPD smoke
npm run dev       # API http://127.0.0.1:5080  +  web http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173** (Vite proxies `/api` to the API).

Demo walkthrough:

1. **Documents** — seeded synthetic livrables (clé `36 / 9351.3`, etc.).
2. **Import PPD** — default demo is official `fixtures/Import_Rapide_exemple.xlsx` (button *Charger Import_Rapide_exemple.xlsx*, mode rapide / `Nr Livrable`). Jalons-only: `Import_Rapide_Jalons.xlsx`. Full template: `PPD_Template.xlsx`.
3. Compare UI (écarts / nouveaux / erreurs lookup). Apply. Rows with LDD errors (e.g. unknown fournisseur) are skipped.
4. **Bordereaux** — create, attach documents, export pack `EXPORT_BX/MI20_BORD_<code>/`, download ZIP.
5. Files land under `storage/` (or `MI20_STORAGE_ROOT`).

Auth is **off** by default (`AUTH_DISABLED=true`). See Entra ID below for production.

Optional Docker (API + SQLite volume):

```bash
docker compose up --build
```

## SharePoint host (Alstom)

Teammates open a **site page** on this library, not Access.

| | |
|---|---|
| Site | [https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc](https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc) |
| Folder | `Shared Documents/Gestion Doc/MI20` |
| Embed page | `SitePages/MI20-Arbo.aspx` on that site |
| API env | `SHAREPOINT_SITE_URL` (that site) · `SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20` |

Step-by-step (Azure HTTPS + Entra for **alstomgroup.com**, `frame-ancestors` for `*.sharepoint.com`, **Embed** web part vs SPFx App Catalog, Graph root for `EXPORT_PPD` / `EXPORT_BX`): **[`docs/DEPLOY_SHAREPOINT.md`](docs/DEPLOY_SHAREPOINT.md)**.

SPFx package notes: [`spfx/README.md`](spfx/README.md). Tenant App Catalog often needs IT; the stock **Embed** web part pointing at the SPA URL does not.

## Entra ID (Azure AD) checklist

Register apps in the **alstomgroup.com** tenant (full Azure + consent steps: [`docs/DEPLOY_SHAREPOINT.md`](docs/DEPLOY_SHAREPOINT.md)).

1. App registration **SPA** (apps/web): redirect URI `https://<spa>/`, expose nothing (public client). Enable ID tokens if using MSAL popup/redirect.
2. App registration **API** (apps/api): expose scope `access_as_user` (`api://<api-id>/access_as_user`).
3. SPA registration → API permissions → that scope. Admin consent if required.
4. API env:

   ```
   AUTH_DISABLED=false
   AZURE_AD_TENANT_ID=<tenant>
   AZURE_AD_CLIENT_ID=<api-app-id>
   AZURE_AD_API_AUDIENCE=api://<api-app-id>
   AZURE_AD_API_SCOPE=api://<api-app-id>/access_as_user
   AZURE_AD_REDIRECT_URI=https://<spa>
   ```

5. SPA: `VITE_API_URL=https://<api>` and later wire `@azure/msal-browser` to attach Bearer tokens (config is already served at `GET /api/auth/config`). Demo skips MSAL when `authDisabled` is true.

## PPD rules implemented

From `docs/handoff/config.txt` `[PPD]` + `import_columns.csv`:

- First column `Num Liv.` (rapide: `Nr Livrable`)
- Jalons columns **44–66**, dates **67–89**, `nbJalonsPPD=23`
- Natures: `T`, `TITRE`, `LIGNE`, `LDD`, `LDDDomaineChargeur`, `OUINON`, `J`, `AUTORISANT`
- LIGNE → `GroupeLigne` + `IndiceLigne` (ex. `36 / 9351.3`)
- LDD match: `UCase(Trim(Nom))`
- Pipeline: Excel (SheetJS bulk, **not** Excel COM) → `import_raw` staging → user confirm → merge `document` + `programmation_jalon` (unpivot `Jalon_*_1..24`)
- Official files: `fixtures/` (see `fixtures/README.md`). Default smoke/demo import: **Import_Rapide_exemple.xlsx**. Export fills **PPD_Template.xlsx**. No live `EXPORT_PPD` dumps.
- Export: official template + RATP hide **C, AA, AB, AC**

## Bordereau rules

- Template file: official `fixtures/MI20_BORD_TEMPLATE_M5_V12.xls` (copied into the pack; SheetJS cannot parse the protected .xls)
- Output: `EXPORT_BX/MI20_BORD_<code>/`
- Entities: `bordereau` + `envoi`

## Data

SQLite schema mirrors Access tables in `docs/handoff/data_schema.txt` / `temp_schema.txt`. Azure SQL starter: `docs/sql/azure.sql`.

Seed: lookups + a few documents. **Not** the 31k production DB.

## License

MIT. See `LICENSE` and `NOTICE`.
