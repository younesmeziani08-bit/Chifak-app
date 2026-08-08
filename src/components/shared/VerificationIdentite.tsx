import { useEffect, useRef, useState } from 'react';
import {
  extraireEmpreinte, similarite, capturerImage, effacer, prechargerModeles,
  SEUIL_SIMILARITE, SEUIL_VIVACITE, type Empreinte,
} from '../../utils/faceMatch';

/**
 * Vérification d'identité en direct, sans aucun stockage.
 *
 * Le praticien filme sa pièce d'identité, puis son visage. La comparaison a
 * lieu dans son navigateur. Rien n'est enregistré, rien n'est envoyé : ni
 * image, ni vidéo, ni gabarit. Le serveur ne reçoit que « concordance oui/non »
 * et un score.
 *
 * Deux limites énoncées à l'utilisateur, pas seulement en commentaire :
 * — le résultat oriente la décision, il ne la remplace pas ;
 * — une photo de carte d'identité est un support difficile, un refus n'accuse
 *   personne.
 */

type Etape = 'intro' | 'piece' | 'visage' | 'calcul' | 'resultat';

interface Props {
  isArabic: boolean;
  onResultat: (r: { verifie: boolean; score: number }) => void;
}

export default function VerificationIdentite({ isArabic, onResultat }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const empreintePiece = useRef<Empreinte | null>(null);

  const [etape, setEtape] = useState<Etape>('intro');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [score, setScore] = useState(0);
  const [verifie, setVerifie] = useState(false);
  const [alerteFactice, setAlerteFactice] = useState(false);

  /* Coupure du flux dès que le composant disparaît. Une caméra qui reste
     allumée après la fermeture d'un écran est une faute, même sans
     enregistrement : le voyant allumé inquiète, à juste titre. */
  const couperCamera = () => {
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
  };

  useEffect(() => () => {
    couperCamera();
    effacer(empreintePiece.current);
  }, []);

  /**
   * Ouverture de la caméra, avec repli.
   *
   * `facingMode: 'environment'` demande la caméra arrière. Sur un téléphone
   * c'est la bonne : elle fait la mise au point de près, indispensable pour
   * lire une carte. Sur un ordinateur portable, cette caméra n'existe pas et
   * la demande échoue. On réessaie donc sans contrainte d'orientation plutôt
   * que d'abandonner : filmer sa pièce avec la webcam marche très bien.
   */
  const ouvrirCamera = async (facing: 'environment' | 'user') => {
    couperCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('Contexte non sécurisé', 'SecurityError');
    }

    const taille = { width: { ideal: 1280 }, height: { ideal: 720 } };
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, ...taille },
        audio: false,
      });
    } catch (e) {
      // Orientation impossible : on prend n'importe quelle caméra disponible.
      const nom = e instanceof DOMException ? e.name : '';
      if (nom === 'OverconstrainedError' || nom === 'NotFoundError') {
        flux = await navigator.mediaDevices.getUserMedia({ video: taille, audio: false });
      } else {
        throw e;
      }
    }

    fluxRef.current = flux;
    if (videoRef.current) {
      videoRef.current.srcObject = flux;
      await videoRef.current.play();
    }
  };

  /** Message précis selon la panne : « refusé » recouvrait cinq causes. */
  const messageCamera = (e: unknown): string => {
    const nom = e instanceof DOMException ? e.name : '';
    switch (nom) {
      case 'NotAllowedError':
        return isArabic
          ? 'رفض المتصفح الوصول إلى الكاميرا. اسمح بذلك من رمز القفل في شريط العنوان، ثم أعد المحاولة.'
          : 'Le navigateur a refusé la caméra. Autorisez-la depuis l’icône de cadenas dans la barre d’adresse, puis réessayez. Sur Mac, vérifiez aussi Réglages Système › Confidentialité et sécurité › Caméra.';
      case 'NotFoundError':
        return isArabic
          ? 'لم يتم العثور على أي كاميرا على هذا الجهاز.'
          : 'Aucune caméra détectée sur cet appareil.';
      case 'NotReadableError':
        return isArabic
          ? 'الكاميرا مستعملة من طرف تطبيق آخر. أغلقه ثم أعد المحاولة.'
          : 'La caméra est utilisée par une autre application. Fermez-la puis réessayez.';
      case 'SecurityError':
        return isArabic
          ? 'يتطلب الوصول إلى الكاميرا اتصالاً آمناً (HTTPS أو localhost).'
          : 'La caméra exige une connexion sécurisée : HTTPS, ou localhost. Une adresse IP locale en clair ne fonctionne pas.';
      default:
        return isArabic
          ? 'تعذّر فتح الكاميرا.'
          : 'Impossible d’ouvrir la caméra.';
    }
  };

  const demarrer = async () => {
    setErreur('');
    try {
      prechargerModeles();
      // Caméra arrière pour la pièce : elle fait la mise au point de près.
      await ouvrirCamera('environment');
      setEtape('piece');
    } catch (e) {
      setErreur(messageCamera(e));
    }
  };

  const capturerPiece = async () => {
    if (!videoRef.current) return;
    setOccupe(true);
    setErreur('');
    try {
      const image = capturerImage(videoRef.current);
      const empreinte = await extraireEmpreinte(image);
      if (!empreinte) {
        setErreur(isArabic
          ? 'لم نتعرّف على وجه في البطاقة. قرّبها وتأكد من الإضاءة.'
          : 'Aucun visage détecté sur la pièce. Rapprochez-la et vérifiez la lumière.');
        return;
      }
      empreintePiece.current = empreinte;
      await ouvrirCamera('user');
      setEtape('visage');
    } catch (e) {
      setErreur(e instanceof DOMException
        ? messageCamera(e)
        : (isArabic ? 'خطأ أثناء التحليل.' : 'Erreur pendant l’analyse.'));
    } finally {
      setOccupe(false);
    }
  };

  const capturerVisage = async () => {
    if (!videoRef.current || !empreintePiece.current) return;
    setOccupe(true);
    setErreur('');
    setEtape('calcul');
    try {
      const image = capturerImage(videoRef.current);
      const empreinteVisage = await extraireEmpreinte(image);

      if (!empreinteVisage) {
        setErreur(isArabic
          ? 'لم نتعرّف على وجهك. ضع وجهك داخل الإطار.'
          : 'Visage non détecté. Placez votre visage dans le cadre.');
        setEtape('visage');
        return;
      }

      /* Vivacité : sur le visage en direct uniquement. La pièce d'identité EST
         une image imprimée, y attendre un signe de vie n'aurait aucun sens. */
      const suspect =
        (empreinteVisage.vivacite !== undefined && empreinteVisage.vivacite < SEUIL_VIVACITE)
        || (empreinteVisage.factice !== undefined && empreinteVisage.factice > 0.5);

      const s = similarite(empreintePiece.current, empreinteVisage);
      const ok = s >= SEUIL_SIMILARITE && !suspect;

      setScore(s);
      setVerifie(ok);
      setAlerteFactice(suspect);
      setEtape('resultat');
      onResultat({ verifie: ok, score: Math.round(s * 100) / 100 });

      // Les deux empreintes meurent ici. Seul le verdict survit.
      effacer(empreintePiece.current);
      effacer(empreinteVisage);
      empreintePiece.current = null;
      couperCamera();
    } catch {
      setErreur(isArabic ? 'خطأ أثناء المقارنة.' : 'Erreur pendant la comparaison.');
      setEtape('visage');
    } finally {
      setOccupe(false);
    }
  };

  const recommencer = () => {
    effacer(empreintePiece.current);
    empreintePiece.current = null;
    couperCamera();
    setScore(0);
    setVerifie(false);
    setAlerteFactice(false);
    setErreur('');
    setEtape('intro');
  };

  const cadre = 'rounded-xl overflow-hidden bg-black w-full';

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-2)' }}>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>
        {isArabic ? 'التحقق من الهوية' : 'Vérification d’identité'}
      </h3>

      {etape === 'intro' && (
        <>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'ستصوّر بطاقة هويتك ثم وجهك. تتم المقارنة داخل هاتفك أو حاسوبك.'
              : 'Vous filmerez votre pièce d’identité, puis votre visage. La comparaison a lieu dans votre appareil.'}
          </p>
          {/* Cette phrase est le cœur du dispositif : elle doit être lue. */}
          <p
            className="text-sm leading-relaxed rounded-lg px-3 py-2.5 mb-4"
            style={{ background: 'var(--accent-bg)', color: 'var(--ink)' }}
          >
            {isArabic
              ? 'لا تُحفظ أي صورة ولا يُرسل أي شيء إلى خوادمنا. نستلم فقط النتيجة: مطابق أو غير مطابق.'
              : 'Aucune image n’est enregistrée et rien n’est envoyé à nos serveurs. Nous ne recevons que le résultat : concordant ou non.'}
          </p>
          <button type="button" onClick={demarrer} className="btn-primary">
            {isArabic ? 'بدء التحقق' : 'Démarrer la vérification'}
          </button>
        </>
      )}

      {(etape === 'piece' || etape === 'visage' || etape === 'calcul') && (
        <>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-2)' }}>
            {etape === 'piece'
              ? (isArabic
                ? 'ضع بطاقة هويتك داخل الإطار، مع إضاءة جيدة وبدون انعكاس.'
                : 'Placez votre pièce d’identité dans le cadre, bien éclairée et sans reflet.')
              : (isArabic
                ? 'انظر مباشرة إلى الكاميرا، بوجه مكشوف وإضاءة كافية.'
                : 'Regardez l’objectif, visage dégagé et bien éclairé.')}
          </p>

          <div className={cadre} style={{ aspectRatio: '4 / 3' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: etape === 'visage' ? 'scaleX(-1)' : undefined }}
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={occupe || etape === 'calcul'}
              onClick={etape === 'piece' ? capturerPiece : capturerVisage}
              className="btn-primary"
            >
              {etape === 'calcul'
                ? (isArabic ? 'جارٍ المقارنة…' : 'Comparaison…')
                : occupe
                  ? (isArabic ? 'جارٍ التحليل…' : 'Analyse…')
                  : etape === 'piece'
                    ? (isArabic ? 'التقاط البطاقة' : 'Capturer la pièce')
                    : (isArabic ? 'التقاط الوجه' : 'Capturer mon visage')}
            </button>
            <button type="button" onClick={recommencer} className="btn-secondary">
              {isArabic ? 'إلغاء' : 'Annuler'}
            </button>
          </div>
        </>
      )}

      {etape === 'resultat' && (
        <>
          <p
            className="text-sm font-semibold rounded-lg px-3 py-2.5 mb-3"
            style={{
              background: verifie ? '#E7F5EE' : '#FDECEA',
              color: verifie ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {verifie
              ? (isArabic ? 'الوجه يطابق البطاقة.' : 'Le visage correspond à la pièce.')
              : alerteFactice
                ? (isArabic ? 'يبدو أن الصورة مأخوذة من شاشة أو ورق.' : 'L’image semble provenir d’un écran ou d’un papier.')
                : (isArabic ? 'لم نتمكن من تأكيد المطابقة.' : 'La correspondance n’a pas pu être confirmée.')}
          </p>

          <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--ink-3)' }}>
            {isArabic
              ? `درجة التشابه: ${Math.round(score * 100)}%. هذا التحقق يساعد فريقنا فقط، ولا يحل محل فحص الملف. صورة البطاقة صغيرة وقديمة أحيانًا، والرفض لا يعني أي اتهام: يمكنك إرسال طلبك على كل حال.`
              : `Similarité : ${Math.round(score * 100)} %. Ce contrôle aide notre équipe, il ne remplace pas l’examen du dossier. La photo d’une pièce est petite et parfois ancienne : un refus n’accuse personne, vous pouvez envoyer votre demande malgré tout.`}
          </p>

          <button type="button" onClick={recommencer} className="btn-secondary">
            {isArabic ? 'إعادة المحاولة' : 'Recommencer'}
          </button>
        </>
      )}

      {erreur && (
        <p role="alert" className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{erreur}</p>
      )}
    </div>
  );
}
