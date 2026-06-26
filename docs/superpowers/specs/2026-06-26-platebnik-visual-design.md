# Platebník — vizuální design

- **Datum:** 2026-06-26
- **Doména:** platebnik.cz
- **Stav:** schválený design, připraven k plánování implementace
- **Navazuje na:** [2026-06-24-platebnik-design.md](2026-06-24-platebnik-design.md) (funkční/produktový design)

## 1. Přehled a cíle

Funkčně je aplikace hotová, ale **bez vizuálního designu** (holé HTML, pár inline stylů). Tento dokument definuje **vizuální identitu a UI** Platebníku.

Designové pilíře (zadání od majitele):

- **Jednoduchý** — host „opilým palcem" na konci akce musí appku ovládnout na první dobrou.
- **Důvěryhodný** — jde o peníze; vzhled musí budovat důvěru, ne pochybnost.
- **Kamarádský a vtipný** — český humor v mikrotextech, lehkost.
- **Zapamatovatelný** — odlišit se od konkurence, vlastní charakter.
- **Mobile-first** — primární kontext je telefon, často venku za denního světla.

### „Opilý palec" jako hlavní omezení

Lidé platí na konci akce, často po pár pivech. Z toho plyne: **velké terče** (tlačítka ≥ 44 px, ideál 40–48 px), **vysoký kontrast textu**, **celková částka vždy na očích**, žádné jemné cílení ani skryté gesta jako jediná cesta.

## 2. Značkový svět: „česká hospoda / lokál"

Reframe oproti konkurenci: Platebník není „výkaz výdajů" ani „restaurační terminál", ale **účet u kamaráda** — atmosféra grilovačky, chaty, sešlosti. Tón i copy z tohoto světa čerpají (viz §9).

Pozn.: Původně zvažovaná „suchá béžová / chalkboard" estetika byla zamítnuta — působila staromódně (à la brew.sh). Finální směr je **světlý, svěží a moderní** s teplou hospodskou duší.

## 3. Odlišení od konkurence

Z průzkumu (Qerko, Settle Up, Splitwise, Tricount, Twisto, Revolut, Spendee): celé pole je **studené a finanční** — tábory zelená / modrá / fialová, generické fonty (Inter/Roboto), stejná SaaS landing šablona, mentální model „účetní dashboard".

Platebník se vymezuje:

1. **Teplá, živá, nefintechová barevnost** — výchozí motiv **Sunset (jantar → růžová)**. Růžová/magenta je jediný živý pruh, který je v této kategorii **neobsazený**.
2. **Charakterní typografie** — Bricolage Grotesque místo všudypřítomného Interu na nadpisech.
3. **Hrdinou je ceník**, ne dashboard — host proklikává položky jako objednávku u baru; žádné grafy a zůstatky.

### Zamítnuté barevné směry (a proč)

