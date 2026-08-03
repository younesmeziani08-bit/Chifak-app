import { useId } from 'react';

/* chifak brand mark — heart embracing a caregiver + patient, with a pulse line. */
export default function LogoMark({ className = 'w-9 h-9', pulseColor = '#0e86c4' }: { className?: string; pulseColor?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} role="img" aria-label="chifak">
      <defs>
        <linearGradient id={id} x1="12" y1="16" x2="84" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6574F8" />
          <stop offset="0.55" stopColor="#0e86c4" />
          <stop offset="1" stopColor="#0a5a9c" />
        </linearGradient>
      </defs>
      <path d="M48 84 C22 64 9 51 9 34.5 C9 23 18 15.5 27.5 15.5 C36 15.5 43.5 20.5 48 28 C52.5 20.5 60 15.5 68.5 15.5 C78 15.5 87 23 87 34.5 C87 51 74 64 48 84 Z" fill={`url(#${id})`} />
      <path d="M48 70.5 C30.5 57 22 48 22 37.4 C22 30 27.3 25 33.6 25 C39.4 25 44.2 28.4 48 34.2 C51.8 28.4 56.6 25 62.4 25 C68.7 25 74 30 74 37.4 C74 48 65.5 57 48 70.5 Z" fill="#eef6fc" />
      <g fill={`url(#${id})`}>
        <circle cx="41.5" cy="44.5" r="4.6" />
        <path d="M31.5 60.5 a10 10 0 0 1 20 0 Z" />
        <circle cx="56.5" cy="47.5" r="3.6" />
        <path d="M49.5 60.5 a7.5 7.5 0 0 1 15 0 Z" />
      </g>
      <path d="M30 35 h4.5 l2.5 -6.5 3.8 12 2.6 -7 h5.1" stroke={pulseColor} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
