import { useState } from 'react';
import { Doctor } from '../App';
import { getDoctorPhoto, doctorInitials } from '../utils/doctorPhoto';

interface Props {
  doctor: Pick<Doctor, 'id' | 'name' | 'image'>;
  className?: string;
  rounded?: string;
}

/** Photo du médecin avec repli sur les initiales si l'image ne charge pas. */
export default function DoctorAvatar({ doctor, className = 'w-24 h-24', rounded = 'rounded-2xl' }: Props) {
  const [failed, setFailed] = useState(false);
  const src = getDoctorPhoto(doctor);

  if (failed) {
    return (
      <div
        className={`${className} ${rounded} flex items-center justify-center bg-blue-50 text-blue-700 font-semibold select-none`}
        style={{ fontSize: '1.4rem' }}
      >
        {doctorInitials(doctor.name)}
      </div>
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
