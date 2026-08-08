/**
 * Tracé décoratif de la section « D'Alger à Tamanrasset ».
 *
 * Deux repères — Alger au nord, Tamanrasset au sud — reliés par une ligne qui
 * traverse la composition. Autour, quelques traits plus fins : le souffle et
 * le sable, la distance entre les deux points.
 *
 * Trois règles ont guidé le dessin :
 *
 * 1. Il passe DERRIÈRE le texte, jamais devant. Opacités basses, aucun trait
 *    épais sous les lignes de lecture : le titre et la consigne doivent rester
 *    aussi lisibles qu'avant.
 * 2. Il est purement décoratif — `aria-hidden` et `pointer-events: none`. Un
 *    lecteur d'écran ne l'annonce pas, et il n'intercepte aucun clic destiné
 *    aux pastilles de wilaya.
 * 3. Il se dessine une fois à l'arrivée, puis ne bouge plus. Une décoration qui
 *    s'agite en continu détourne l'œil du contenu, et l'animation est coupée
 *    net pour qui demande moins de mouvement.
 */
export default function TraceDuTerritoire() {
  return (
    <svg
      className="trace-territoire"
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* ── Le trajet : Alger, en haut à gauche, vers Tamanrasset, en bas à
             droite. Nord vers sud, comme sur une carte. ── */}
      <path
        className="trace-route"
        d="M 322 96 C 470 150, 560 96, 700 118 S 940 236, 1074 316"
        stroke="rgba(226,239,255,0.34)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />

      {/* ── Souffles : traits libres, de plus en plus ténus vers le bas. ── */}
      <path
        className="trace-souffle"
        d="M 388 60 C 500 24, 604 44, 690 72"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        className="trace-souffle"
        d="M 622 186 C 700 214, 782 208, 850 178"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        className="trace-souffle"
        d="M 806 300 C 900 344, 1010 330, 1096 286 S 1272 226, 1368 244"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        className="trace-souffle"
        d="M 742 356 C 812 396, 902 392, 968 356"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        className="trace-souffle"
        d="M 148 268 C 226 300, 318 296, 386 262"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* ── Alger ── */}
      <g className="trace-repere">
        <path d="M 310 84 L 336 108 M 336 84 L 310 108" stroke="#C96A4E" strokeWidth="1.75" strokeLinecap="round" />
      </g>

      {/* ── Tamanrasset ── */}
      <g className="trace-repere">
        <path d="M 1062 304 L 1088 328 M 1088 304 L 1062 328" stroke="#C96A4E" strokeWidth="1.75" strokeLinecap="round" />
      </g>
    </svg>
  );
}
