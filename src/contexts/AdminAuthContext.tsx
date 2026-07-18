import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface AdminUser {
  username: string;
  role: 'admin' | 'employee';
}

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS: Array<{ username: string; password: string; role: 'admin' | 'employee' }> = [
  { username: 'admin', password: 'chifak2026', role: 'admin' },
  { username: 'employee1', password: 'chifak123', role: 'employee' },
  { username: 'employee2', password: 'chifak456', role: 'employee' },
];

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('chifak_admin_token');
        const localUser = localStorage.getItem('chifak_admin_user');

        if (!token && localUser) {
          setAdminUser(JSON.parse(localUser));
          return;
        }

        if (token) {
          const response = await authAPI.verify();
          const verifiedUser = {
            username: response.user.username,
            role: response.user.role
          };
          setAdminUser(verifiedUser);
          localStorage.setItem('chifak_admin_user', JSON.stringify(verifiedUser));
        }
      } catch (err) {
        // Fallback local si présent (mode démo hors API)
        const localUser = localStorage.getItem('chifak_admin_user');
        if (localUser) {
          setAdminUser(JSON.parse(localUser));
          setLoading(false);
          return;
        }

        // Token invalide, nettoyer
        localStorage.removeItem('chifak_admin_token');
        localStorage.removeItem('chifak_admin_user');
        setAdminUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await authAPI.login(username, password);
      
      const loggedUser = {
        username: response.user.username,
        role: response.user.role
      };
      setAdminUser(loggedUser);
      localStorage.setItem('chifak_admin_user', JSON.stringify(loggedUser));
      
      return true;
    } catch (err) {
      // Fallback démo si l'API est indisponible ou refuse la connexion
      const demoUser = DEMO_CREDENTIALS.find(
        (cred) => cred.username === username && cred.password === password
      );

      if (demoUser) {
        const fallbackUser = { username: demoUser.username, role: demoUser.role };
        setAdminUser(fallbackUser);
        localStorage.setItem('chifak_admin_user', JSON.stringify(fallbackUser));
        return true;
      }

      console.error('Erreur de connexion:', err);
      return false;
    }
  };

  const logout = () => {
    authAPI.logout();
    localStorage.removeItem('chifak_admin_user');
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ 
      adminUser, 
      login, 
      logout, 
      isAuthenticated: !!adminUser,
      loading
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
