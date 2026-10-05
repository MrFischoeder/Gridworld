# GRIDWORLD · 0.132.0

Symulator ekonomiczno-strategiczny z perspektywy pierwszej osoby w świecie z zielonych linii wektorowych. Handluj, buduj fabryki i elektrownie, broń wiosek i przeszukuj ruiny obcych, żeby uruchomić Rydwan Przedwiecznych.

- **Strona gry:** https://mrfischoeder.github.io/Gridworld/
- **Zagraj w przeglądarce:** https://mrfischoeder.github.io/Gridworld/play/
- **Pobierz:** https://github.com/MrFischoeder/Gridworld/archive/refs/heads/feat/village-resource-sites.zip

Nowe światy zaczynają od ośmiu mieszkańców, małego magazynu i zrujnowanych pustych domów. Tutorial starszego prowadzi przez farmy, odbudowę GPS w pobliskich ruinach, magazyn dla pojazdów oraz budowę przemysłu. Każda rozwijana wioska ma własny kamieniołom i tartak około 100 m poza palisadą. Złoża rud i ropy są rzadsze: kolorowe skalne zagłębienia oraz bulgoczące czarne rozlewiska. Istniejące budowy i zapasy pozostają zachowane.

Wersja **0.130.0 jest zamrożona**: [pobierz jej kod](https://github.com/MrFischoeder/Gridworld/archive/refs/tags/v0.130.0.zip). Instrukcja uruchomienia i odzyskania zapisu: [FROZEN_0.130.0.md](FROZEN_0.130.0.md).

Multiplayer 0.132.0 używa protokołu 7: zaktualizuj klienta i serwer razem, zachowując katalog z danymi serwera. Budowy i rozładunek rezerwują współdzielony zapas na czas transakcji.

Uruchomienie lokalnie: rozpakuj, `npm install`, potem `start-gry.bat` albo `npm run dev`.

The website lives in `docs/index.html`; `.github/workflows/pages.yml` publishes it together with the game build (under `/play/`) to GitHub Pages.
