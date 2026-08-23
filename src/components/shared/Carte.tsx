import type { ReactNode } from 'react';

/**
 * Le vocabulaire visuel des pages « un rendez-vous en main ».
 *
 * ── Pourquoi ce fichier ──
 *
 * Quatre écrans — la place qui se libère, l'annulation par lien, la
 * réservation devant la porte, l'inscription en liste d'attente — étaient
 * quatre fois le même rectangle blanc centré, avec des emojis en guise
 * d'icônes et de l'ambre qui n'existe nulle part dans la charte.
 *
 * Ils tiennent pourtant tous le même objet : la carte de rendez-vous. Elle
 * est définie ici une fois, et son dessin vit dans index.css sous
 * `.carte-rdv` — pas dans une pile de classes utilitaires recopiées.
 */

/* ── Les icônes ──────────────────────────────────────────────────────
   Le même trait que le jeu de SearchResults : 24 px, 1,75 d'épaisseur,
   extrémités arrondies. Un emoji change de dessin selon l'appareil et
   n'accepte pas `currentColor` ; ces traits-là suivent l'encre. */

const TRAITS: Record<string, ReactNode> = {
  cloche: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  horloge: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  coche: <path d="m20 6-11 11-5-5" />,
  calendrier: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  lienRompu: <><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 0 1 3.5 8.5" /><path d="m2 2 20 20" /></>,
  alerte: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></>,
  video: <><path d="m16 10 4.6-2.3A1 1 0 0 1 22 8.6v6.8a1 1 0 0 1-1.4.9L16 14" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
};

export function Icone({ nom, className = 'w-5 h-5' }: { nom: keyof typeof TRAITS | string; className?: string }) {
  return (
    <svg
      className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {TRAITS[nom]}
    </svg>
  );
}

/**
 * Le cartouche d'en-tête : une icône cerclée et un titre.
 *
 * Le cercle est teinté, jamais plein — un aplat de couleur en haut de page
 * tire l'œil vers un ornement au lieu de la phrase qui explique pourquoi on
 * est là.
 */
export function Entete({ icone, titre, ton = 'accent' }: {
  icone: string; titre: string; ton?: 'accent' | 'succes' | 'sourdine';
}) {
  const encre = ton === 'succes' ? 'var(--success)' : ton === 'sourdine' ? 'var(--ink-3)' : 'var(--accent)';
  return (
    <div className="flex items-center gap-3 mb-5">
      <span
        className="flex-shrink-0 grid place-items-center"
        style={{
          width: 40, height: 40, borderRadius: 'var(--r-md)',
          background: ton === 'accent' ? 'var(--accent-bg)' : 'var(--tint-05)',
          color: encre,
        }}
      >
        <Icone nom={icone} />
      </span>
      <h1
        className="text-xl leading-tight"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}
      >
        {titre}
      </h1>
    </div>
  );
}

/**
 * La carte elle-même : souche, perforation, corps.
 *
 * L'heure occupe le corps à une taille qu'aucun autre élément n'atteint.
 * C'est la seule information qu'on vient chercher — le praticien, on le
 * connaît déjà, et l'adresse ne sert qu'une fois qu'on a décidé d'y aller.
 */
