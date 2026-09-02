# Deploy MI20 Arbo on Alstom SharePoint

Concrete target for this repo (do **not** invent another tenant or site):

| | |
|---|---|
| Tenant | `alstomgroup.com` (`*.sharepoint.com` host `alstomgroup.sharepoint.com`) |
| Site | [https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc](https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc) |
| Document library folder | `Shared Documents/Gestion Doc/MI20` (URL-decoded from the library AllItems link) |
| Suggested SPA host page | Create a site page under that site, e.g. `SitePages/MI20-Arbo.aspx` → [https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc/SitePages/MI20-Arbo.aspx](https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc/SitePages/MI20-Arbo.aspx) |
| Graph / file root | That **MI20** folder (exports as `EXPORT_PPD` and `EXPORT_BX` **inside** it, or as subfolders `EXPORT_PPD` / `EXPORT_BX`) |

Env vars for the API (see [`.env.example`](../.env.example)):

```
SHAREPOINT_SITE_URL=https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc
SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20
```

`SHAREPOINT_DRIVE_PATH` is the path **from the default Documents library root**. The browser UI shows a space (`Gestion Doc`). If Graph returns 404 on `/GestionDoc/MI20`, set `GRAPH_LIBRARY_PATH=/Gestion Doc/MI20` instead.

---

## 1. Host API + SPA on HTTPS (Azure) with Entra ID for alstomgroup.com

SharePoint only iframes **HTTPS**. Local `http://127.0.0.1:5173` cannot be the production embed URL.

### 1.1 Azure App Service (simplest: API serves the SPA)

1. Build the SPA against the public API origin (same origin if you copy `apps/web/dist` into the API):

   ```bash
   npm ci
   npm run build --workspace @mi20/web
   npm run build --workspace @mi20/api
   ```

2. Deploy `apps/api` (Node 22) to **Azure App Service**. Point `WEB_DIST` at the built SPA (the API already serves `apps/web/dist` when present).
3. Alternative split: **Static Web Apps** (SPA) + App Service (API). Then set `VITE_API_URL=https://<api-host>` at SPA **build** time and enable CORS on the API for the SPA origin.

Use a hostname you control, e.g. `https://mi20-arbo.<your-azure-app>.azurewebsites.net`. Record that URL; it is the iframe `src`.

### 1.2 Entra ID app registration (tenant `alstomgroup.com`)

Create registrations **in the Alstom Entra tenant** (users sign in as `@alstomgroup.com`). Demo (`AUTH_DISABLED=true`) is for local only.

**SPA (public client)**

- Platform: Single-page application
- Redirect URI: `https://<your-spa>/` (and `https://<your-spa>` if the host strips the slash)
- Enable ID tokens if you use MSAL popup/redirect

**API (confidential / resource)**

- Expose an API scope, e.g. `api://<api-app-id>/access_as_user`
- SPA registration → API permissions → that scope → **admin consent** if the tenant requires it
- Graph (application or delegated, per IT policy) only if the API writes `EXPORT_PPD` / `EXPORT_BX` to the library:
  - `Sites.Selected` (preferred) or `Sites.ReadWrite.All` on site `BT_BTPIIMaroc-GestionDoc`
  - Grant the app write on the **Documents** drive / the **MI20** folder

API env (production):

```
AUTH_DISABLED=false
AZURE_AD_TENANT_ID=<alstomgroup.com tenant GUID>
AZURE_AD_CLIENT_ID=<api-app-id>
AZURE_AD_API_AUDIENCE=api://<api-app-id>
AZURE_AD_API_SCOPE=api://<api-app-id>/access_as_user
AZURE_AD_REDIRECT_URI=https://<your-spa>
PUBLIC_WEB_URL=https://<your-spa>
SHAREPOINT_SITE_URL=https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc
SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20
```

SPA: `VITE_API_URL=https://<api>` when not same-origin. `GET /api/auth/config` already exposes the Entra client config; wire `@azure/msal-browser` to send Bearer tokens when `authDisabled` is false.

---

## 2. Allow SharePoint to iframe the SPA (`frame-ancestors`)

The hosted SPA (and API if it serves HTML) must send:

```
Content-Security-Policy: frame-ancestors https://*.sharepoint.com https://*.sharepoint-df.com 'self'
```

