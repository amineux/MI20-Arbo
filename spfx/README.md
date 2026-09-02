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

1. Upload `mi20-arbo.sppkg` to the tenant **App Catalog** (or site catalog).
2. Enable the app on the target site.
3. Edit a SharePoint page → add web part **MI20 Arbo**.
4. Property pane: set **URL de l'application** to the HTTPS origin of the hosted SPA (must allow being framed by your tenant).

## Alternative without custom SPFx

SharePoint **Embed** web part → iframe the same SPA URL. Requires the host to send `Content-Security-Policy: frame-ancestors https://*.sharepoint.com`.

The SPA talks to the API (`VITE_API_URL`). Host API + web on Azure App Service, or web on Static Web Apps + API on App Service, with CORS + Entra ID.
