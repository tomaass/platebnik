# Platebník — design

- **Datum:** 2026-06-24
- **Doména:** platebnik.cz
- **Stav:** schválený design, připraven k plánování implementace

## 1. Přehled a cíle

Webová aplikace, kde **hostitel** zadá ceník občerstvení a sdílí **board** (unikátní URL + QR kód). **Hosté** bez registrace otevřou board, naklikají si co měli, aplikace spočítá částku a vygeneruje **QR Platbu (SPAYD)** k zaplacení přímo hostiteli. Host se volitelně podepíše / nechá vzkaz. Board zvládá i **čisté dýško** bez položek (např. „přinesli jsme si všechno sami, jen jsme společně pogrilovali a chceme nechat za grill/vodu/zázemí").

**Hlavní hodnota není platba** (tu řeší QR Platba zdarma a nativně v českých bankách), ale **odstranění trapnosti a ručního počítání** na konci neformální domácí akce.

### Měřítka úspěchu

- Veřejná board stránka je extrémně lehká — funguje na mobilních datech a při slabém signálu; **během výběru položek nejde na server žádný request**.
- Registrace hostitele je zero-friction (magic link nebo Google OAuth).
- Platba na dvě ťuknutí: host naskenuje QR → odešle v bankovní aplikaci.

## 2. Rozsah a uživatelské role

- **Hostitel** — registrovaný uživatel. Spravuje ceníky/boardy, vidí přehled podpisů, ručně označuje zaplacené. Registrace je zároveň monetizační háček (sběr e-mailů pro budoucí rozvoj).
- **Host (plátce)** — bez registrace. Otevře sdílenou URL / naskenuje QR, naklik/zvolí množství, dostane QR k platbě, volitelně se podepíše nebo nechá vzkaz.

## 3. Architektura

Monolit **Next.js (App Router) na Vercelu**, **Neon Postgres** + **Drizzle ORM**, autentizace přes **Auth.js** (magic link + Google OAuth). Dvě jasně oddělené plochy:

- **Host-admin** (`/app/*`, autentizované) — tvorba a editace boardů, přehled podpisů, profil s číslem účtu. Smí být bohatší (host je typicky na lepším připojení).
- **Veřejný board** (`/b/[token]`) — **React Server Component**, načte ceník jednou (cache na edge dle tokenu), pošle minimum klientského JS. Výběr, výpočet ceny, dýško i generování QR běží **čistě na klientovi** (malá QR knihovna, jednotky kB). Jediný serverový zápis je volitelný podpis (jeden server action POST).

### Zvolený přístup

Server-rendered board + plně klientský výběr a QR. Zamítnuté alternativy: server-driven board (každý tap = round-trip, boří lightweight cíl) a plné offline PWA (service worker se bije s editovatelným boardem, overkill pro MVP). Z PWA si bereme jen „PWA-lite" — agresivní cache hlavičky statických assetů.

### Hranice modulů (každý samostatně testovatelný)

- `spayd` — sestavení SPAYD stringu (pure).
- `iban` — převod českého čísla účtu → IBAN + mod-97 checksum (pure).
- `pricing` — výpočet sumy z výběru + dýško z procent (pure).
- `boards` / `contributions` — datová vrstva (Drizzle).
- `auth` — konfigurace Auth.js.

## 4. Datový model

```
User (hostitel)
  id, email, name?, googleId?
  bankAccountRaw   ("12345-678901234/0800")
  bankAccountIban  (odvozeno)
  createdAt

Board
  token (PK, náhodný neuhodnutelný nanoid ~16 znaků)
  userId (FK -> User)
  title
  currency = 'CZK'
  variableSymbol (odvozen per board)
  tipPercents (int[], default [0, 5, 10])
  createdAt, updatedAt

Item
  id, boardId (FK)
  name, priceHaler (integer — haléře, žádné floaty)
  position (řazení)

Contribution (vzniká jen když se host podepíše / nechá vzkaz)
  id, boardId (FK)
  name?, message?
  selectionSnapshot (JSON — co si naklikal; snapshot, ne FK na Item)
  amountHaler, tipHaler
  paid (bool, ručně přepíná hostitel)
  createdAt
```

### Klíčová rozhodnutí

- **Ceny v integer haléřích** — přesnost, žádné floaty.
- **Contribution drží snapshot výběru** — board je editovatelný (položky se mění/mažou), podpis musí zůstat historicky platný nezávisle na pozdějších změnách ceníku.
- **Variabilní symbol per board** — host pozná platby k dané akci v bance i bez podpisu hosta. Jméno hosta jde navíc do SPAYD `MSG`.
- **Board s nulovým ceníkem je validní** — režim čistého dýška / tip jaru.

## 5. Klíčové toky

**Host vytvoří board:** přihlásí se (magic link / Google) → poprvé zadá číslo účtu do profilu → vytvoří board s názvem a položkami → dostane URL + QR kód ke sdílení. Položky lze editovat kdykoli, i po nasdílení (přidat/změnit/smazat); hosté při dalším otevření vidí aktuální ceník.

**Host otevře board (mobilní data):** RSC vykreslí ceník → host ťuká položky (+/− množství) → cena a QR se přepočítávají **lokálně, bez requestu** → sekce dýško (tlačítka 0/5/10 % počítaná z útraty + vlastní částka, default prázdno, bez tlaku) → QR kód ke stažení.

**Podpis (volitelný):** po vygenerování QR výzva „Chceš se Tomášovi podepsat nebo nechat vzkaz, ať ví kdo a co platil?" → jeden POST → uloží Contribution. Zobrazení v admin přehledu přes React (auto-escape).

**Platba:** host naskenuje QR ve své bankovní aplikaci (předvyplněný IBAN, částka, VS, MSG) → odešle. Aplikace platbu neověřuje; hostitel si ji v přehledu ručně odškrtne (`paid`).

## 6. QR Platba / SPAYD

Klient sestaví string, příklad:

```
SPD*1.0*ACC:CZ5508000000001234567899*AM:480.00*CC:CZK*X-VS:204815*MSG:Pepa pivo 2 panak 1
```

- `ACC` = IBAN hostitele (z profilu)
- `AM` = celková suma včetně dýška, dvě desetinná místa
- `CC` = `CZK`
- `X-VS` = variabilní symbol boardu
- `MSG` = jméno + stručný výběr, **max 60 znaků, odstraněná diakritika** a nepovolené znaky (SPAYD MSG má omezený charset)

**Převod čísla účtu → IBAN:** `CZkk + bankcode(4) + prefix(6, zleva doplněno nulami) + account(10, zleva doplněno nulami)`, kontrolní číslice `kk` přes mod-97. Pure funkce s unit testy na známé referenční páry.

## 7. Error handling a bezpečnost

User-generated content (jméno + vzkaz hosta) je hlavní vstupní bod, proto:

- **Neuhodnutelné tokeny boardů** (kryptograficky náhodný nanoid), žádné sekvenční ID v URL → board nelze enumerovat.
- **Validace a limity vstupů** — délkové limity na názvy položek a vzkazy, ceny v rozumných mezích, server-side validace (Zod) na všech zápisech. Render přes React (auto-escape) → ochrana proti XSS.
- **SQL injection** — výhradně parametrizované dotazy přes Drizzle.
- **Rate-limiting** na veřejné endpointy (čtení boardu i POST podpisu) per IP / per board (Upstash nebo edge) → ochrana proti scrapování a zahlcení DB.
- **Antispam podpisů** — limit počtu Contribution na board a per IP; CAPTCHA odložena (přidá se jen pokud to bude potřeba).
- **Authz** — editovat board a vidět podpisy smí jen jeho vlastník; veřejné čtení pouze přes token, bez citlivých dat. (Číslo účtu hostitele je určené k přijímání plateb, jeho sdílení v QR je v pořádku.)

### Chybové stavy

- Neexistující/smazaný board → přívětivá 404.
- Hostitel bez vyplněného účtu → board nejde sdílet, dokud účet nedoplní (jasná výzva).
- Nevalidní číslo účtu → chyba při ukládání profilu.

## 8. Testování

- **Unit (TDD, pure funkce):** SPAYD builder, účet→IBAN + checksum, pricing (suma + procentní dýško + zaokrouhlení haléřů), validátory a sanitizace MSG. Zde běží red-green-refactor.
- **Integrační:** board CRUD, contribution POST s validací, authz (cizí uživatel needituje cizí board), rate-limit.
- **E2E (lehké):** host otevře board → vybere položky → QR se vykreslí → podepíše se.

## 9. Mimo scope (YAGNI pro MVP)

Multi-currency; automatické párování plateb přes bankovní API; platební brána / platba kartou v aplikaci; plné offline PWA; nativní mobilní aplikace; opakované/pravidelné akce; lokalizace mimo CZ.

## 10. Budoucí monetizace (mimo MVP, zaznamenáno)

- **Freemium** — zdarma základ, placené „pro" funkce (historie akcí, větší ceníky, branding/logo na board stránce, statistiky).
- **Dobrovolné dýško aplikaci** — stejná mechanika jako dýško hostiteli.
- **B2B / white-label** — malé spolky, kluby, kanceláře, které pravidelně vybírají na občerstvení.
- Transakční poplatek by dával smysl jen při přechodu na platební bránu (u čisté QR Platby peníze tečou přímo hostiteli, není kde poplatek vybrat).