Do **not** send `X-Frame-Options: DENY` or `SAMEORIGIN` (those block SharePoint). If Azure Front Door / App Service adds `X-Frame-Options`, remove it for the SPA origin.

This is required for both the Embed web part and the SPFx iframe.

---

## 3. Put the SPA on the Gestion Doc site

Create (or edit) a modern site page:

**Site:** `BT_BTPIIMaroc-GestionDoc`  
**Suggested URL:** `SitePages/MI20-Arbo.aspx`

Then choose **one** of the following. Prefer **Embed** if the tenant App Catalog is locked down.

### Option A — stock Embed web part (simpler; no App Catalog)

Works with site **Contribute** / page-edit rights. No custom package.

1. Open [the site](https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc).
2. **New** → **Page** (or edit `SitePages/MI20-Arbo.aspx`).
3. Insert the **Embed** web part (`</>` / “Embed”).
4. Paste the **HTTPS SPA URL** from step 1, e.g.

   ```html
   <iframe src="https://<your-spa>/" width="100%" height="900" title="MI20 Arbo"></iframe>
   ```

   Some tenants only allow the URL field (no raw HTML). Paste `https://<your-spa>/` there.
5. Publish. Teammates open `…/SitePages/MI20-Arbo.aspx`, not Access.

If Embed is blocked by tenant HTML/iframe policy, use Option B or ask IT to allow embedding that Azure origin.

### Option B — SPFx package to the tenant App Catalog

Gives a named **MI20 Arbo** web part and a property pane for the SPA URL. Uploading to the **tenant App Catalog** often needs **IT / SharePoint admin**. A site collection catalog (if enabled on `BT_BTPIIMaroc-GestionDoc`) can be enough for this site only.

1. Package on **Node 18** (SPFx 1.18):

   ```bash
   cd spfx
   nvm use 18
   npm install
   gulp bundle --ship
   gulp package-solution --ship
   ```

2. Upload `spfx/sharepoint/solution/mi20-arbo.sppkg` to the App Catalog; deploy / make available to `BT_BTPIIMaroc-GestionDoc`.
3. **Site contents** → **New** → **App** → add **MI20 Arbo**.
4. Edit `SitePages/MI20-Arbo.aspx` → insert web part **MI20 Arbo** → **URL de l'application** = `https://<your-spa>`.
5. Publish.

Details: [`spfx/README.md`](../spfx/README.md).

---

## 4. Point file storage at the MI20 folder

PPD exports (`EXPORT_PPD`) and bordereau packs (`EXPORT_BX`) should land under:

```
Shared Documents / Gestion Doc / MI20 /
  EXPORT_PPD/
  EXPORT_BX/
```

(or those names as files/folders directly in `MI20`, matching the Access layout).

Set on the API:

```
SHAREPOINT_SITE_URL=https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc
SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20
```

The current Graph hook (`apps/api` `FileStorage`) also reads:

```
GRAPH_SITE_ID=alstomgroup.sharepoint.com,/sites/BT_BTPIIMaroc-GestionDoc
GRAPH_DRIVE_ID=<Documents library drive id>
GRAPH_LIBRARY_PATH=/GestionDoc/MI20
```

Resolve IDs (signed-in Graph Explorer or app token), only for this site:

```http
GET https://graph.microsoft.com/v1.0/sites/alstomgroup.sharepoint.com:/sites/BT_BTPIIMaroc-GestionDoc
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
```

Use the drive whose name is **Documents** (browser: **Shared Documents**). Folder path from that drive root is `Gestion Doc/MI20`.

Until `GRAPH_DRIVE_ID` is set, the API keeps files under local `storage/` (fine for Azure disk demo; not the team library).

Create empty folders `EXPORT_PPD` and `EXPORT_BX` in **MI20** before the first production export if Graph cannot create intermediate folders.

---

## Checklist

- [ ] HTTPS API + SPA on Azure
- [ ] Entra apps in **alstomgroup.com**; admin consent if required
- [ ] `frame-ancestors` includes `https://*.sharepoint.com`
- [ ] Page `SitePages/MI20-Arbo.aspx` on site `BT_BTPIIMaroc-GestionDoc` (Embed **or** SPFx)
- [ ] `SHAREPOINT_SITE_URL` + `SHAREPOINT_DRIVE_PATH=/GestionDoc/MI20` (and Graph IDs when writing to the library)
- [ ] Team opens the SharePoint page, not Access
