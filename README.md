# Leo Cahunek — web portfolio

Raspakiraj cijeli ZIP i otvori `index.html` u pregledniku. Zadrži sve HTML datoteke i mapu `assets` zajedno. Nisu potrebni instalacija ni build.

## Stranice

- `index.html` — naslovnica s blendom i omotima radova.
- `radovi.html` — galerija, filtri i pregled radova.
- `o-meni.html` — biografija i mjesto za portret.
- `kontakt.html` — usluge i obrazac za pripremu upita.
- `assets/style.css`, `assets/main.js` — zajednički izgled i interakcije.
- `data/portfolio.json`, `assets/portfolio-store.js` — zajednički podaci radova i povezivanje objavljenog sadržaja.
- `studio/` — admin sučelje, bez poveznice u javnoj navigaciji; aktivacija prijave i sinkronizacije opisana je u `supabase/README.md`.
- `assets/camera-cursor*.svg` — pokazivači u obliku fotoaparata, bez vanjskih ovisnosti.

Za razvoj s lokalnim serverom pokreni `python3 -m http.server 8000 --bind 0.0.0.0` iz direktorija projekta.

Provjere modela podataka pokreću se s `node --test tests/portfolio-store.test.cjs`. Za funkcionalne provjere pokreni lokalni server i `node tests/project-photos.browser.cjs` , `node tests/travel-orbit.browser.cjs` , `node tests/about.browser.cjs` , `node tests/availability.browser.cjs` i `node tests/fast-home.browser.cjs` u okruženju s Playwrightom i Chromiumom (`CHROMIUM_PATH` može promijeniti putanju preglednika, a `TEST_BASE_URL` adresu servera). Test preglednika koristi izolirani Supabase API mock; ne mijenja stvarne radove i ne zamjenjuje provjeru pravila na stvarnom projektu.

## Za nastavak u drugom chatu
Nastavi uređivati priloženi web portfolio za Lea Cahuneka. Sačuvaj tamni elegantni dizajn, responzivnost, uvodno otvaranje blende i listanje radova poput omota ploča.

## Implementirano
- Uvod: blenda sa šest lamela otvara se odmah tijekom 4 s; omoti se već vrte tijekom otvaranja, bez naknadnog uvoda teksta.
- Vrtnja na naslovnici počinje iz spremljenih ili lokalnih podataka, bez čekanja na Supabase; aktualni radovi učitavaju se u pozadini.
- Naslovna s neprekidnim kruženjem omota po dijagonali: prednji niz ide od gornjeg desnog prema donjem lijevom kutu, a povratak prolazi iza njega.
- Naslovna ispunjava visinu ekrana bez pomicanja stranice. Kotačić miša, trackpad i okomiti potezi na dodir ubrzavaju kruženje omota, uz postupan povratak na početnu brzinu.
- Strelice, swipe i pauziranje ostaju dostupni; uz postavku smanjenog kretanja omoti miruju.
- Dorađena tipografija, zaglavlje, grafički omoti i raspored za računalo, tablet i mobitel.
- Gotovo crna paleta s blagim ljubičastim tonom `#09050d`, bijeli tekst i slojevita pozadina s finim zrnom, prigušenim tonalnim svjetlom i tankim konturnim linijama. Shutter koristi istu osnovnu boju pozadine.
- Fina, statična zrnata tekstura u pozadini i fotoaparat kao pokazivač na uređajima s mišem; na poljima za unos ostaje tekstni pokazivač.
- Četiri zasebne HTML stranice, aktivna stavka navigacije i blagi prijelazi između stranica u preglednicima koji ih podržavaju.
- Pauziranje automatskog listanja, tipkovnička navigacija i zaustavljanje listanja tijekom interakcije.
- Postupno pojavljivanje sekcija i animirani prijelazi filtara; smanjeno kretanje poštuje se i kad se postavka promijeni tijekom pregleda.
- Grafičke zamjene ostaju vidljive ako se vanjske fotografije ne učitaju. Ikone su ugrađene SVG grafike i ne trebaju vanjske fontove.
- Radovi: galerija, filtri i pregled fotografija / oglednog videa.
- About: opis Lea i mjesto za portret.
- Contact: usluge i obrazac koji priprema TXT upit za preuzimanje.
- Prilagodbe za desktop, tablet i mobitel te smanjeno kretanje prema postavkama uređaja.
- Pripremljen admin `/studio/`: povlačenje datoteka, uređivanje metapodataka, redoslijeda i odabira naslovne, automatsko spremanje te povezivanje sa Supabase Authom, bazom i Storageom. **Prijava i online spremanje nisu aktivni dok se ne postave Supabase projekt i pravila iz `supabase/setup.sql`.**

## Preostalo prije javnog korištenja
- Zamijeniti ogledne Unsplash fotografije, privremeni pejzaž na mjestu portreta i demo video stvarnim radovima.
- Povezati kontaktni obrazac sa slanjem upita. Trenutno ništa ne šalje.
- Dodatno provjeriti web u Safariju, Firefoxu i na stvarnim uređajima.
- Fotografije i demo video učitavaju se s vanjskih izvora i zahtijevaju internet. Font Marcellus, tekstura, konture i ikone uključeni su lokalno.

## Tipografija

Arpona je prva u CSS izboru fontova. Datoteke Arpone ili Adobe Fonts web-projekt još nisu dostavljeni, pa se Arpona koristi samo ako je lokalno instalirana. U ostalim slučajevima prikazuje se priloženi Marcellus kao privremena zamjena, uključujući hrvatske znakove. Za stvarnu Arponu na svim uređajima poveži odgovarajući Adobe Fonts CSS ili dodaj licencirane datoteke i `@font-face` pravila u `assets/theme.css`.

Marcellus je preuzet s Google Fonts i uključen uz SIL Open Font License u `assets/fonts/LICENSE-Marcellus.txt`.

## Ranija objavljena stranica
https://lc-visual-studio-leon.round-lemur-7636.chatgpt.site

Ovaj link nije povezan s lokalnim izmjenama. Za pregled nove verzije raspakiraj cijeli ZIP i otvori `index.html`; pri objavi prenesi sve četiri HTML datoteke i mapu `assets`.

## Provjera nove verzije

Admin i sinkronizacija provjereni su u Chromiumu s izoliranim API mockom: zabrana drugom računu, upload i priprema fotografije, prijenos promjena u otvorenu galeriju, zaštita prikaza od HTML umetanja, preslagivanje, brisanje, sukobi revizija, odjava te prazno stanje i jedan rad. Stvarna Supabase pravila treba primijeniti i provjeriti na povezanom projektu prije aktivacije prijave. Bez konfiguracije studio ostaje neaktivan, a javni web prikazuje postojeće radove.

Provjereno u Chromiumu preko lokalnog HTTP servera: uvod i preskakanje uvoda, galerija, tipkovnica, lightbox, filtri, mobilni izbornik, swipe, pauziranje i nastavak listanja, promjena postavke smanjenog kretanja i sadržaj preuzetog TXT upita. Sve stranice provjerene su na širinama 320, 390, 768 i 1440 px bez vodoravnog pomicanja i JavaScript pogrešaka. Vanjske fotografije i video još su ograničeni mrežnom politikom cloud okruženja; grafički omoti ostaju dostupni.

Izvoz je prenosiva kopija izvornog koda. Nema pristupnih tokena ni Git konfiguracije. Hosting identitet izostavljen je kako se kopija može koristiti samostalno.
