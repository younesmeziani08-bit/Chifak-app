import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { persistOAuthLogin, type PatientUser } from './auth';

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Démarre une connexion OAuth (Google / Facebook).
 * - Web : redirection classique dans l'onglet.
 * - Natif : ouvre Safari (Google interdit l'OAuth dans la webview) avec
 *   ?redirect=app, pour que le backend renvoie vers le lien profond de l'app.
 */
export async function startOAuth(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const sep = url.includes('?') ? '&' : '?';
    await Browser.open({ url: `${url}${sep}redirect=app` });
  } else {
    window.location.href = url;
  }
}

/**
 * Écoute le retour OAuth natif : chifak://auth/callback?token=...
 * Enregistre la session, ferme Safari et notifie l'app.
 */
export function registerOAuthDeepLink(onLogin: (user: PatientUser) => void): () => void {
  const handlePromise: Promise<PluginListenerHandle> = CapApp.addListener(
    'appUrlOpen',
    async ({ url }: { url: string }) => {
      if (!url || !url.includes('auth/callback')) return;
    const query = url.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const token = params.get('token');
    if (!token) return;

    const user = await persistOAuthLogin(token, params.get('name'), params.get('email'));
    try {
      await Browser.close();
    } catch {
      // Safari peut déjà être fermé
    }
    onLogin(user);
  });

  return () => {
    handlePromise.then((h) => h.remove()).catch(() => {});
  };
}
