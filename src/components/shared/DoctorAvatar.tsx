import { useState } from 'react';
import { Doctor } from '../../App';
import { getDoctorPhoto, doctorInitials, doctorMonogramColors } from '../../utils/doctorPhoto';

interface Props {
  doctor: Pick<Doctor, 'id' | 'name' | 'image'>;
  className?: string;
  rounded?: string;
}

/**
 * Photo du praticien si elle existe réellement, sinon monogramme déterministe.
 * Le monogramme sert aussi de repli si l'image ne charge pas.
 */
export default function DoctorAvatar({ doctor, className = 'w-24 h-24', rounded = 'rounded-2xl' }: Props) {
  const [failed, setFailed] = useState(false);
  const src = getDoctorPhoto(doctor);

  if (!src || failed) {
    const { bg, fg } = doctorMonogramColors(doctor);
    return (
      // SVG : les initiales se redimensionnent avec la boîte, quelle que soit sa taille
      <svg
        className={`${className} ${rounded} select-none`}
        viewBox="0 0 100 100"
        role="img"
        aria-label={doctor.name}
      >
        <rect width="100" height="100" fill={bg} />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fill={fg}
          fontSize="38"
          fontWeight="600"
          fontFamily='"Source Serif 4", "Iowan Old Style", Georgia, serif'
          letterSpacing="0.5"
        >
          {doctorInitials(doctor.name)}
        </text>
      </svg>
    );
  }

  return (
    <img
      src={src}
      alt={doctor.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} ${rounded} object-cover bg-gray-100`}
    />
  );
}
