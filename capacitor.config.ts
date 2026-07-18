import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chifak.app',
  appName: 'chifak',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  ios: {
    contentInset: 'always',
  },
  android: {
    // Empêche le contenu non sécurisé : le backend DOIT être servi en HTTPS
    allowMixedContent: false,
  },
};

export default config;
