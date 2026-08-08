import { useState, useEffect, useMemo, useRef } from 'react';
import leblad from '@dzcode-io/leblad';
import { useLanguage } from '../../contexts/LanguageContext';

interface LocationSelectorProps {
  onLocationChange: (location: string) => void;
  onWilayaChange?: (wilaya: { code: number; name: string; nameAr: string } | null) => void;
  onDairaChange?: (daira: { name: string; communes: string[] } | null) => void;
  onCommuneChange?: (name: string | null) => void;
  showWilayaLabel?: boolean;
  selectVariant?: 'default' | 'hero';
  /**
   * Wilaya imposée de l'extérieur (raccourcis « D'Alger à Tamanrasset »).
   * Le composant reste maître de son état : cette valeur ne fait que le
   * pousser vers une sélection, sans casser la navigation daïra/commune.
   */
  wilayaName?: string | null;
}

interface Wilaya {
  code: number;
  name: string;
  nameAr: string;
}

interface Daira {
  id: number;
  name: string;
  nameAr: string;
}

interface Commune {
  id: number;
  name: string;
  nameAr: string;
}

export default function LocationSelector({
  onLocationChange,
  onWilayaChange,
  onDairaChange,
  onCommuneChange,
  showWilayaLabel = true,
  selectVariant = 'default',
  wilayaName = null,
}: LocationSelectorProps) {
  const { language } = useLanguage();
  const [selectedWilaya, setSelectedWilaya] = useState<Wilaya | null>(null);
  const [selectedDaira, setSelectedDaira] = useState<Daira | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<Commune | null>(null);
  
  const isArabic = language === 'ar';
  const selectClassName =
    selectVariant === 'hero'
      ? 'field-native cursor-pointer'
      : 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const wilayas = useMemo<Wilaya[]>(() => {
    const api = (leblad as any);
    const list = api.getWilayaList?.(['mattricule', 'name', 'name_ar']) || [];
    return list
      // Keep the historical 48 wilayas scope (227 dairas / 1541 communes)
      .filter((w: any) => Number(w.mattricule) >= 1 && Number(w.mattricule) <= 48)
      .map((w: any) => ({
        code: Number(w.mattricule),
        name: w.name,
        nameAr: w.name_ar,
      }))
      .sort((a: Wilaya, b: Wilaya) => a.code - b.code);
  }, []);

  const dairas = useMemo<Daira[]>(() => {
    if (!selectedWilaya) return [];
    const api = (leblad as any);
    const list = api.getDairatsForWilaya?.(selectedWilaya.code, ['code', 'name', 'name_ar']) || [];
    return list
      .map((d: any) => ({
        id: Number(d.code),
        name: d.name,
        nameAr: d.name_ar,
      }))
      .sort((a: Daira, b: Daira) => a.name.localeCompare(b.name));
  }, [selectedWilaya]);

  const communes = useMemo<Commune[]>(() => {
    if (!selectedDaira) return [];
    const api = (leblad as any);
    const list = api.getBaladyiatsForDairaCode?.(selectedDaira.id, ['code', 'name', 'name_ar']) || [];
    return list
      .map((c: any) => ({
        id: Number(c.code),
        name: c.name,
        nameAr: c.name_ar,
      }))
      .sort((a: Commune, b: Commune) => a.name.localeCompare(b.name));
  }, [selectedDaira]);

  // On garde une référence stable de la callback pour éviter que sa recréation
  // à chaque frappe du parent ne relance cet effet (boucle de re-rendu qui figeait le formulaire).
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => { onLocationChangeRef.current = onLocationChange; }, [onLocationChange]);

  useEffect(() => {
    if (selectedCommune && selectedWilaya) {
      const communeName = isArabic ? selectedCommune.nameAr : selectedCommune.name;
      const wilayaName = isArabic ? selectedWilaya.nameAr : selectedWilaya.name;
      onLocationChangeRef.current(`${communeName}, ${wilayaName}`);
    } else if (selectedWilaya && !selectedDaira) {
      const wilayaName = isArabic ? selectedWilaya.nameAr : selectedWilaya.name;
      onLocationChangeRef.current(wilayaName);
    }
  }, [selectedCommune, selectedWilaya, selectedDaira, isArabic]);

  /* Synchronisation avec un choix venu d'ailleurs sur la page. On compare par
     nom — la seule donnée que le raccourci connaisse — et on ne réagit que si
     la wilaya diffère réellement, sinon on effacerait la daïra et la commune
     que l'utilisateur vient de choisir. */
  useEffect(() => {
    if (!wilayaName) return;
    if (selectedWilaya?.name === wilayaName) return;
    const trouvee = wilayas.find((w) => w.name === wilayaName) || null;
    if (!trouvee) return;
    setSelectedWilaya(trouvee);
    setSelectedDaira(null);
    setSelectedCommune(null);
  }, [wilayaName, wilayas, selectedWilaya]);

  const handleWilayaChange = (wilayaCode: string) => {
    const wilaya = wilayas.find(w => String(w.code) === wilayaCode) || null;
    setSelectedWilaya(wilaya);
    setSelectedDaira(null);
    setSelectedCommune(null);
    onWilayaChange?.(wilaya ? { code: wilaya.code, name: wilaya.name, nameAr: wilaya.nameAr } : null);
    onDairaChange?.(null);
    onCommuneChange?.(null);
  };

  const handleDairaChange = (dairaId: string) => {
    const daira = dairas.find(d => String(d.id) === dairaId) || null;
    setSelectedDaira(daira);
    setSelectedCommune(null);
    if (daira) {
      const list = (leblad as any).getBaladyiatsForDairaCode?.(daira.id, ['name']) || [];
      onDairaChange?.({ name: daira.name, communes: list.map((c: any) => c.name).filter(Boolean) });
    } else {
      onDairaChange?.(null);
    }
    onCommuneChange?.(null);
  };

  const handleCommuneChange = (communeId: string) => {
    const commune = communes.find(c => String(c.id) === communeId) || null;
    setSelectedCommune(commune);
    onCommuneChange?.(commune ? commune.name : null);
  };

  return (
    <div className="space-y-4">
      {/* Wilaya Selection */}
      <div>
        {showWilayaLabel ? (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'الولاية' : 'Wilaya'}
          </label>
        ) : null}
        <select
          value={selectedWilaya ? String(selectedWilaya.code) : ''}
          onChange={(e) => handleWilayaChange(e.target.value)}
          className={selectClassName}
        >
          <option value="">{isArabic ? 'الولاية' : 'Wilaya'}</option>
          {wilayas.map((wilaya) => (
            <option key={wilaya.code} value={wilaya.code}>
              {wilaya.code} - {isArabic ? wilaya.nameAr : wilaya.name}
            </option>
          ))}
        </select>
      </div>

      {/* Daira Selection */}
      {selectedWilaya && (
        <div className="animate-fadeIn">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'الدائرة' : 'Daïra'}
          </label>
          <select
            value={selectedDaira ? String(selectedDaira.id) : ''}
            onChange={(e) => handleDairaChange(e.target.value)}
            className={selectClassName}
          >
            <option value="">{isArabic ? 'الدائرة' : 'Daïra'}</option>
            {dairas.map((daira) => (
              <option key={daira.id} value={daira.id}>
                {isArabic ? daira.nameAr : daira.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Commune Selection */}
      {selectedDaira && (
        <div className="animate-fadeIn">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'البلدية' : 'Commune'}
          </label>
          <select
            value={selectedCommune ? String(selectedCommune.id) : ''}
            onChange={(e) => handleCommuneChange(e.target.value)}
            className={selectClassName}
          >
            <option value="">{isArabic ? 'البلدية' : 'Commune'}</option>
            {communes.map((commune) => (
              <option key={commune.id} value={commune.id}>
                {isArabic ? commune.nameAr : commune.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
