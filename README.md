# MI20 Arbo

SharePoint-hosted replacement of the Access **BASE ARBO MI20** IHM (version 1.6.6) for documentary production plans (**PPD**), **bordereaux** (BX) and **fiches d'avis** / retours RATP.

Inspired by that Access app. This is an independent work tool for the project team. It does **not** claim Bombardier, CAF, or RATP branding. Demo data is **synthetic**, not a production dump.

Source of truth for modules and mappings: [`docs/handoff/`](docs/handoff/TEKKY_BASE_ARBO_HANDOFF.md). Screen checklist: [`docs/MODULES.md`](docs/MODULES.md).

## Primary path (full stack — this is the working app)

Requires **Node 22**. Auth is off (`AUTH_DISABLED=true`). No Entra for local demo.

```bash
npm install
npm test          # domain unit tests + API smoke: PPD, BX ZIP, fiches d'avis, scale seed
npm run dev       # API http://127.0.0.1:5080  +  web http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173** (Vite proxies `/api` to the API). SQLite file is created at `apps/api/data/mi20.db` (or `MI20_DB_PATH`). First start seeds lookups + 3 canonical livrables + **3000** synthetic documents (`MI20_SEED_DOCS`).

### Exact demo walkthrough

1. **Accueil** — counters (documents, jalons, bordereaux, fiches d'avis) come from the database.
2. **Documents** — search `36 / 9351.3` (seed). Pagination holds thousands of synthetic rows.
3. **Import PPD**
   - *Charger Import_Rapide_exemple.xlsx* (mode rapide, `Nr Livrable`) → onglets Comparaison / Nouveaux / Erreurs LDD → **Appliquer les modifications validées**.
   - Rows with bad LDD (`UCase(Trim(Nom))`, e.g. unknown fournisseur) are listed and **skipped** on apply; they do not crash the lot.
   - *Charger Import_Rapide_Jalons.xlsx* for jalons-only.
   - *Charger PPD_Template.xlsx (mode complet)* or **upload** a full PPD (header `Num Liv.`). The official template is a header shell (0 livrables); the demo button fills example rows with those headers. A larger/new workbook with the same headers is parsed even if `Num Liv.` is not on the first sheet. After apply, Accueil counters and Documents search (including `36 / 9351.3`) read the database.
4. **Bordereaux** — choose leader **CAF** → **Créer le bordereau** → search a document → **Rattacher** → **Exporter et télécharger le ZIP**. Pack layout: `EXPORT_BX/MI20_BORD_<code>/` (manifest + `MI20_BORD_TEMPLATE_M5_V12.xls`). Download generates the pack if needed (one-click).
5. **Retours RATP** → onglet **Import Excel FA** → *Charger Import_Retours_RATP_exemple.xlsx* (header `NumLivrable`) → **Appliquer les fiches d'avis**. That updates `fiche_avis`, `envoi` (Réponse / fichier FA) and `revision`. Unknown livrables stay in the error list (not a silent no-op). Manual saisie on the other tab writes the same tables.

Files land under `storage/` (or `MI20_STORAGE_ROOT`).

### Docker (Postgres by default)

```bash
docker compose up --build
```

- Postgres 16 on `:5432` (`DATABASE_URL=postgres://mi20:mi20@postgres:5432/mi20`)
- API + built SPA on **http://127.0.0.1:5080**
- Seed: 3000 synthetic documents (`MI20_SEED_DOCS`)
- Volume `mi20-pg` keeps the database; `mi20-files` keeps `EXPORT_*` / imports

SQLite-in-docker (no Postgres): `docker compose --profile sqlite up --build api-sqlite`.

### How to import / scale toward Access volume (~30k documents, ~45k jalons)

| Goal | How |
|------|-----|
| Local demo | `npm run dev` — SQLite + `MI20_SEED_DOCS=3000` (default on empty DB) |
| Heavier seed | `MI20_SEED_DOCS=30000 AUTH_DISABLED=true npm run dev:api` (first start only; `seedIfEmpty`) |
| Real PPD | Import PPD → upload `.xlsx` (rapide or full). Staging → compare → apply. Do **not** commit production PPD. |
| Official fixtures | `fixtures/Import_Rapide_exemple.xlsx`, `Import_Rapide_Jalons.xlsx`, `PPD_Template.xlsx` |
| Fiches d'avis | `fixtures/Import_Retours_RATP_exemple.xlsx` or any sheet with `NumLivrable` |
| Postgres / Neon / Supabase | Set `DATABASE_URL=postgres://...` (same schema/migrations). Docker Compose already does this. |
| Indexes | `GroupeLigne+IndiceLigne` unique, `programmation_jalon(IdDocument,IdJalon)`, envoi/revision/histo/FA batch indexes |

The API loads document snapshots for PPD compare in memory; tens of thousands of rows is the intended band. Bulk apply skips LDD-error rows.

## Temporary public demo (not the success target)

