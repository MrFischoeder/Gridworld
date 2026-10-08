# Serwer GridWorld na VPS

Serwer dedykowany to jeden program Node (`server/main.mjs`), który na jednym porcie podaje graczom samą grę (przeglądarka) i obsługuje tryb wieloosobowy (`/mp`). Na jednej maszynie może stać kilka **serwerów gry** (do 12): pierwszy, główny, nazywa się tak jak `SERVER_NAME`; kolejne zakładają gracze z menu. Każdy ma własny świat (ziarno) i własny zegar.

- Serwer gry **działa, dopóki ktoś na nim jest**. Gdy wyjdzie ostatni gracz, jego zegar staje (pauza) i rusza znowu, gdy ktoś wróci.
- Gracz, który wyjdzie do menu, **nie znika**: jego postać zostaje w świecie z dopiskiem „(in menu)”, a świat toczy się dalej.
- Serwery gry, na które nikt nie wrócił przez 14 dni, są usuwane (główny nigdy).
- **Świat jest wspólny**: wioski, rynki, mosty, pomosty, łodzie, instalacje, Rydwan, skrzynie, ścięte drzewa, obozy bandytów. Serwer zapisuje go w osobnym pliku na każdy serwer gry (`server/data/world-<id>.json`). Pierwszy gracz, który już grał w tym świecie, wnosi swój postęp; potem świat należy do serwera. Osobiste zostają ekwipunek, złoto, poziom, zadania, mapa, pojazdy.
- **Wszystko w świecie jest wspólne**: także działki graczy z budowlami, warsztaty w terenie i tablice ogłoszeń (zadanie wzięte przez jednego znika u innych), a to, co spada na ziemię (łup z wrogów, kłody, kamienie), leży raz dla wszystkich i bierze je ten, kto pierwszy po nim przejdzie (łup leży na serwerze pół godziny). Własne zostają tylko: ekwipunek, złoto, doświadczenie, zadania, mapa i wiedza postaci.
- **Wrogowie są wspólni**: stwory, roboty, bandyci, pojazdy rabusiów i ich blokady dróg, drony i bossowie w podziemiach, wieżyczki (losowe spotkania, obozy, garnizony miast, napady na wioski, strażnicy wraków). Gdy gracz wyjdzie, jego wrogowie zostają i walczą dalej u pozostałych. Pierwszy gracz w danym miejscu „prowadzi” wrogów, pozostali widzą ich ruchy i strzały i mogą ich zabijać (zabójstwo i łup dostaje ten, kto zadał ostatni cios). Wrogowie atakują najbliższego gracza.
- Przedmioty położone przez graczy na ziemi (Drop w plecaku) serwer pamięta i pokazuje wszystkim; leżą 6 godzin, także po restarcie.
- Lista, ziarna i zegary zapisują się w `server/data/server.json` co 30 sekund i przy zatrzymaniu.

Gracze nie instalują niczego: otwierają adres serwera w przeglądarce (najpierw leci film wejściowy, potem menu), wpisują imię bohatera, klikają **Multiplayer** i widzą **listę serwerów** (nazwa, ilu gra, czy działa, czy stoi w pauzie, kto go założył) i klikają **Join** przy wybranym, albo wpisują nazwę i klikają **Create a server** (zaznaczone „in my own world” = w świecie z ich zapisu, inaczej nowy świat). Potem **Play online**. **Single player** wraca do własnego świata gracza.

**Konta graczy (od 0.158.0):** na serwerze dedykowanym każdy gracz ma własne konto: nazwę i hasło. W panelu **Multiplayer** wpisuje nazwę i hasło i klika **Create account** (pierwszy raz) albo **Log in**. Nazwa jest unikalna (wielkość liter nie ma znaczenia), ma 2–20 znaków, hasło co najmniej 6. Pod tą nazwą inni widzą gracza w grze, na czacie i na liście serwerów. Serwer nie zapisuje haseł, tylko ich skróty (scrypt z solą) w `server/data/accounts.json` (plik czytelny tylko dla usługi). Przeglądarka pamięta tylko token sesji (ważny 60 dni, odnawiany przy graniu), więc nie trzeba logować się za każdym razem. **Log out** kończy sesję, **Change password** zmienia hasło i wylogowuje inne przeglądarki tego konta. Jedno konto gra w jednym oknie naraz: zalogowanie się gdzie indziej wyrzuca poprzednie okno. Po 5 złych hasłach z jednego adresu serwer blokuje próby na minutę. Gra na LAN z `start-gry.bat` działa bez kont, jak dotąd. Zapomnianego hasła nie da się odczytać: można usunąć konto, kasując jego wpis z `accounts.json` przy zatrzymanej usłudze (`systemctl stop gridworld`), a gracz zakłada je od nowa.

**E-mail graczy (od 0.159.0):** gdy serwer umie wysyłać pocztę, nowe konto podaje nazwę, **e-mail** i hasło. Na adres przychodzi 6-cyfrowy kod (oraz link, jeśli ustawiono `PUBLIC_URL`). Dopóki gracz nie wpisze kodu w panelu Multiplayer albo nie kliknie linku, konto nie może grać. Logować się można nazwą albo e-mailem. **Forgot password?** wysyła kod do ustawienia nowego hasła (to wylogowuje wszystkie inne przeglądarki). Konta założone wcześniej grają dalej bez e-maila i mogą go dodać przyciskiem **Add email**. Kody ważne są 30 minut i pozwalają na 5 prób; mail do jednego konta idzie najwyżej raz na minutę i 8 razy na dobę. Serwer przechowuje kody tylko jako skróty. Konto, które przez tydzień nie potwierdzi adresu, jest usuwane (nazwa i adres się zwalniają). Bez ustawionej poczty wszystko działa jak w 0.158.0, a e-mail przy zakładaniu konta jest opcjonalny.

