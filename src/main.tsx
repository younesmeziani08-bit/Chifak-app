import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { DoctorsProvider } from "./contexts/DoctorsContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <AdminAuthProvider>
        <DoctorsProvider>
          <App />
        </DoctorsProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  </StrictMode>
);
