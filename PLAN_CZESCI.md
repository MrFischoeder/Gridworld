# Plan: części energetyczne i drabinka rozwoju

Prośba właściciela (0.272): we wrakach statków maszynownia (na rufie) i laboratoria, które rozbiera się kluczem na części;
generatory (farmy wiatrowe, słoneczne itd.) wymagają tych części; na początku są tylko z wraków i zabitych robotów
(wraki się nie odnawiają, więc się kończą), później trzeba odkryć i odbudować starożytne fabryki, które je robią.

## Drabinka

1. **Początek** – silnik własnego statku (raz): uzwojenie stojana, falownik, 2 łożyska. Wystarczy na elektrownię wioski
   i pierwszą turbinę placówki. Klucz leży w szafce statku (kowal zrobi go z 3 złomu, Oskar sprzedaje).
2. **Wraki i roboty** – maszynownia (2 bębny reaktora: uzwojenia, rdzenie mocy; 2 szafy napędu: łożyska) i laboratoria
   (ogniwa słoneczne, falowniki, elektronika); po 3 części na maszynę, nic nie odrasta. Ciężkie roboty i kontenery z orbity
   dają czasem po sztuce. To starcza na kilka stacji: farmy słoneczne i wiatrowe, agregaty, kocioł.
3. **Starożytne zakłady** – odbudowane: Stare Zakłady Precyzyjne (łożyska, uzwojenia), Stara Fabryka Czipów (falowniki),
   Stare Zakłady Optyczne (ogniwa). Od tej chwili części w dowolnych ilościach – więcej stacji, reaktory.

## Etapy

- **E1 (0.272, zrobione):** klucz, rozbiórka maszyn we wrakach i silnika Kestrela (wspólny stan `salvage`), 4 części,
  wymagania wszystkich generatorów, łupy robotów, przepisy starożytnych zakładów.
- **E2 (0.273, zrobione w części):** konsole lotu na mostku (elektronika) i podnośniki w ładowniach (silniki, przekładnie,
  hydraulika). Zostaje: rozbiórka wraków porzuconych pojazdów i robotów leżących na ziemi.
- **E3:** inne urządzenia na części (pompy, silniki elektryczne, radio, drony) – po jednej części kluczowej każde.
- **E4:** bilans w `npm run sim` (ile wraków na ile stacji, czas do pierwszej odbudowanej fabryki).
