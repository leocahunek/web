# Aktivacija privatnog studija

Javni web ostaje na GitHub Pagesu. Supabase dodaje prijavu, bazu radova i spremište datoteka. Dok `data/portfolio-config.json` nije povezan, javni web čita postojeće radove iz `data/portfolio.json`, a `/studio/` jasno prikazuje da prijava još nije aktivirana.

1. Otvori Supabase projekt. U Authentication → Users izradi vlastiti korisnički račun s e-mailom i lozinkom. Isključi javnu registraciju u Authentication postavkama. Lozinku nemoj slati u chat niti spremati u repozitorij.
2. U SQL Editor zalijepi sadržaj `setup.sql`. Zamijeni `OWNER_EMAIL_HERE` svojim e-mailom i pokreni skriptu. Skripta u jednoj transakciji postavlja vlasnika, prava pristupa, početne radove i bucket `portfolio-media`.
3. U `data/portfolio-config.json` upiši Project URL (npr. `https://PROJECT.supabase.co`) i **javni publishable ključ** `sb_publishable_…`. Podržan je i stariji javni `anon` ključ. **Secret i service_role ključevi ne smiju se koristiti na webu.** Javni ključ nije lozinka; prava provjeravaju pravila baze i Storagea.
4. Objavi konfiguraciju i otvori `/studio/`. Prijavi se vlastitim računom. Dodavanje, preslagivanje, uređivanje i uklanjanje radova automatski se spremaju nakon kratke stanke u uređivanju. Gumb „Spremi odmah” sprema bez čekanja.

Nove fotografije pripremaju se za web do 2400 px u WebP formatu. GIF zadržava izvorni oblik. MP4 i WebM prenose se bez promjene; ograničenje je 150 MB po datoteci. Videozapisu možeš dodati naslovnu fotografiju opcijom „Zamijeni datoteku”. Brisanjem rada uklanjaš ga s weba; izvorne datoteke ostaju u vlastitom Supabase spremištu dok ih ondje ne ukloniš.

## Više fotografija u jednom projektu

Dodaj prvi rad kao i dosad, odaberi kategoriju „Fotografija” ili „Putopisna fotografija”, a zatim na njegovoj kartici klikni „Dodaj fotografije” i odaberi više datoteka. Fotografije možeš i povući na karticu tog projekta. Jedan projekt može sadržavati do 100 fotografija. Prva je naslovna; gumbima uz fotografije mijenjaš redoslijed, biraš naslovnu ili uklanjaš pojedinu fotografiju iz projekta. „Zamijeni datoteku” mijenja samo naslovnu, ostale fotografije ostaju. Posljednju fotografiju nije moguće ukloniti bez uklanjanja cijelog rada.

Javna galerija prikazuje jednu karticu po projektu i broj fotografija. U otvorenom pregledu fotografije se listaju zasebnim strelicama, tipkama lijevo/desno ili vodoravnim potezom na dodir; donje strelice i dalje mijenjaju cijeli projekt. Promjene se spremaju automatski. Polje `images` sprema se unutar postojećeg JSON popisa `projects`, a `image` ostaje naslovna radi kompatibilnosti. Postojeći radovi s jednim poljem `image` i dalje rade. Nova SQL migracija nije potrebna.

## Pristup i sinkronizacija

- Studio nije povezan u navigaciji i ima `noindex`. Njegov statični HTML može se otvoriti preko adrese: tajnost adrese nije zaštita. Uređivanje se otvara tek nakon provjere prijave i vlasničkih ovlasti na poslužitelju.
- Samo UID korisnika iz privatne tablice vlasnika smije mijenjati radove ili datoteke. Pravila ne koriste korisnički promjenjive profile ni JavaScript provjeru lozinke. Anoniman posjetitelj smije čitati objavljene radove i javne fotografije.
- Lozinka i tokeni ne spremaju se u izvorni kod, localStorage ni sessionStorage. Sesija postoji samo u otvorenoj kartici; ponovno učitavanje traži novu prijavu. JWT se obnavlja tijekom rada. Supabase provjerava lozinku i ograničava pokušaje prijave.
- Spremanje ažurira jedan popis radova s brojem revizije. Dvije otvorene administracije ne mogu tiho prebrisati izmjene jedna drugoj: novija verzija zaustavlja zastarjelo spremanje.
- Naslovna i galerija koriste isti popis. Nova objava dostupna je odmah, kartice javnog weba provjeravaju promjene svakih pet sekundi dok su vidljive, a drugi prozori istog preglednika dobivaju obavijest odmah. GitHub objava nije potrebna pri dodavanju radova.
- Posljednja uspješno učitana javna verzija može se spremiti u pregledniku radi oporavka pri prekidu veze. U taj se cache ne spremaju lozinke ni tokeni.

Prije puštanja provjeri i na stvarnom projektu: anoniman PATCH i upload moraju vratiti zabranu, drugi prijavljeni korisnik mora imati zabranu, a vlasnik mora moći dodati rad i vidjeti ga u drugom pregledniku. Lokalni testovi s oponašanjem API-ja ne zamjenjuju ovu provjeru stvarno primijenjenih pravila.

## Uređivanje stranice O meni

Za postojeći Supabase projekt jednom pokreni `supabase/about.sql` u SQL Editoru i osvježi Studio. Skripta dodaje samo polje `about` postojećem retku portfolija i dopušta njegovo ažuriranje prijavljenim korisnicima, uz postojeća pravila koja promjene dopuštaju samo vlasniku. Ne briše radove niti mijenja njihov sadržaj. Nova instalacija putem `setup.sql` već uključuje to polje.

U Studiju otvori „O meni — tekst i fotografija”. Možeš promijeniti naslov i nadnaslov, ime i ulogu, odlomke, usluge, tekst poveznice na kontakt, fotografiju, njezin opis i natpis te lokaciju. Fotografije koriste isto spremište i pripremu kao radovi. Sadržaj se sprema automatski i dijeli istu provjeru revizije s radovima. Bez nadogradnje uređivanje O meni ostaje isključeno uz poveznicu na skriptu; postojeći radovi i javna stranica ostaju dostupni. Zadani sadržaj nalazi se u `data/about.json`, a statični HTML ostaje dostupan i bez JavaScripta. Tekst se prikazuje kao običan tekst, bez HTML umetanja.

## Ograničenje prijenosa 150 MB

Za postojeći projekt pokreni `supabase/upload-limit.sql` u SQL Editoru. U Storage postavkama postavi i globalni File size limit na najmanje 150 MB, ako to podržava tvoj Supabase plan. Ograničenje bucketa ne može nadjačati niže globalno ograničenje projekta. Studio provjerava 150 × 1024 × 1024 bajtova po datoteci; fotografije se i dalje pripremaju za web. Prijenos može trajati do 10 minuta. Stvarni prijenos datoteke od 150 MB treba provjeriti na konfiguriranom projektu.
