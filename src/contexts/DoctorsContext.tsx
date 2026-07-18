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
}

const DoctorsContext = createContext<DoctorsContextType | undefined>(undefined);
const LOCAL_DOCTORS_KEY = 'chifak_local_doctors';

const getLocalDoctors = (): Doctor[] => {
  try {
    const raw = localStorage.getItem(LOCAL_DOCTORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalDoctors = (doctors: Doctor[]) => {
  localStorage.setItem(LOCAL_DOCTORS_KEY, JSON.stringify(doctors));
};

const normalizeDoctor = (doctor: any): Doctor => ({
  id: doctor.id,
  name: doctor.name,
  specialty: doctor.specialty,
  address: doctor.address,
  city: doctor.city,
  rating: Number(doctor.rating ?? 5),
  reviewCount: Number(doctor.reviewCount ?? doctor.review_count ?? 0),
  image: doctor.image || '👨‍⚕️',
  availableSlots: doctor.availableSlots || [],
  nextAvailable: doctor.nextAvailable || doctor.next_available || 'Disponible maintenant',
  slotDuration: Number(doctor.slotDuration ?? doctor.slot_duration ?? 30),
  workingDays: doctor.workingDays || (doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5]),
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
      const data = await doctorsAPI.getAll();
      const local = getLocalDoctors();
      setDoctors([...data.map(normalizeDoctor), ...local.map(normalizeDoctor)]);
    } catch (err) {
      // Fallback local si API indisponible
      const local = getLocalDoctors();
      setDoctors(local.map(normalizeDoctor));
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des médecins');
      console.error('Erreur chargement médecins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDoctors();
  }, []);

  const addDoctor = async (doctorData: DoctorCreate) => {
    try {
      const newDoctor = await doctorsAPI.create(doctorData);
      setDoctors([...doctors, normalizeDoctor(newDoctor)]);
    } catch (err) {
      // Fallback local pour mode démo / API non dispo
      const localDoctor: Doctor = normalizeDoctor({
        id: Date.now(),
        name: doctorData.name,
        specialty: doctorData.specialty,
        address: doctorData.address,
        city: doctorData.city,
        rating: 5,
        reviewCount: 0,
        image: doctorData.image || '👨‍⚕️',
        availableSlots: doctorData.availableSlots || [],
        nextAvailable: doctorData.nextAvailable || 'Disponible maintenant',
        slotDuration: doctorData.slotDuration || 30,
        workingDays: doctorData.workingDays || [1, 2, 3, 4, 5],
        latitude: doctorData.latitude,
        longitude: doctorData.longitude,
        mapsUrl: doctorData.mapsUrl,
      });

      const local = getLocalDoctors();
      const updatedLocal = [...local, localDoctor];
      saveLocalDoctors(updatedLocal);
      setDoctors((prev) => [...prev, localDoctor]);
    }
  };

  const updateDoctor = async (id: number, doctorData: Partial<DoctorCreate>) => {
    try {
      const updatedDoctor = await doctorsAPI.update(id, doctorData);
      setDoctors(doctors.map(doctor => 
        doctor.id === id ? normalizeDoctor(updatedDoctor) : doctor
      ));
    } catch (err) {
      throw err;
    }
  };

  const deleteDoctor = async (id: number) => {
    try {
      await doctorsAPI.delete(id);
      setDoctors(doctors.filter(doctor => doctor.id !== id));
    } catch (err) {
      // Fallback local pour les médecins ajoutés en mode démo/offline
      const local = getLocalDoctors();
      const existsLocally = local.some((doctor) => Number(doctor.id) === Number(id));

      if (existsLocally) {
        const updatedLocal = local.filter((doctor) => Number(doctor.id) !== Number(id));
        saveLocalDoctors(updatedLocal);
        setDoctors((prev) => prev.filter((doctor) => Number(doctor.id) !== Number(id)));
        return;
      }

      throw err;
    }
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
      refreshDoctors
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
