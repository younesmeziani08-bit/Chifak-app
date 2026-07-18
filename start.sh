#!/bin/bash

echo "================================================"
echo "      CHIFAK - Démarrage de l'application"
echo "================================================"
echo ""

echo "[1/2] Démarrage du serveur backend..."
echo ""
cd server
gnome-terminal -- bash -c "echo 'Backend chifak' && npm start; exec bash" 2>/dev/null || \
xterm -e "echo 'Backend chifak' && npm start" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && echo \"Backend chifak\" && npm start"' 2>/dev/null || \
(npm start &)
cd ..

sleep 3

echo "[2/2] Démarrage du frontend..."
echo ""
gnome-terminal -- bash -c "echo 'Frontend chifak' && npm run dev; exec bash" 2>/dev/null || \
xterm -e "echo 'Frontend chifak' && npm run dev" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && echo \"Frontend chifak\" && npm run dev"' 2>/dev/null || \
npm run dev

echo ""
echo "================================================"
echo "  Application chifak démarrée avec succès!"
echo "================================================"
echo ""
echo "  Backend  : http://localhost:3001"
echo "  Frontend : http://localhost:5173"
echo ""
