import { useState } from 'react';
import QrCode from './QrCode';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * L'affichette que le praticien colle sur la porte de son cabinet.
 *
 * ── Ce qu'elle sert ──
 *
 * Un patient s'est déplacé et trouve porte close — le soir, un vendredi, entre
 * midi et deux. Il scanne, voit les créneaux libres, en prend un, et repart
 * avec un rendez-vous. Le créneau disparaît aussitôt de l'application, et le
 * rendez-vous figure dans l'agenda que le praticien reçoit à cinq heures.
 *
 * ── Pourquoi une page d'impression séparée ──
 *
 * Une feuille de style d'impression appliquée à l'écran courant obligerait à
 * masquer tout le reste — en-tête, navigation, onglets — et le moindre oubli
 * ressort sur le papier. On ouvre donc une fenêtre qui ne contient QUE
 * l'affichette, avec ses propres styles. Ce qui s'imprime est exactement ce
 * qu'on a écrit, sans dépendre du reste de l'application.
 *
 * ── Bilingue, et dans cet ordre ──
 *
 * Le texte arabe domine et le français suit. L'affichette est lue par des gens
 * debout dans la rue, en Algérie ; elle doit parler d'abord la langue de la
 * rue. Les deux tiennent sur une seule ligne chacune : personne ne lit un
 * paragraphe sur une porte.
 */

interface Props {
  /** Ce que le QR encode : l'adresse publique du praticien. */
  url: string;
  nomMedecin: string;
  specialite?: string;
  /** Le libellé du bouton change selon l'écran qui l'affiche. */
  libelleBouton?: string;
}

/**
 * Fabrique la page à imprimer.
 *
 * Le QR est passé en SVG déjà rendu : le regénérer dans la fenêtre
 * d'impression demanderait d'y charger la bibliothèque, ce qui ralentit
 * l'ouverture et échoue hors ligne.
 */
function pageImprimable({ svg, nomMedecin, specialite, url }: {
  svg: string; nomMedecin: string; specialite?: string; url: string;
}) {
  const echapper = (t: string) => String(t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${echapper(nomMedecin)} — chifak</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #14192C;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .affiche {
    width: 100%;
    max-width: 170mm;
    text-align: center;
    border: 3px solid #1B3A8F;
    border-radius: 10mm;
    padding: 12mm 10mm;
  }
  .marque { font-size: 30pt; font-weight: 800; color: #1B3A8F; letter-spacing: -0.5pt; }
  .medecin { font-size: 22pt; font-weight: 700; margin-top: 6mm; line-height: 1.2; }
  .specialite { font-size: 13pt; color: #5C6479; margin-top: 2mm; }
  .qr { margin: 9mm auto 7mm; width: 74mm; height: 74mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .consigne-ar { font-size: 17pt; font-weight: 700; direction: rtl; margin-bottom: 2mm; }
  .consigne-fr { font-size: 15pt; font-weight: 600; }
  .details { font-size: 11pt; color: #5C6479; margin-top: 6mm; line-height: 1.6; }
  .url { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9pt; color: #858DA3; margin-top: 4mm; word-break: break-all; }
  @media print { body { min-height: auto; } .affiche { border-color: #1B3A8F; } }
</style>
</head>
<body>
  <div class="affiche">
    <div class="marque">chifak</div>
    <div class="medecin">${echapper(nomMedecin)}</div>
    ${specialite ? `<div class="specialite">${echapper(specialite)}</div>` : ''}
    <div class="qr">${svg}</div>
    <div class="consigne-ar">امسح الرمز لحجز موعد</div>
    <div class="consigne-fr">Scannez pour prendre rendez-vous</div>
    <div class="details">
      Voyez les créneaux libres et réservez en une minute.<br>
      Aucun compte n’est nécessaire.
    </div>
    <div class="url">${echapper(url)}</div>
  </div>
  <script>
    /* On attend le rendu avant d'ouvrir la boîte d'impression : appelée trop
       tôt, elle fige une page encore vide sur certains navigateurs. */
    window.addEventListener('load', () => setTimeout(() => window.print(), 300));
  </script>
</body>
</html>`;
}

export default function AffichettePorte({ url, nomMedecin, specialite, libelleBouton }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [copie, setCopie] = useState(false);

  const imprimer = () => {
    const svg = document.getElementById(`qr-porte-${encodeURIComponent(url)}`)?.innerHTML;
    if (!svg) return;
    const fenetre = window.open('', '_blank', 'width=900,height=1100');
    if (!fenetre) {
      window.alert(isArabic
        ? 'المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
        : 'Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres surgissantes, puis réessayez.');
      return;
    }
    fenetre.document.write(pageImprimable({ svg, nomMedecin, specialite, url }));
    fenetre.document.close();
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt(isArabic ? 'انسخ الرابط :' : 'Copiez le lien :', url);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div
          id={`qr-porte-${encodeURIComponent(url)}`}
          className="flex-shrink-0 rounded-xl border border-gray-200 p-2 bg-white"
        >
          <QrCode
            valeur={url}
            taille={168}
            alt={isArabic
              ? `رمز QR لحجز موعد مع ${nomMedecin}`
              : `QR code pour prendre rendez-vous avec ${nomMedecin}`}
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-start">
          <h4 className="font-bold text-gray-900">
            {isArabic ? 'رمز QR لعيادتك' : 'Le QR code de votre cabinet'}
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed mt-1.5">
            {isArabic
              ? 'اطبعه وألصقه على باب العيادة. من يمرّ أمامها — حتى وهي مغلقة — يمسح الرمز، يرى المواعيد المتاحة، ويحجز في دقيقة.'
              : 'Imprimez-le et collez-le sur la porte de votre cabinet. Quelqu’un qui passe — même porte fermée — scanne, voit vos créneaux libres et réserve en une minute.'}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            {isArabic
              ? 'الموعد المحجوز يختفي فورًا من التطبيق، ويظهر في جدولك الصباحي.'
              : 'Le créneau pris disparaît aussitôt de l’application, et le rendez-vous figure dans l’agenda que vous recevez le matin.'}
          </p>

          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
            <button
              type="button"
              onClick={imprimer}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {libelleBouton || (isArabic ? 'طباعة الملصق' : 'Imprimer l’affichette')}
            </button>
            <button
              type="button"
              onClick={copier}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              {copie
                ? (isArabic ? '✓ تم النسخ' : '✓ Lien copié')
                : (isArabic ? 'نسخ الرابط' : 'Copier le lien')}
            </button>
          </div>

          <p className="text-[11px] font-mono text-gray-400 mt-3 break-all">{url}</p>
        </div>
      </div>
    </div>
  );
}
