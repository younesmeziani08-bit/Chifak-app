import { useEffect, useRef, useState } from 'react';

const JITSI_DOMAIN = 'meet.jit.si';
const SCRIPT_SRC = `https://${JITSI_DOMAIN}/external_api.js`;

function loadJitsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).JitsiMeetExternalAPI) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('jitsi')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('jitsi'));
    document.body.appendChild(s);
  });
}

interface Props {
  room: string;
  displayName?: string;
  onClose: () => void;
  isArabic?: boolean;
}

export default function VideoCall({ room, displayName, onClose, isArabic }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    loadJitsiScript()
      .then(() => {
        if (disposed || !containerRef.current) return;
        const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
        const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: room,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: displayName || '' },
          configOverwrite: { disableDeepLinking: true, prejoinPageEnabled: true },
          interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false },
        });
        apiRef.current = api;
        api.addEventListener('readyToClose', onClose);
      })
      .catch(() => setFailed(true));

    return () => {
      disposed = true;
      try { apiRef.current?.dispose(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return (
    <div className="fixed inset-0 z-[120] bg-black flex flex-col" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white flex-shrink-0">
        <span className="text-sm font-semibold">{isArabic ? 'استشارة بالفيديو' : 'Téléconsultation'}</span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-semibold transition-colors"
        >
          {isArabic ? 'إنهاء' : 'Quitter'}
        </button>
      </div>
      {failed ? (
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <p className="text-white/80 text-sm max-w-sm">
            {isArabic
              ? 'تعذّر تحميل الفيديو. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.'
              : "Impossible de charger la visio. Vérifiez votre connexion internet et réessayez."}
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 min-h-0" />
      )}
    </div>
  );
}