Shareable HTTPS test link (GitHub Pages, no Entra, no SharePoint):

**https://amineux.github.io/MI20-Arbo/**

Hash routes (`#/documents`, `#/import-ppd`, `#/bordereaux`, `#/retours-ratp`). **In-browser localStorage intercept** — useful for an email click, **not** durable storage. Production / team use is `npm run dev` or `docker compose`.

Rebuild:

```bash
VITE_STATIC_DEMO=true VITE_BASE=/MI20-Arbo/ npm run build:pages
```

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Architecture

```
SharePoint page
  └─ SPFx web part (iframe)  ──or──  Embed web part
        └─ React 18 + Fluent UI v9  (apps/web)
              └─ REST  /api/*
                    └─ Node 22 Fastify API  (apps/api)
                          ├─ SQLite (local)  or  Postgres (DATABASE_URL / docker)
                          └─ FileStorage: local storage/  or Microsoft Graph (SharePoint library)
```

| Folder | Role |
|--------|------|
| `packages/domain` | PPD `import_columns` mapping, LIGNE parse, LDD `UCase(Trim(Nom))`, jalon unpivot, FA `NumLivrable`, Excel I/O (SheetJS) |
| `apps/api` | Fastify + SQLite/Postgres + import/export/bordereau/fiches d'avis |
| `apps/web` | Fluent UI v9 SPA (French labels) |
| `spfx/` | SPFx 1.18 web part that iframes the SPA |
| `docs/handoff/` | Access schemas, config `[PPD]`, column map |
| `fixtures/` | Official templates + synthetic FA example (no production PPD dump) |

## SharePoint host (Alstom) — later, does not block local demo

| | |
|---|---|
| Site | [https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc](https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc) |
| Folder | `Shared Documents/Gestion Doc/MI20` |
| Embed page | `SitePages/MI20-Arbo.aspx` on that site |
| API env | `SHAREPOINT_SITE_URL` · `SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20` |

Steps: [`docs/DEPLOY_SHAREPOINT.md`](docs/DEPLOY_SHAREPOINT.md). Entra is **not** required for `npm run dev` / Docker.

## PPD rules implemented

From `docs/handoff/config.txt` `[PPD]` + `import_columns.csv`:

- First column `Num Liv.` (rapide: `Nr Livrable`)
- Jalons columns **44–66**, dates **67–89**, `nbJalonsPPD=23`
- Natures: `T`, `TITRE`, `LIGNE`, `LDD`, `LDDDomaineChargeur`, `OUINON`, `J`, `AUTORISANT`
- LIGNE → `GroupeLigne` + `IndiceLigne` (ex. `36 / 9351.3`)
- LDD match: `UCase(Trim(Nom))`
- Pipeline: Excel (SheetJS) → `import_raw` staging → user confirm → merge `document` + `programmation_jalon` + `doc_histo`
- Apply skips rows with lookup errors; they remain visible on the Erreurs LDD tab

## Bordereau rules

- Template: official `fixtures/MI20_BORD_TEMPLATE_M5_V12.xls` (copied into the pack)
- Output: `EXPORT_BX/MI20_BORD_<code>/`
- Entities: `bordereau` + `envoi`
- ZIP download builds the pack if it is missing

## Fiches d'avis / ImportRetoursRATP

- Header: `NumLivrable` (`titrePremiereColonneXLS_RetoursRATP`)
- Staging: `import_fa_raw` + `import_batch.Mode = 'fa'`
- Apply: insert `fiche_avis`; update latest `envoi` (RéponseFicheAvis, FichierFicheAvis_Envoye, dates, lot); upsert `revision` + `FichierFicheAvis_AEnvoyer`
- Unknown `GroupeLigne / IndiceLigne` → row error, lot continues

## Data

- **SQLite** (default `npm run dev`) or **Postgres** (`DATABASE_URL` / docker-compose). Schema in `apps/api/src/schema.ts` (indexes for Access-scale keys). Azure SQL script remains `docs/sql/azure.sql` for a later IT mandate — not used by the Node API.
- Seed: lookups + jalons + 3 canonical docs (36/9351.3, 36/476, 40/12) + optional synthetic `100+ / n` documents. **Not** the 31k production DB.

## Remaining gaps (honest)

- **KPI / bilan / docts autorisation**: templates download; Access CopyFromRecordset fill is not implemented.
- **GitHub Pages** remains a localStorage demo (email click). Durable work is `npm run dev` / Docker + Postgres.
- **Azure SQL** script exists (`docs/sql/azure.sql`) but the Node API talks SQLite or Postgres only.
- **SharePoint / Entra / Graph** is optional production hosting — not required for the three flows.
- **Production Access dump** (~31k documents) is not in the repo. Scale is proven with synthetic seed + indexes; import a real PPD locally, do not commit it.
- **Form_ARCHI** is out of MVP (handoff).

## License

MIT. See `LICENSE` and `NOTICE`.
