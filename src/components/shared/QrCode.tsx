import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QR code produit ICI, dans le navigateur.
 *
 * ── Pourquoi ne plus passer par un service en ligne ──
 *
 * L'écran des employés fabriquait son QR en appelant api.qrserver.com, avec
 * le lien complet dans l'adresse — jeton d'avis compris. Ce jeton est
 * permanent : les journaux de ce service tiers contenaient donc un lien
 * fonctionnel vers la page d'avis de chaque employé, et rien ne les en
 * délogeait jamais.
 *
 * L'écran de double authentification refusait déjà ce service pour cette
 * raison exacte — il affiche le secret en toutes lettres plutôt que de le
 * confier à quelqu'un d'autre. La même règle vaut ici.
 *
 * Effet de bord bienvenu : le QR s'affiche même sans réseau, et l'impression
 * ne dépend plus de la disponibilité d'un tiers.
 *
 * Il vit dans src/components/shared/ et non dans admin/ : le QR sert
 * désormais aux deux applications — l'administration l'imprime pour les
 * employés, et le praticien imprime le sien depuis son espace. L'application
 * patiente n'a pas le droit d'importer depuis admin/, et `npm run contrats`
 * le vérifie.
 *
 * Le rendu est un SVG d'un seul chemin — un rectangle par module noir. Plus
 * léger qu'une grille de <rect>, et net à n'importe quelle taille, ce qui
 * compte pour un code destiné à être imprimé puis scanné.
 */

interface Props {
  /** Contenu encodé — ici, l'adresse de la page d'avis. */
  valeur: string;
  /** Côté du carré, en pixels. */
  taille?: number;
  /** Texte de remplacement, lu par les lecteurs d'écran. */
  alt: string;
  className?: string;
}

export default function QrCode({ valeur, taille = 220, alt, className }: Props) {
  const chemin = useMemo(() => {
    /* Type 0 = la bibliothèque choisit la plus petite version qui contient
       les données. Correction « M » : 15 % de redondance, le compromis usuel
       pour un code imprimé qu'on scanne de près. */
    const qr = qrcode(0, 'M');
    qr.addData(valeur);
    qr.make();

    const n = qr.getModuleCount();
    const morceaux: string[] = [];
    for (let ligne = 0; ligne < n; ligne++) {
      for (let colonne = 0; colonne < n; colonne++) {
        if (qr.isDark(ligne, colonne)) {
          morceaux.push(`M${colonne},${ligne}h1v1h-1z`);
        }
      }
    }
    return { d: morceaux.join(''), n };
  }, [valeur]);

  /* Marge tranquille de 4 modules : la norme l'exige, et sans elle beaucoup
     de lecteurs échouent quand le code touche un bord sombre. */
  const marge = 4;
  const cote = chemin.n + marge * 2;

  return (
    <svg
      role="img"
      aria-label={alt}
      width={taille}
      height={taille}
      viewBox={`0 0 ${cote} ${cote}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={cote} height={cote} fill="#ffffff" />
      <g transform={`translate(${marge},${marge})`}>
        <path d={chemin.d} fill="#000000" />
      </g>
    </svg>
  );
}
