# GRIDWORLD · 0.232.0

Symulator ekonomiczno-strategiczny z perspektywy pierwszej osoby w świecie z zielonych linii wektorowych. Handluj, buduj fabryki i elektrownie, broń wiosek i przeszukuj ruiny obcych, żeby uruchomić Rydwan Przedwiecznych.

- **Strona gry:** https://mrfischoeder.github.io/Gridworld/
- **Zagraj w przeglądarce:** https://mrfischoeder.github.io/Gridworld/play/
- **Pobierz:** https://github.com/MrFischoeder/Gridworld/archive/refs/heads/feat/alien-fauna-models.zip

W **0.232.0** dodano pięć gotowych modeli wizualnych: Grzbietowca, Sześcionoga, Węża pręgowego, Szczękoroga i olbrzymiego Koronotytana. W menu wybierz **Galeria stworzeń** (`fauna.html`), aby je obracać, oglądać z bliska i porównać w rzeczywistej skali z człowiekiem. Modele mają nazwane części i osobne fabryki; na tym etapie nie pojawiają się w świecie i nie mają mechanik. [Instrukcja integracji i dokumentacja](docs/fauna/README.md).

W 0.231.0 zwykłą latarkę można zamontować na konkretnym blasterze, pistolecie maszynowym, strzelbie lub karabinie: wybierz broń w plecaku i kliknij „Zamontuj latarkę”. Klawisz L przełącza światło bez odkładania broni; latarka zużywa zwykłe baterie i zostaje przy broni także w skrzyniach oraz po wyrzuceniu.

W 0.230.0 pochodnie mają migoczące płomienie z kilku trójkątów, a podziemia więcej pochodni i lamp elektrycznych na ścianach.

Nowe światy zaczynają od ośmiu mieszkańców, małego magazynu i zrujnowanych pustych domów. Tutorial starszego prowadzi przez farmy, odbudowę GPS w pobliskich ruinach, magazyn dla pojazdów oraz budowę przemysłu. Każda rozwijana wioska ma własny kamieniołom i tartak około 100 m poza palisadą. Złoża rud i ropy są rzadsze: kolorowe skalne zagłębienia oraz bulgoczące czarne rozlewiska. Istniejące budowy i zapasy pozostają zachowane.

Wersja **0.130.0 jest zamrożona**: [pobierz jej kod](https://github.com/MrFischoeder/Gridworld/archive/refs/tags/v0.130.0.zip). Instrukcja uruchomienia i odzyskania zapisu: [FROZEN_0.130.0.md](FROZEN_0.130.0.md).

Multiplayer 0.232.0 używa protokołu 16: zaktualizuj klienta i serwer razem, zachowując katalog z danymi serwera. Budowy i rozładunek rezerwują współdzielony zapas na czas transakcji.

Uruchomienie lokalnie: rozpakuj, `npm install`, potem `start-gry.bat` albo `npm run dev`.

The website lives in `docs/index.html`; `.github/workflows/pages.yml` publishes it together with the game build (under `/play/`) to GitHub Pages.
