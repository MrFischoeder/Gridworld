# Serwer GridWorld na VPS

Serwer dedykowany to jeden program Node (`server/main.mjs`), który na jednym porcie podaje graczom samą grę (przeglądarka) i obsługuje tryb wieloosobowy (`/mp`). Na jednej maszynie może stać kilka **serwerów gry** (do 12): pierwszy, główny, nazywa się tak jak `SERVER_NAME`; kolejne zakładają gracze z menu. Każdy ma własny świat (ziarno) i własny zegar.

- Serwer gry **działa, dopóki ktoś na nim jest**. Gdy wyjdzie ostatni gracz, jego zegar staje (pauza) i rusza znowu, gdy ktoś wróci.
- Gracz, który wyjdzie do menu, **nie znika**: jego postać zostaje w świecie z dopiskiem „(in menu)”, a świat toczy się dalej.
- Serwery gry, na które nikt nie wrócił przez 14 dni, są usuwane (główny nigdy).
- **Świat jest wspólny**: wioski, rynki, mosty, pomosty, łodzie, instalacje, Rydwan, skrzynie, ścięte drzewa, obozy bandytów. Serwer zapisuje go w osobnym pliku na każdy serwer gry (`server/data/world-<id>.json`). Pierwszy gracz, który już grał w tym świecie, wnosi swój postęp; potem świat należy do serwera. Osobiste zostają ekwipunek, złoto, poziom, zadania, mapa, pojazdy.
- **Wrogowie są wspólni**: stwory, roboty i bandyci (losowe spotkania, obozy, garnizony miast, napady na wioski, strażnicy wraków). Pierwszy gracz w danym miejscu „prowadzi” wrogów, pozostali widzą ich ruchy i strzały i mogą ich zabijać (zabójstwo i łup dostaje ten, kto zadał ostatni cios). Wrogowie atakują najbliższego gracza.
- Przedmioty położone przez graczy na ziemi (Drop w plecaku) serwer pamięta i pokazuje wszystkim; leżą 6 godzin, także po restarcie.
- Lista, ziarna i zegary zapisują się w `server/data/server.json` co 30 sekund i przy zatrzymaniu.

Gracze nie instalują niczego: otwierają adres serwera w przeglądarce, wpisują imię bohatera, w okienku multiplayer widzą **listę serwerów** (nazwa, ilu gra, czy działa, czy stoi w pauzie) i klikają **Join** przy wybranym, albo wpisują nazwę i klikają **Create a server** (zaznaczone „in my own world” = w świecie z ich zapisu, inaczej nowy świat). Potem **Play**. Po aktualizacji serwera gracze muszą odświeżyć stronę (Ctrl+F5): stara wersja gry dostanie komunikat, żeby to zrobić.

## Instalacja obok innych aplikacji (np. IONOS VPS z portalem)

Skrypt nie rusza niczego, co już jest na serwerze:
- gra ląduje we własnym folderze `/opt/gridworld`, z własnym Node.js w `/opt/gridworld-node` (systemowy Node, jeśli jest, zostaje bez zmian),
- działa jako własny użytkownik i usługa `gridworld`,
- zajmuje jeden port, domyślnie **8517**; jeśli jest zajęty, skrypt przerywa i prosi o inny (`PORT=8518`),
- nie zmienia konfiguracji serwera WWW, proxy, portalu ani zapory.

Jako root (np. w aplikacji Termius na telefonie):

```
curl -fsSL https://raw.githubusercontent.com/MrFischoeder/Gridworld/claude/new-session-lkzluz/deploy/install.sh | sudo SERVER_NAME="Mój serwer" bash
```

Na końcu skrypt wypisze adres i przykład wpisu do proxy. Dwie drogi do gry:

1. **Bezpośrednio:** `http://IP-SERWERA:8517/`, po otwarciu portu TCP 8517 w zasadach zapory IONOS (Sieć → Zasady zapory).
2. **Przez Twój portal / proxy**, np. pod `https://twoja-domena/gridworld/`: dodaj w nim przekierowanie na `http://127.0.0.1:8517/` z włączonymi WebSocketami (gra rozmawia przez `/gridworld/mp`). Dla nginx skrypt wypisuje gotowy blok `location`. Gra działa zarówno gdy proxy obcina przedrostek `/gridworld`, jak i gdy go zostawia. Jeśli gra ma być dostępna tylko przez portal, dodaj `HOST=127.0.0.1` przed `bash`.

Ustawienia (opcjonalne, przed `bash`): `SERVER_NAME` (nazwa w menu), `WORLD_SEED` (ziarno świata, czytane przy pierwszym starcie; potem obowiązuje zapisane, chyba że `FORCE_SEED=1`), `PORT`, `HOST`, `DIR`.

Usunięcie gry (nic innego nie znika): `systemctl disable --now gridworld; rm -rf /opt/gridworld /opt/gridworld-node /etc/systemd/system/gridworld.service; userdel gridworld`.

## Obsługa

- aktualizacja do najnowszej wersji gry: uruchom tę samą komendę jeszcze raz (świat i zegar zostają),
- logi: `journalctl -u gridworld -f`,
- restart / stop: `systemctl restart gridworld`, `systemctl stop gridworld`,
- stan: `curl http://localhost:8517/mp/info` (nazwa, świat, kto jest online).

## Docker (zamiast skryptu)

```
docker build -t gridworld .
docker run -d --name gridworld -p 8517:8517 -v gridworld-data:/app/server/data --restart unless-stopped gridworld
```

## Ręcznie

```
git clone -b claude/new-session-lkzluz https://github.com/MrFischoeder/Gridworld.git && cd Gridworld
npm ci && npm run build
PORT=8517 SERVER_NAME="Mój serwer" npm run serve
```

## Czego jeszcze nie ma

- Postać gracza zapisuje się w jego przeglądarce (dla adresu serwera osobno niż przy grze lokalnej), nie na serwerze.
- Nie są jeszcze wspólne: pojazdy rabusiów, drony w podziemiach i bossowie. Gdy gracz, który prowadził grupę wrogów, wyjdzie z gry, ta grupa znika razem z nim.
- Brak haseł i kont: każdy, kto zna adres, może dołączyć (do 8 graczy naraz na każdym serwerze gry) i założyć nowy serwer gry.
