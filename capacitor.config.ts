import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuration Capacitor.
 *
 * ── Rechargement à chaud ──
 * En développement, l'application peut charger son interface depuis le serveur
 * Vite de l'ordinateur au lieu des fichiers embarqués : chaque modification
 * apparaît alors sur le téléphone en une seconde, sans reconstruction.
 *
 * Ce mode s'active UNIQUEMENT si la variable CAP_SERVER_URL est présente.
 * C'est délibéré : une adresse codée en dur ici finirait tôt ou tard dans une
 * version publiée, et l'application de tes utilisateurs tenterait de charger
 * son interface depuis ton ordinateur portable — écran blanc pour tout le
 * monde, et impossible à corriger sans une nouvelle publication.
 *
 * Usage :  npm run cap:live     (voir package.json)
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.chifak.app',
  appName: 'chifak',
  webDir: 'dist',
  backgroundColor: '#ffffff',

  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          // Autorise le http en clair : le serveur Vite du réseau local n'a
          // pas de certificat. Uniquement en développement, par construction.
          cleartext: true,
        },
      }
    : {}),

  ios: {
    // 'never' : on gère nous-mêmes les zones sûres via env(safe-area-inset-*)
    // en CSS. 'always'/'automatic' fait ajuster les insets par WKWebView
    // pendant le scroll, ce qui casse le suivi de la barre `position: sticky`
    // (elle traîne / ne défile plus avec la page).
    contentInset: 'never',
  },
  android: {
    // Empêche le contenu non sécurisé : le backend DOIT être servi en HTTPS.
    // Le rechargement à chaud passe outre via server.cleartext ci-dessus.
    allowMixedContent: false,
  },
};

export default config;