- **Zelená jako primární** — splynutí s Qerkem/Splitwise/Spendee.
- **Oranžová → červená („oheň/uhlíky")** — u platební aplikace čte červená/výstražná oranžová jako **chybový stav / varování**. Nepoužívat jako hlavní brand barvu.
- **Modrá / fialová** — obsazené (Tricount, Twisto, Revolut).

## 4. Barevný systém a motivy (theming)

Barvy se řídí **sémantickými tokeny** (CSS custom properties). Každý motiv tokeny naplní vlastními hodnotami; komponenty čtou jen tokeny, nikdy ne konkrétní hex.

### Sémantické tokeny

| Token | Význam |
|---|---|
| `--grad` | hlavní gradient (hero, lišta „Tvůj účet", panel sdílení) |
| `--accent` | primární akce (tlačítko `+`, odkazy, vybraný stav) |
| `--accent-ink` | text/ikona na ploše `--accent` |
| `--bg` | pozadí stránky |
| `--surface` | karty, pole |
| `--surface-alt` | jemně odlišená plocha (řádek položky) |
| `--border` | obrysy |
| `--text` | hlavní text |
| `--text-muted` | sekundární text, popisky cen |

### Motiv „Sunset" (výchozí)

```
--grad:        linear-gradient(135deg, #FF9A3D, #F0407E)
--accent:      #F0407E
--accent-ink:  #FFFFFF
--bg:          #FFF9F7
--surface:     #FFFFFF
--surface-alt: #FFF4F6
--border:      #FFE1E8
--text:        #2A1620
--text-muted:  #9A7B8A
```

Růžovou „drží" teplá jantarová → působí jako *západ slunce*, ne „holčičí". Světlé pozadí + barevné stíny u tlačítek = moderní, svěží.

### Motiv „Zelená" (volitelný, hned k dispozici)

```
--grad:        linear-gradient(135deg, #34C759, #0E9E6E)
--accent:      #0E9E6E
--accent-ink:  #FFFFFF
--bg:          #F6FBF3
--surface:     #FFFFFF
--surface-alt: #F4FAF0
--border:      #D9EFDF
--text:        #16331F
--text-muted:  #5E6B53
```

### Volba motivu

- Motiv je **vlastnost boardu** (`Board.theme`), ne účtu.
- **Nový board převezme styl posledně vytvořeného boardu** daného hostitele; první board → `sunset`.
- Host přepíná styl v editoru boardu; **host (plátce) vidí motiv dané akce** na veřejném boardu.

### Konstanty napříč motivy

- **QR kód je vždy čistě černobílý** (`#1E1B17` na bílé) — kvůli skenovatelnosti a důvěře. Barva motivu vstupuje jen do *rámu* kolem QR, nikdy do kódu.
- Badge „QR Platba" v jantarové/akcentní barvě jako kulturně rozpoznatelný český signál.

## 5. Typografie

- **Display (nadpisy, celkové částky, CTA, název akce):** **Bricolage Grotesque**, váhy 700–800. Svérázný moderní grotesk = charakter bez ztráty serióznosti.
- **Tělo / UI (popisky, názvy položek, vzkazy, ceny):** **Inter**, váhy 400–700.
- **Částky a čísla účtu/VS** zůstávají strojově dobře čitelné (Inter nebo Bricolage v plné váze, nikdy rukopis).

Fonty se načtou self-hosted nebo přes `next/font` (předejít FOUT, GDPR-friendly bez Google CDN).

## 6. Komponenty a vzory

Společné prvky (čtou tokeny z §4):

- **Tlačítko `+` (stepper plus):** plocha `--accent`, text `--accent-ink`, ~40×40 px, radius ~9 px.
- **Tlačítko `−` (stepper minus):** jemná `--surface-alt`, ~40×40 px.
- **Stepper:** `[ − ] n [ + ]` v bílém rámečku s `--border`; číslo Bricolage 800.
- **Primární CTA:** na ploše s `--grad` má bílé pozadí + text `--accent`; na světlém pozadí má plochu `--accent` + bílý text; barevný stín pro „lift".
- **Karta:** `--surface`, `--border`, radius 14–24 px, měkký stín (`rgba(...,0.16)`).
- **Sticky lišta „Tvůj účet":** plocha `--grad`, vlevo popisek, vpravo částka (Bricolage 800), pod ní velké CTA „Zaplatit přes QR".
- **Tip chipy:** řada `0 % / 5 % / 10 % / vlastní`; vybraný chip = plocha `--accent`.
- **QR karta:** částka jako hrdina nahoře (Bricolage, velká), pod ní černobílé QR, badge „QR Platba", popisek „Naskenuj v bankovní appce".
- **Emoji** u položek a v copy jako levný zdroj tepla a hravosti (🍺 🌭 🥤 🔥).

## 7. Veřejný board (`/b/[token]`) — hlavní obrazovka

Vzor výběru: **řádky + velký stepper** (zamítnuto: ťukací dlaždice — hůř objevitelné ubírání).

Struktura (shora dolů):

1. **Hlavička** — emoji + název akce (Bricolage), pod tím vtipný podtitul („Co sis dal? Naťukej a zaplať.").
2. **Seznam položek** — řádky `název + cena` vlevo, stepper vpravo, plocha `--surface`/`--surface-alt`.
3. **Dýško (dobrovolné)** — chipy `0/5/10 %` (počítané z útraty) + „vlastní Kč"; default prázdné, bez tlaku.
4. **Moment platby** — částka (vč. dýška) jako hrdina + černobílé QR + (volitelný) podpis a vzkaz.
5. **Sticky lišta** s celkem + „Zaplatit přes QR".

### Responzivní chování momentu platby

- **Mobil / dotyk / malé viewporty:** „Zaplatit přes QR" otevře **vysouvací panel (bottom sheet)** s částkou, QR a podpisem; seznam zůstane vzadu (fokus na platbu, působí jako terminál).
- **Desktop / velké viewporty:** žádný panel — **vše na jedné stránce**, host jen sroluje k QR.

Sheet i inline verze sdílejí stejné komponenty (jen jiný kontejner).

## 8. Landing (`/`)

Mobile-first, na desktopu do sloupců. Sekce:

1. **Hlavička** — wordmark **`Platebník.`** (tečka v `--accent`), vpravo „Přihlásit".
2. **Hero** — kicker „🍺 Pro grilovačky a sešlosti", velký headline, jasná hodnota, hned CTA „Vytvořit akci →", pod tím microcopy „Zdarma · bez instalace · platba přes QR do tvé banky".
3. **Jak to chodí** (3 kroky) na **tmavém pozadí** (kontrast = důvěra): sepíšeš ceník → nasdílíš QR/odkaz → každý zaplatí sobě.
4. **Tři důvěryhodnostní karty:** „Peníze jdou přímo k tobě" (největší odlišení — žádná brána, žádný poplatek), „Host nic neinstaluje", „Víš, kdo zaplatil".
5. **Patička** — „Platebník.cz · vyrobeno v Česku 🇨🇿".

Hero na landingu používá `--grad` výchozího motivu (Sunset).

## 9. Copy a tón

- Čeština, tykání, kamarádský a vtipný tón. Humor v podtitulech, prázdných stavech, potvrzeních.
- **Zákaz slova „trapné/trapnost"** v UI copy (na výslovné přání majitele). Hodnotu sdělit pozitivně („vyřešeno za minutu", „bez počítání").
- **Finální headline:** „**Naťukej, co sis dal. Zbytek zařídí QR.**"
- Příklady mikrotextů: „Co sis dal? Naťukej a zaplať. 🍺", „Hotovo! Nasdílej partě 🎉", „Podepiš se, ať Tomáš ví, kdo platil 🙂", „Bez položek? V pohodě — board pojede v režimu čistého dýška."

## 10. Admin (autentizovaná plocha)

Stejná paleta i typografie jako veřejný board, mobile-first, na desktopu do sloupců.

- **Editor boardu** — název akce; **ceník** (řádky `název + cena`, velké `×` pro smazání, „+ Přidat položku"); prázdný ceník = jasná pozn. o režimu čistého dýška; **přepínač „Styl akce"** (Sunset/Zelená, zamčené motivy jako náznak Premia); přednastavená dýško %; **panel sdílení** (QR + odkaz hned po vytvoření, v barvě motivu, „Zkopírovat odkaz").
- **Seznam boardů** — karty akcí, rychlý vstup do editoru a přehledu podpisů.
- **Profil** — číslo účtu (nutné pro sdílení boardu), jméno.

## 11. Přístupnost

- Kontrast textu vůči pozadí min. WCAG AA; CTA a částky AAA kde to jde.
- Dotykové terče ≥ 44 px.
- QR má `aria-label`; ovládací prvky popsané pro čtečky.
- Nespoléhat jen na barvu (stavy mají i text/ikonu).

## 12. Mimo scope / budoucí (zaznamenáno)

- **Premium motivy** (monetizační háček, navazuje na §10 původní specky): další styly boardu pro předplatitele — kandidáti: **Magenta na tmavé** (prémiové, sebevědomé), **Křídová tabule** (tmavá), sezónní (Vánoce, svatba), firemní/branding s logem. Systém tokenů z §4 je na to připravený — premium = jen další sady hodnot tokenů.
- Animace/mikrointerakce (potvrzení platby, „lift" tlačítek) — lehce, později.
- Dark mode jako uživatelská volba (oddělené od motivů boardu).
