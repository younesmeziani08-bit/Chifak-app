import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { DoctorsProvider } from "./contexts/DoctorsContext";

/* Le fournisseur d'administration a quitté ce point d'entrée : l'espace
   d'administration est désormais une application distincte (voir admin/).
   Le garder ici aurait suffi à réintroduire son code dans le paquet livré à
   chaque patient. */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
        <DoctorsProvider>
          <App />
        </DoctorsProvider>
    </LanguageProvider>
  </StrictMode>
);
