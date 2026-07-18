import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour détecter si l'utilisateur est sur un appareil mobile.
 * Basé sur la largeur de la fenêtre (seuil standard de 768px pour les tablettes/mobiles).
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Détection par largeur d'écran (standard responsive)
      const isMobileWidth = window.innerWidth < 768;
      
      // Détection par User Agent (optionnel mais plus précis pour certains cas)
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      setIsMobile(isMobileWidth || isMobileUA);
    };

    // Vérification initiale
    checkDevice();

    // Écouter le redimensionnement
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
}
