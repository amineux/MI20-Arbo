# SPFx web part — MI20 Arbo

Iframe host so teammates open the app from a SharePoint modern page.

SPFx 1.18.x expects **Node 18** (not Node 22). Use nvm:

```bash
cd spfx
nvm use 18
npm install
gulp bundle --ship
gulp package-solution --ship
```

The package is `sharepoint/solution/mi20-arbo.sppkg` (path from `config/package-solution.json`: `solution/mi20-arbo.sppkg` under `sharepoint/`).

## Deploy

Alstom target site, env vars, Embed vs App Catalog, and Entra: **[`docs/DEPLOY_SHAREPOINT.md`](../docs/DEPLOY_SHAREPOINT.md)**.

Site: `https://alstomgroup.sharepoint.com/sites/BT_BTPIIMaroc-GestionDoc`  
Suggested page: `SitePages/MI20-Arbo.aspx`

1. Upload `mi20-arbo.sppkg` to the tenant **App Catalog** (or a site catalog on that site). Tenant catalog often needs **IT**.
2. Enable the app on `BT_BTPIIMaroc-GestionDoc`.
3. Edit `SitePages/MI20-Arbo.aspx` → add web part **MI20 Arbo**.
4. Property pane: set **URL de l'application** to the HTTPS origin of the hosted SPA (must allow being framed by `*.sharepoint.com`).

## Alternative without custom SPFx (no App Catalog)

SharePoint **Embed** web part on the same page → iframe the same SPA URL. Requires the host to send `Content-Security-Policy: frame-ancestors https://*.sharepoint.com`.

The SPA talks to the API (`VITE_API_URL`). Host API + web on Azure App Service, or web on Static Web Apps + API on App Service, with CORS + Entra ID (`alstomgroup.com`).
