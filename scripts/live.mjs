#!/usr/bin/env node
/**
 * Prépare le rechargement à chaud sur téléphone.
 *
 * Trouve l'adresse de l'ordinateur sur le réseau local, la place dans
 * CAP_SERVER_URL, puis lance `cap sync`. L'application installée sur le
 * téléphone chargera alors son interface depuis le serveur Vite : chaque
 * modification apparaît en une seconde, sans reconstruire ni réinstaller.
 *
 * Pourquoi détecter l'adresse plutôt que la demander : elle change à chaque
 * réseau — maison, bureau, partage de connexion. Une adresse saisie à la main
 * est une adresse qu'on oublie de mettre à jour, et l'application affiche
 * alors un écran blanc sans dire pourquoi.
 */
import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 5173;

/** Adresse IPv4 de l'ordinateur sur le réseau local, hors interfaces virtuelles. */
function adresseLocale() {
  const candidats = [];
  for (const [nom, liens] of Object.entries(networkInterfaces())) {
    // Docker, VPN et machines virtuelles créent des interfaces que le
    // téléphone ne peut pas joindre. On les écarte.
    if (/^(docker|br-|veth|utun|vmnet|bridge|llw|awdl)/i.test(nom)) continue;
    for (const lien of liens || []) {
      if (lien.family !== 'IPv4' || lien.internal) continue;
      candidats.push({ nom, adresse: lien.address });
    }
  }
  if (candidats.length === 0) return null;

  // Le Wi-Fi d'abord : c'est le réseau que partage le téléphone.
  const wifi = candidats.find((c) => /^(en0|wlan|wl)/i.test(c.nom));
  return (wifi || candidats[0]).adresse;
}

const ip = adresseLocale();
if (!ip) {
  console.error('\n❌ Aucune adresse réseau trouvée. Es-tu connecté au Wi-Fi ?\n');
  process.exit(1);
}

const url = `http://${ip}:${PORT}`;

console.log('');
console.log('┌────────────────────────────────────────────────────────┐');
console.log('│  Rechargement à chaud                                  │');
console.log('└────────────────────────────────────────────────────────┘');
console.log(`  Adresse servie au téléphone : ${url}`);
console.log('');
console.log('  Le téléphone doit être sur le MÊME Wi-Fi que ce Mac.');
console.log('  Laisse « npm run dev » tourner dans un autre terminal.');
console.log('');

const r = spawnSync('npx', ['cap', 'sync'], {
  stdio: 'inherit',
  env: { ...process.env, CAP_SERVER_URL: url },
});

if (r.status !== 0) process.exit(r.status ?? 1);

console.log('');
console.log('  ✅ Configuration appliquée. Ouvre le projet :');
console.log('       npm run cap:ios');
console.log('');
console.log('  Puis dans Xcode : choisis ton iPhone en haut, et appuie sur ▶.');
console.log('');
console.log('  ⚠️  Pour revenir à une version normale (autonome), relance :');
console.log('       npm run cap:sync');
console.log('');
