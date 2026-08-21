import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import AdminApp from './AdminApp';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { DoctorsProvider } from '../src/contexts/DoctorsContext';
import { AdminAuthProvider } from './AdminAuthContext';

/**
 * Point d'entrée de l'application d'administration.
 *
 * Elle partage la feuille de styles et le référentiel de langue avec
 * l'application patiente — mêmes couleurs, mêmes polices, même vocabulaire —
 * mais ne partage aucun écran. Rien de ce qui se trouve ici n'est livré aux
 * patients, et réciproquement.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AdminAuthProvider>
        <DoctorsProvider>
          <AdminApp />
        </DoctorsProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  </StrictMode>
);
