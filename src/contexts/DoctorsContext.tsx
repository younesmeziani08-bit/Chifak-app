import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Doctor } from '../App';
import { doctorsAPI, DoctorCreate } from '../services/api';

interface DoctorsContextType {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
  addDoctor: (doctor: DoctorCreate) => Promise<void>;
  updateDoctor: (id: number, doctor: Partial<DoctorCreate>) => Promise<void>;
  deleteDoctor: (id: number) => Promise<void>;
  getDoctorsBySpecialtyAndLocation: (specialty: string, location: string) => Doctor[];
  refreshDoctors: () => Promise<void>;
  /** Recherche interrogée en base, sans passer par la liste chargée en mémoire. */
  searchDoctors: (specialty: string, location: string, videoOnly?: boolean, name?: string) => Promise<Doctor[]>;
}

const DoctorsContext = createContext<DoctorsContextType | undefined>(undefined);

/* ── Le « repli hors ligne » a été supprimé ──
 *
 * Quand l'enregistrement d'un praticien échouait — jeton expiré, droits
 * insuffisants, serveur endormi — l'application fabriquait une fiche dans le
 * stockage local du navigateur et annonçait « médecin créé ». L'employé
 * pouvait en saisir dix ; si son jeton avait expiré à la première, les neuf
 * suivantes n'existaient que chez lui, et disparaissaient au premier
 * nettoyage du navigateur. Aucun message, aucune trace.
 *
 * Pire : la recherche fusionnait ces fiches fantômes dans les résultats
 * présentés aux patients. Un praticien qui n'existe nulle part apparaissait
 * comme disponible, et la réservation échouait ensuite sur « médecin non
 * trouvé » — sans que personne comprenne pourquoi.
 *
 * Une écriture qui échoue doit se voir. C'est tout ce qu'on attend d'elle.
 */
const CLE_FICHES_LOCALES = 'chifak_local_doctors';

const normalizeDoctor = (doctor: any): Doctor => ({
  id: doctor.id,
  name: doctor.name,
  specialty: doctor.specialty,
  address: doctor.address,
  city: doctor.city,
  rating: Number(doctor.rating ?? 5),
  reviewCount: Number(doctor.reviewCount ?? doctor.review_count ?? 0),
  image: doctor.image || '👨‍⚕️',
  doctorCode: doctor.doctorCode || doctor.doctor_code,
  hasPassword: doctor.hasPassword ?? !!doctor.password,
  availableSlots: doctor.availableSlots || [],
  nextAvailable: doctor.nextAvailable || doctor.next_available || 'Disponible maintenant',
  slotDuration: Number(doctor.slotDuration ?? doctor.slot_duration ?? 30),
  workingDays: doctor.workingDays || (doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5]),
  offDays: doctor.offDays || (doctor.off_days ? JSON.parse(doctor.off_days) : []),
  blockedSlots: doctor.blockedSlots || (doctor.blocked_slots ? JSON.parse(doctor.blocked_slots) : []),
  acceptsVideo: doctor.acceptsVideo ?? !!doctor.accepts_video,
  videoSlots: doctor.videoSlots || (doctor.video_slots ? JSON.parse(doctor.video_slots) : []),
  description: doctor.description || '',
  bio: doctor.bio || '',
  latitude: doctor.latitude,
  longitude: doctor.longitude,
  mapsUrl: doctor.mapsUrl || doctor.maps_url,
});

export function DoctorsProvider({ children }: { children: ReactNode }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les médecins au démarrage
  const refreshDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      setDoctors((await doctorsAPI.getAll()).map(normalizeDoctor));
    } catch (err) {
      // Liste vide et message d'erreur : mieux vaut « annuaire indisponible »
      // qu'un annuaire partiel qu'on croit complet.
      setDoctors([]);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des médecins');
      console.error('Erreur chargement médecins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Purge des fiches fantômes laissées par l'ancien repli hors ligne.
    try { localStorage.removeItem(CLE_FICHES_LOCALES); } catch { /* stockage indisponible */ }
    refreshDoctors();
  }, []);

  /* Les trois écritures propagent l'erreur. L'appelant l'affiche ; c'est la
     seule façon qu'a un employé de savoir que sa saisie n'a pas abouti. */
  const addDoctor = async (doctorData: DoctorCreate) => {
    const newDoctor = await doctorsAPI.create(doctorData);
    setDoctors((prev) => [...prev, normalizeDoctor(newDoctor)]);
  };

  const updateDoctor = async (id: number, doctorData: Partial<DoctorCreate>) => {
    const updatedDoctor = await doctorsAPI.update(id, doctorData);
    setDoctors((prev) => prev.map((doctor) => (
      doctor.id === id ? normalizeDoctor(updatedDoctor) : doctor
    )));
  };

  const deleteDoctor = async (id: number) => {
    await doctorsAPI.delete(id);
    setDoctors((prev) => prev.filter((doctor) => doctor.id !== id));
  };

  /* Recherche déléguée à la base. Le filtrage en mémoire ne portait que sur les
     médecins déjà chargés — au plus 500 — donc au-delà de ce seuil, une partie
     de l'annuaire devenait tout simplement introuvable, quelle que soit la
     requête du patient. Ici, c'est PostgreSQL qui filtre et pagine. */
  const searchDoctors = async (specialty: string, location: string, videoOnly?: boolean, name?: string): Promise<Doctor[]> => {
    const data = await doctorsAPI.getAll(specialty || undefined, location || undefined, videoOnly, name || undefined);
    return data.map(normalizeDoctor);
  };

  const getDoctorsBySpecialtyAndLocation = (specialty: string, location: string): Doctor[] => {
    return doctors.filter(doctor => {
      const matchesSpecialty = !specialty || doctor.specialty.toLowerCase().includes(specialty.toLowerCase());
      const matchesLocation = !location || doctor.city.toLowerCase().includes(location.toLowerCase());
      return matchesSpecialty && matchesLocation;
    });
  };

  return (
    <DoctorsContext.Provider value={{ 
      doctors, 
      loading,
      error,
      addDoctor, 
      updateDoctor, 
      deleteDoctor,
      getDoctorsBySpecialtyAndLocation,
      refreshDoctors,
      searchDoctors
    }}>
      {children}
    </DoctorsContext.Provider>
  );
}

export function useDoctors() {
  const context = useContext(DoctorsContext);
  if (context === undefined) {
    throw new Error('useDoctors must be used within a DoctorsProvider');
  }
  return context;
}
