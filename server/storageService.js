import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, 'temp_db', 'accounts');

/**
 * Sauvegarde un compte dans le dossier temporaire
 * @param {Object} account - Les données du compte
 */
export function saveAccountToFile(account) {
  try {
    // S'assurer que le dossier existe (au cas où)
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Utiliser l'email ou l'id comme nom de fichier pour l'unicité
    const fileName = `${account.email.replace(/[^a-z0-9]/gi, '_')}.json`;
    const filePath = path.join(STORAGE_DIR, fileName);

    // Ajouter un horodatage de sauvegarde
    const dataToSave = {
      ...account,
      saved_at: new Date().toISOString()
    };

    // Écriture du fichier JSON
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log(`✅ Compte sauvegardé dans le dossier temporaire : ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde du compte dans le dossier :', error);
    return false;
  }
}

/**
 * Récupère tous les comptes sauvegardés dans le dossier
 * @returns {Array} Liste des comptes
 */
export function getAllStoredAccounts() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) return [];
    
    const files = fs.readdirSync(STORAGE_DIR);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const content = fs.readFileSync(path.join(STORAGE_DIR, file), 'utf8');
        return JSON.parse(content);
      });
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des comptes :', error);
    return [];
  }
}
