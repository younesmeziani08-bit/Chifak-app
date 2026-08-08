import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chifak.app',
  appName: 'chifak',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  ios: {
    // 'never' : on gère nous-mêmes les zones sûres via env(safe-area-inset-*)
    // en CSS. 'always'/'automatic' fait ajuster les insets par WKWebView
    // pendant le scroll, ce qui casse le suivi de la barre `position: sticky`
    // (elle traîne / ne défile plus avec la page).
    contentInset: 'never',
  },
  android: {
    // Empêche le contenu non sécurisé : le backend DOIT être servi en HTTPS
    allowMixedContent: false,
  },
};

export default config;
