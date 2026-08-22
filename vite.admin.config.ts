import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build de l'application d'ADMINISTRATION.
 *
 * Deux applications, un seul dépôt. Le système de design, les types métier et
 * la couche réseau restent partagés — les dupliquer garantirait qu'ils
 * divergent — mais les écrans, eux, ne se croisent jamais : ce qui est
 * compilé ici n'atteint aucun patient, et réciproquement.
 *
 *   npm run dev          →  application patiente,        port 5173
 *   npm run dev:admin    →  administration,              port 5174
 *   npm run build        →  dist/
 *   npm run build:admin  →  dist-admin/
 *
 * Les deux dossiers se déploient séparément, sur deux domaines distincts.
 * L'administration N'EST PAS un chemin du site public : la servir sous
 * /admin ne séparerait rien du tout — même origine, mêmes cookies, même
 * surface exposée.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'admin'),
  /* Les fichiers .env se lisent à la RACINE du dépôt, pas dans admin/.
     Sans cette ligne, Vite les cherchait sous `root` — donc dans admin/, où
     il n'y en a aucun. VITE_API_URL restait indéfini et l'adresse de l'API
     retombait sur « /api », relatif au domaine de l'administration. Comme
     les deux applications se déploient sur deux domaines distincts (voir
     plus haut), l'administration en ligne appelait /api sur elle-même et
     recevait 404 sur chaque requête : l'interface entière était inerte.

     La compilation, elle, réussissait sans un mot. C'est le genre de panne
     qu'on ne découvre qu'en production. */
  envDir: __dirname,
  plugins: [react(), tailwindcss()],
  appType: 'spa',

  server: {
    // Port distinct : les deux applications tournent en parallèle pendant le
    // développement, chacune contre le même backend.
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
    /* `host` reste à sa valeur par défaut — l'interface locale seulement.
       L'application patiente écoute sur tout le réseau pour être ouverte
       depuis un téléphone ; l'administration n'a aucune raison de l'être. */
  },

  build: {
    outDir: path.resolve(__dirname, 'dist-admin'),
    emptyOutDir: true,
    /* Pas de fichiers de correspondance en production : ils reconstituent le
       code source complet, commentaires inclus, pour qui ouvre la console. */
    sourcemap: false,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
