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

    /* `persistOAuthLogin` refuse désormais un jeton que le serveur ne
       reconnaît pas. Sans ce try, l'exception remontait dans un écouteur
       Capacitor — donc nulle part : Safari restait ouvert par-dessus
       l'application, et rien n'indiquait ce qui s'était passé. */
    let user: PatientUser;
    try {
      user = await persistOAuthLogin(token);
    } catch (e) {
      try { await Browser.close(); } catch { /* déjà fermé */ }
      alert(e instanceof Error ? e.message : 'Connexion impossible.');
      return;
    }

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
