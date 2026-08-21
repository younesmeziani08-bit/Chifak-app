import { useAdminAuth } from './AdminAuthContext';
import AdminLogin from './ecrans/AdminLogin';
import AdminDashboard from './ecrans/AdminDashboard';

/**
 * Racine de l'application d'administration.
 *
 * Deux états, et rien entre les deux : soit la session est établie par le
 * serveur, soit c'est l'écran de connexion. Il n'y a pas de page d'accueil,
 * pas de navigation publique, pas de retour vers le site patient — cette
 * application ne sert qu'à une chose, et seulement à ceux qui y ont accès.
 *
 * Le bouton « Retour à l'accueil » des anciens écrans renvoyait vers la page
 * patiente, dont ils faisaient alors partie. Ici il déconnecte : c'est la
 * seule sortie qui ait un sens.
 */
export default function AdminApp() {
  const { isAuthenticated, loading, logout } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-2)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 mb-3" style={{ borderColor: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={() => { /* le contexte a posé la session */ }} onBackToHome={logout} />;
  }

  return <AdminDashboard onBackToHome={logout} />;
}
