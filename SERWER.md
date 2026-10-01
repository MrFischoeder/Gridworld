# Serwer GridWorld na VPS

Serwer dedykowany to jeden program Node (`server/main.mjs`), który na jednym porcie podaje graczom samą grę (przeglądarka) i obsługuje tryb wieloosobowy (`/mp`). Świat należy do serwera: ma stałe ziarno i własny zegar, który chodzi także wtedy, gdy nikt nie gra. Ziarno i zegar zapisują się w `server/data/server.json` co 30 sekund i przy zatrzymaniu.

Gracze nie instalują niczego: otwierają adres serwera w przeglądarce, wpisują imię bohatera i klikają **Join the server**, potem **Play**.

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
- Wrogowie, łupy, skrzynie, wioski, pojazdy i łodzie nie są wspólne: każdy gracz ma swoje. Wspólne są świat (ziarno), zegar, pozycje graczy i czat.
- Brak haseł i kont: każdy, kto zna adres, może dołączyć (do 8 graczy naraz).