export function CarteRdv({
  praticien, specialite, date, heure, adresse, isArabic, annulee = false, children,
}: {
  praticien: string; specialite: string; date: string; heure: string;
  adresse?: string | null; isArabic: boolean; annulee?: boolean; children?: ReactNode;
}) {
  const jour = new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00`));

  return (
    /* Une carte annulée porte son état sur elle — l'heure barrée, l'encre
       retombée — au lieu d'une bannière posée à côté. Le carton reste
       lisible : on veut pouvoir vérifier QUEL rendez-vous on vient de
       libérer. */
    <article className="carte-rdv">
      <header className="carte-rdv-souche" style={annulee ? { background: 'var(--tint-05)' } : undefined}>
        <p className="text-[15px] leading-snug" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {praticien}
        </p>
        <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {specialite}
        </p>
      </header>

      <div className="carte-rdv-perfo" />

      <div className="carte-rdv-corps">
        <p className="carte-rdv-jour">{jour}</p>
        <p
          className="carte-rdv-heure mt-1"
          style={annulee ? { color: 'var(--ink-3)', textDecoration: 'line-through', textDecorationThickness: 2 } : undefined}
        >
          {heure}
        </p>

        {adresse && (
          <p
            className="flex items-start gap-2 mt-4 text-[13px] leading-relaxed"
            style={{ color: 'var(--ink-2)' }}
          >
            <Icone nom="pin" className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{adresse}</span>
          </p>
        )}

        {children}
      </div>
    </article>
  );
}

/**
 * Le décompte d'une place retenue.
 *
 * Il vit DANS la carte, sous un filet : ce n'est pas un avertissement posé
 * à côté, c'est une propriété de ce rendez-vous-là. Pas d'ambre — la charte
 * ne déclare que deux couleurs hors marque, et « il vous reste une heure »
 * n'est pas une erreur. L'urgence se lit à l'échelle du nombre.
 */
export function Decompte({ heures, minutes, isArabic }: { heures: number; minutes: number; isArabic: boolean }) {
  return (
    /* Filet plein, pas pointillé : la perforation est le seul pointillé de
       la carte, sinon elle cesse de se lire comme une découpe. */
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--tint-10)' }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        {isArabic ? 'محجوز لك' : 'Retenu pour vous encore'}
      </p>
      <p
        className="text-[22px] mt-1 tabular-nums"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}
      >
        {heures > 0 && `${heures} h `}{minutes} min
      </p>
    </div>
  );
}

/* ── Le cadre de page ───────────────────────────────────────────────── */

export function PageCarte({ children, isArabic }: { children: ReactNode; isArabic: boolean }) {
  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center p-4 py-10"
      style={{ background: 'var(--bg-2)' }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

/* ── Les boutons ─────────────────────────────────────────────────────
   Rayon `--r-md`, pas le rayon maximal : la pilule intégrale sur un bouton
   pleine largeur est le tic le plus reconnaissable de la maquette générée.
   Le libellé est en casse de phrase — une petite capitale espacée sur un
   bouton d'action se lit plus lentement, ce qui est exactement l'inverse de
   ce qu'on veut au moment de décider. */

const BASE = 'w-full inline-flex items-center justify-center gap-2 px-5 text-[15px] transition-colors '
  + 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-55';

export function Bouton({
  onClick, children, type = 'button', variante = 'plein', disabled, className = '',
}: {
  onClick?: () => void; children: ReactNode; type?: 'button' | 'submit';
  variante?: 'plein' | 'contour' | 'discret' | 'danger'; disabled?: boolean; className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    plein: { background: 'var(--accent)', color: '#FFFFFF' },
    contour: { background: 'var(--bg)', color: 'var(--ink-2)', boxShadow: 'inset 0 0 0 1px var(--tint-20)' },
    discret: { background: 'transparent', color: 'var(--ink-3)' },
    danger: { background: 'var(--bg)', color: 'var(--danger)', boxShadow: 'inset 0 0 0 1px rgba(180,35,24,.28)' },
  };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`${BASE} ${variante === 'discret' ? 'py-2.5' : 'py-3.5'} ${className}`}
      style={{
        borderRadius: 'var(--r-md)', fontWeight: 600,
        outlineColor: 'var(--accent)', ...styles[variante],
      }}
    >
      {children}
    </button>
  );
}

/** Un message d'erreur. Il nomme ce qui s'est passé, sans s'excuser. */
export function Alerte({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 p-3.5 mb-4 text-[13px] leading-relaxed"
      style={{
        borderRadius: 'var(--r-md)', color: 'var(--danger)',
        background: 'rgba(180,35,24,.05)', boxShadow: 'inset 0 0 0 1px rgba(180,35,24,.18)',
      }}
    >
      <Icone nom="alerte" className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** L'attente du réseau. */
export function Chargement({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="text-center py-12">
      <div
        className="inline-block w-7 h-7 rounded-full animate-spin"
        style={{ border: '2px solid var(--tint-20)', borderTopColor: 'var(--accent)' }}
      />
      <p className="text-[13px] mt-3" style={{ color: 'var(--ink-3)' }}>
        {isArabic ? 'جارٍ التحميل…' : 'Chargement…'}
      </p>
    </div>
  );
}
