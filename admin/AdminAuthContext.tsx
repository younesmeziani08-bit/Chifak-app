import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, deuxiemeFacteurAPI } from './services/api';

interface AdminUser {
  username: string;
  role: 'admin' | 'employee';
}

/** Ce que rend une tentative de connexion. */
type ResultatConnexion =
  | { etat: 'ouverte' }
  /* Mot de passe juste, second facteur attendu. Aucune session n'existe
     encore : le jeton intermédiaire ne donne accès à rien. */
  | { etat: 'code-attendu' }
  | { etat: 'refusee' };

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  login: (username: string, password: string) => Promise<ResultatConnexion>;
  /** Second temps : le code à six chiffres, ou un code de secours. */
  validerCode: (code: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  /** Message exact renvoyé par le serveur au dernier échec, s'il y en a un. */
  derniereErreur: string;
  /** Compte d'administration encore dépourvu de second facteur. */
  deuxiemeFacteurAbsent: boolean;
  /** Réserve de codes de secours entamée : prévenir avant qu'elle soit vide. */
  codesDeSecoursRestants: number | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

/* ── Ce fichier contenait une porte dérobée d'administration ──
 *
 * Trois couples identifiant / mot de passe y étaient écrits en dur, et un
 * repli les acceptait « si l'API est indisponible OU REFUSE LA CONNEXION ».
 * Autrement dit : le serveur répondait « identifiants incorrects », et le
 * navigateur passait outre.
 *
 * Ces mots de passe partaient dans le fichier JavaScript livré à chaque
 * visiteur : les lire ne demandait qu'un clic droit sur la page publique.
 * Ils étaient de surcroît affichés à l'écran, derrière un bouton « comptes de
 * démonstration ». Et ce sont exactement ceux que `database.js` sème hors
 * production — donc de vrais identifiants, pas une fiction.
 *
 * La règle est maintenant sans exception : seul le serveur décide qui est
 * administrateur, et il le prouve en délivrant un jeton. Pas de jeton, pas de
 * session — quoi que contienne le stockage local du navigateur.
 */

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [derniereErreur, setDerniereErreur] = useState('');
  /* En mémoire seulement : ce jeton vit cinq minutes et n'ouvre aucune route.
     L'écrire dans le stockage local le laisserait traîner après un abandon. */
  const [jetonIntermediaire, setJetonIntermediaire] = useState<string | null>(null);
  const [deuxiemeFacteurAbsent, setDeuxiemeFacteurAbsent] = useState(false);
  const [codesDeSecoursRestants, setCodesDeSecoursRestants] = useState<number | null>(null);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('chifak_admin_token');

        /* Pas de jeton, pas de session. L'ancienne version ouvrait l'espace
           d'administration sur la seule présence de « chifak_admin_user » dans
           le stockage local — une valeur que n'importe qui écrit depuis la
           console de son navigateur, sans mot de passe d'aucune sorte. */
        if (!token) {
          localStorage.removeItem('chifak_admin_user');
          setAdminUser(null);
          return;
        }

        // Le rôle vient du serveur, qui relit le jeton. Il n'est jamais lu
        // depuis le stockage local : on y écrirait « admin » en trois secondes.
        const response = await authAPI.verify();
        const verifiedUser = {
          username: response.user.username,
          role: response.user.role,
        };
        setAdminUser(verifiedUser);
        localStorage.setItem('chifak_admin_user', JSON.stringify(verifiedUser));
      } catch (err) {
        /* On referme la session si le SERVEUR a refusé le jeton. Un
           hébergement en cours de réveil renvoie autre chose : effacer le
           jeton dans ce cas obligerait l'administration à se reconnecter à
           chaque ouverture, sans raison. Le jeton est alors conservé, mais
           aucun accès n'est accordé pour autant — l'écran de connexion
           réapparaît, et une nouvelle vérification aura lieu ensuite. */
        const statut = (err as { status?: number })?.status;
        if (statut === 401 || statut === 403) {
          localStorage.removeItem('chifak_admin_token');
          localStorage.removeItem('chifak_admin_user');
        }
        setAdminUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (username: string, password: string): Promise<ResultatConnexion> => {
    setDerniereErreur('');
    try {
      const response = await authAPI.login(username, password);

      /* Second facteur attendu : on garde le jeton intermédiaire en mémoire —
         jamais dans le stockage local. Il expire en cinq minutes et n'ouvre
         aucune route ; l'écrire sur le disque n'apporterait rien et le
         laisserait traîner après un abandon. */
      if (response.deuxiemeFacteurRequis) {
        setJetonIntermediaire(response.jetonIntermediaire);
        return { etat: 'code-attendu' };
      }

      const loggedUser = {
        username: response.user.username,
        role: response.user.role
      };
      setAdminUser(loggedUser);
      setDeuxiemeFacteurAbsent(!!response.deuxiemeFacteurAbsent);
      localStorage.setItem('chifak_admin_user', JSON.stringify(loggedUser));

      return { etat: 'ouverte' };
    } catch (err) {
      /* Un échec est un échec. Aucun repli : c'est le serveur qui authentifie,
         et lui seul. Le message d'erreur est remonté tel quel pour que le
         freinage anti-force-brute — « réessayez dans 5 minutes » — s'affiche
         au lieu d'un « identifiants incorrects » trompeur. */
      setDerniereErreur(err instanceof Error ? err.message : '');
      return { etat: 'refusee' };
    }
  };

  const validerCode = async (code: string): Promise<boolean> => {
    setDerniereErreur('');
    if (!jetonIntermediaire) {
      setDerniereErreur('Session expirée. Recommencez la connexion.');
      return false;
    }
    try {
      const data = await deuxiemeFacteurAPI.terminerConnexion(jetonIntermediaire, code);
      const loggedUser = { username: data.user.username, role: data.user.role };
      setAdminUser(loggedUser);
      setDeuxiemeFacteurAbsent(false);
      setCodesDeSecoursRestants(data.codesDeSecoursRestants ?? null);
      localStorage.setItem('chifak_admin_user', JSON.stringify(loggedUser));
      setJetonIntermediaire(null);
      return true;
    } catch (err) {
      setDerniereErreur(err instanceof Error ? err.message : '');
      return false;
    }
  };

  const logout = () => {
    authAPI.logout();
    localStorage.removeItem('chifak_admin_user');
    setDerniereErreur('');
    setJetonIntermediaire(null);
    setDeuxiemeFacteurAbsent(false);
    setCodesDeSecoursRestants(null);
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{
      adminUser,
      login,
      validerCode,
      logout,
      isAuthenticated: !!adminUser,
      loading,
      derniereErreur,
      deuxiemeFacteurAbsent,
      codesDeSecoursRestants,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
