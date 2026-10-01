# Serwer GridWorld na VPS

Serwer dedykowany to jeden program Node (`server/main.mjs`), który na jednym porcie podaje graczom samą grę (przeglądarka) i obsługuje tryb wieloosobowy (`/mp`). Świat należy do serwera: ma stałe ziarno i własny zegar, który chodzi także wtedy, gdy nikt nie gra. Ziarno i zegar zapisują się w `server/data/server.json` co 30 sekund i przy zatrzymaniu.

Gracze nie instalują niczego: otwierają adres serwera w przeglądarce, wpisują imię bohatera i klikają **Join the server**, potem **Play**.

## Instalacja na VPS (Ubuntu / Debian), jedna komenda

Na świeżym VPS-ie (min. 1 GB RAM, Node instaluje się sam), jako root:

```
curl -fsSL https://raw.githubusercontent.com/MrFischoeder/Gridworld/claude/new-session-lkzluz/deploy/install.sh | sudo bash
```

Na końcu skrypt wypisze adres, np. `http://203.0.113.10:8080/`. To ten adres podajesz znajomym.

Ustawienia (opcjonalne) podaje się przed `bash`, np.:

```
curl -fsSL .../deploy/install.sh | sudo SERVER_NAME="Serwer Kuby" WORLD_SEED=12345 PORT=8080 bash
```

- `SERVER_NAME` – nazwa widoczna w menu gry,
- `WORLD_SEED` – ziarno świata (czytane tylko przy pierwszym starcie; potem obowiązuje zapisane, chyba że `FORCE_SEED=1`),
- `PORT` – port (domyślnie 8080; trzeba go otworzyć w zaporze dostawcy VPS-a, jeśli ma własną),
- `DOMAIN` – domena skierowana na VPS (rekord A). Wtedy skrypt stawia Caddy z darmowym certyfikatem i gra działa pod `https://twoja-domena/` (porty 80 i 443).

## Obsługa

- aktualizacja do najnowszej wersji gry: uruchom tę samą komendę jeszcze raz (świat i zegar zostają),
- logi: `journalctl -u gridworld -f`,
- restart / stop: `systemctl restart gridworld`, `systemctl stop gridworld`,
- stan: `curl http://localhost:8080/mp/info` (nazwa, świat, kto jest online).

## Docker (zamiast skryptu)

```
docker build -t gridworld .
docker run -d --name gridworld -p 8080:8080 -v gridworld-data:/app/server/data --restart unless-stopped gridworld
```

## Ręcznie

```
git clone -b claude/new-session-lkzluz https://github.com/MrFischoeder/Gridworld.git && cd Gridworld
npm ci && npm run build
PORT=8080 SERVER_NAME="Mój serwer" npm run serve
```

## Czego jeszcze nie ma

- Postać gracza zapisuje się w jego przeglądarce (dla adresu serwera osobno niż przy grze lokalnej), nie na serwerze.
- Wrogowie, łupy, skrzynie, wioski, pojazdy i łodzie nie są wspólne: każdy gracz ma swoje. Wspólne są świat (ziarno), zegar, pozycje graczy i czat.
- Brak haseł i kont: każdy, kto zna adres, może dołączyć (do 8 graczy naraz).
