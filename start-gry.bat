@echo off
rem GridWorld - szybkie uruchamianie gry na Windows.
rem Kliknij dwa razy ten plik. Za pierwszym razem instaluje zaleznosci (chwile potrwa).
title GridWorld
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Brak Node.js. Zainstaluj wersje LTS ze strony https://nodejs.org
  echo  a potem uruchom ten plik ponownie.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  Pierwsze uruchomienie: instaluje zaleznosci...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Instalacja nie powiodla sie. Sprawdz polaczenie z internetem.
    pause
    exit /b 1
  )
)

echo.
echo  Uruchamiam GridWorld. Gra otworzy sie w przegladarce.
echo  Aby zakonczyc, zamknij to okno (albo Ctrl+C).
echo.
echo  GRA WIELOOSOBOWA: ten komputer jest serwerem. W menu gry kliknij "Host a game".
echo  Znajomi w tej samej sieci otwieraja w przegladarce adres z linii "Network:" ponizej
echo  (np. http://192.168.1.20:5173) i klikaja "Join". Twoje adresy w sieci lokalnej:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%b in ("%%a") do echo     http://%%b:5173
echo  (Jesli Windows zapyta o zapore, zezwol na dostep w sieci prywatnej.)
echo.
call npm run dev -- --open --strictPort --port 5173 --host
if errorlevel 1 (
  echo.
  echo  Port 5173 jest zajety: prawdopodobnie dziala jeszcze STARA wersja gry.
  echo  Zamknij wszystkie stare okna GridWorld (czarne okna konsoli) i uruchom ten plik ponownie.
  echo.
)
pause
