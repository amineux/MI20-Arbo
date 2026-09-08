/** GitHub Pages demo only — keep small files in the browser; giant PPD belongs on `/api`. */
export const DEMO_MAX_UPLOAD_BYTES = 1_500_000;

export const DEMO_LARGE_FILE_MESSAGE =
  "Ce classeur est trop volumineux pour la démo GitHub Pages (analyse Excel dans le navigateur, stockage localStorage). Les PPD Access (~30 000 lignes, 15–34 Mo) se traitent dans l'application complète : npm run dev (http://127.0.0.1:5173) ou docker compose — l'API parse Excel côté serveur, pagine la comparaison et applique sans charger tout le classeur dans le navigateur.";