Włączenie poczty: skrypt instalacyjny tworzy (tylko raz, potem go nie nadpisuje) plik **`/etc/gridworld.env`**. Wpisz w nim adres nadawcy i dane skrzynki, usuwając `#` z początku linii, a potem zrób `sudo systemctl restart gridworld`:

```
MAIL_FROM="GridWorld <noreply@twoja-domena.pl>"
SMTP_HOST=mail.twoja-domena.pl
SMTP_PORT=587
SMTP_USER=noreply@twoja-domena.pl
SMTP_PASS=haslo-do-skrzynki
PUBLIC_URL=https://twoja-domena.pl/gridworld/
```

Port 465 (SSL) wymaga dodatkowo `SMTP_SECURE=1`. Jeśli na tym samym serwerze działa własny serwer poczty (postfix / sendmail), zamiast linii `SMTP_*` wystarczy `MAIL_SENDMAIL=1`. Po restarcie w logu (`journalctl -u gridworld -n 20`) pojawi się linia `mail on: from …`, a w menu gry pole e-mail. Gdy wysyłka się nie uda, log pokazuje `mail failed: …`, a gracz dostaje komunikat, że serwer nie mógł wysłać maila. Żeby maile nie trafiały do spamu, domena powinna mieć ustawione rekordy SPF i DKIM (konfiguruje się je u dostawcy domeny lub poczty).

**Śmierć na serwerze i imiona postaci (od 0.161.0):** na serwerze śmierć kończy postać. Jej ekwipunek zostaje na ziemi tam, gdzie zginęła, a imię trafia na listę poległych świata (pole `fallen` we wspólnym świecie, w `world-<id>.json`). Gracz budzi się jako nowy członek załogi w innej kapsule we wraku i musi podać nowe imię. Serwer odrzuca imiona poległych i imiona innych graczy, którzy są w grze. Pozostali widzą gracza pod imieniem jego postaci, a konto zostaje to samo. Wersja 0.161.0 zmienia protokół (12): po aktualizacji serwera gracze muszą odświeżyć stronę (Ctrl+F5).

**Własne serwery i ich zamykanie (od 0.158.0):** zalogowany gracz zakłada serwer (**Create a server**, najwyżej 3 na konto, 12 na maszynę) i tylko on widzi przy nim przycisk **Close server** (dwa kliknięcia). Serwer jest przypisany do konta, nie do przeglądarki, więc można go zamknąć z każdego komputera po zalogowaniu. Gracze, którzy na nim są, wracają do menu z komunikatem, a jego świat (`world-<id>.json`) znika z dysku. Serwery założone przed 0.158.0 zamyka się jak dawniej, z tej samej przeglądarki. Wersja 0.158.0 zmienia protokół (11): po aktualizacji serwera gracze muszą odświeżyć stronę (Ctrl+F5).

**Usuwanie serwerów (od 0.152.0):** kto założył serwer, widzi przy nim na liście przycisk **Delete** (dwa kliknięcia: „Sure? Delete”). Działa z tej samej przeglądarki, z której serwer założono: przeglądarka trzyma tajny klucz, a serwer pamięta tylko jego skrót (hash), więc nikt inny nie usunie cudzego serwera. Gracze, którzy akurat na nim są, dostają komunikat i wracają do menu; plik świata (`world-<id>.json`) znika z dysku. Serwera głównego (`main`, nazwa z `SERVER_NAME`) nie da się usunąć. Serwery założone przed 0.152.0 nie mają klucza: znikną same po 14 dniach pustki (albo usuń je ręcznie z `server.json` przy zatrzymanej usłudze). Wersja 0.152.0 zmienia protokół (10): po aktualizacji serwera gracze muszą odświeżyć stronę. Po aktualizacji serwera gracze muszą odświeżyć stronę (Ctrl+F5): stara wersja gry dostanie komunikat, żeby to zrobić.

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

Ustawienia (opcjonalne, przed `bash`): `SERVER_NAME` (nazwa w menu), `WORLD_SEED` (ziarno świata, czytane przy pierwszym starcie; liczba ujemna = nowy świat z około 20 miastami i złożami w dziczy, od wersji 0.182 losowane ziarna są ujemne; potem obowiązuje zapisane, chyba że `FORCE_SEED=1`), `PORT`, `HOST`, `DIR`.

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
- Nie są zsynchronizowane: spacery mieszkańców wiosek (tylko wygląd) i chwilowe zatrzymanie karawany w czasie napadu. Porzucony wrak pojazdu rabusiów można zająć tylko u gracza, w którego grze go pokonano. Protokół multiplayer: 9 (od 0.140: wspólne łodzie i statki; serwer i gra muszą być w tej samej wersji, więc po aktualizacji gry zaktualizuj też serwer).
- Brak haseł i kont: każdy, kto zna adres, może dołączyć (do 8 graczy naraz na każdym serwerze gry) i założyć nowy serwer gry.

**Wersja 0.183 (protokół 13):** gra i serwer muszą mieć tę samą wersję, bo placówki przy złożach (pole `outposts`) są wspólne dla graczy. Po aktualizacji gry zaktualizuj serwer skryptem `install.sh`.
