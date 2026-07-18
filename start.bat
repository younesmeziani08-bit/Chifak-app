@echo off
echo ================================================
echo      CHIFAK - Demarrage de l'application
echo ================================================
echo.

echo [1/2] Demarrage du serveur backend...
echo.
cd server
start cmd /k "echo Backend chifak && npm start"
cd ..

timeout /t 3 /nobreak > nul

echo [2/2] Demarrage du frontend...
echo.
start cmd /k "echo Frontend chifak && npm run dev"

echo.
echo ================================================
echo  Application chifak demarree avec succes!
echo ================================================
echo.
echo  Backend  : http://localhost:3001
echo  Frontend : http://localhost:5173
echo.
echo  Appuyez sur une touche pour fermer cette fenetre
pause > nul
