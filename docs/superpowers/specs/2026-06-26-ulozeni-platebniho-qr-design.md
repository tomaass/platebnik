# Uložení platebního QR do mobilu — design

**Datum:** 2026-06-26
**Branch:** `worktree-save-payment-qr`

## Problém

Host kouká na veřejnou platební stránku (`/b/[token]`) typicky na **vlastním
telefonu** a chce zaplatit ze své bankovní aplikace na témže zařízení. Vlastní
obrazovku ale bankovní appkou nenaskenuje. Potřebuje proto platební QR **uložit
jako obrázek** a v bankovní aplikaci ho načíst „z galerie".

Dnes je QR vykreslený jako **inline SVG** (`BoardClient.tsx`, ř. 104–106) přes
`dangerouslySetInnerHTML`. SVG na mobilu většinou nejde podržet a „Uložit
obrázek" a bankovní appky ho z galerie nepřečtou — potřebujeme **PNG** (rastr).

Týká se to **platebního QR (SPAYD)**, ne sdílecího QR v `SharePanel.tsx`.

## Cíl

Tlačítko **„Uložit QR"** pod platebním QR, které host na mobilu hladce dostane
do fotek (nebo rovnou nasdílí do banky), a krátká nápověda, jak ho použít.
Uložený obrázek je zároveň **minimální brandovaná karta**, ať je v galerii
rozpoznatelná jako „Platebník" platba.

## Návrh

### Uložený obrázek = minimální karta (PNG přes canvas)

Místo holého QR se uloží/sdílí kompozovaná karta vykreslená na `<canvas>`:

- Bílé pozadí, odsazení kolem (~40 px) → čistá quiet zone + vzhled.
- **Horní řádek:** „Platebník" (zatím textový wordmark; později nahradí logo).
- **QR** uprostřed (~480 px, `margin: 1`).
- **Spodní popisek:** `{název boardu} • {částka} Kč`.
- Diakritika v canvasu funguje; systémový font stack přes `ctx.font`.

Generuje se **přes canvas** (`QRCode.toCanvas`), aby pozdější branding (logo do
středu, rámeček, finální typografie) bylo rozšíření této funkce, ne refaktor.

Zobrazený QR na stránce **zůstává SVG** beze změny — karta se skládá až na klik
(lazy), takže reaktivní `useEffect` při psaní zůstává levný.

### Tlačítko „Uložit QR" (Web Share + fallback)

Zobrazí se jen když existuje QR (`total > 0`), stejně jako dnes samotný QR.
Po kliknutí:

1. Vykreslit kartu na canvas → `canvas.toBlob()` → `File('qr-platba.png', { type: 'image/png' })`.
2. Pokud `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file], title })`
   → nativní share sheet (iOS/Android): *Uložit do fotek* / nasdílet do banky.
3. Jinak (desktop / nepodporováno) → fallback `<a download>` stažení PNG.
4. Zrušení share sheetu uživatelem (`AbortError`) se **tiše ignoruje**;
   jiná chyba → fallback download.

Během generování `saving` state → tlačítko `disabled`.

Pod tlačítkem hint: *„Ulož QR a načti ho v bankovní appce z galerie."*

### Struktura kódu

- **`src/app/b/[token]/save-qr.ts`** — `saveQrPng({ spayd, title, amountFormatted }): Promise<void>`.
  Drží veškerou canvas-kompozici + share/download logiku mimo komponentu.
  Kreslení karty je tu izolované → přidání loga/rámečku později = rozšíření
  této funkce.
- **`BoardClient.tsx`** — tlačítko + hint pod QR (jen `total > 0`), `saving`
  state, `onClick` předá `spayd`, `props.title` a `formatAmount(total)`.
- Error-correction QR necháváme default (`M`); na `H` se přepne, až přibude
  centrální logo.
- Žádná nová závislost — `qrcode` (v1.5.4) už je v projektu a umí `toCanvas`.

## Testování

- SPAYD logika je pokrytá v `domain/spayd`.
- Canvas-kompozice + share/download závisí na browser API (`navigator.share`,
  canvas) → **manuální ověření na reálném iOS i Androidu**: uložit do fotek →
  načíst QR v bankovní appce z galerie.
- Volitelně unit test na sestavení popisku / názvu souboru, pokud bude netriviální.

## Mimo scope (až bude design/logo)

- Logo do středu QR (s přepnutím error-correction na `H`).
- Barevný rámeček à la Apple Pay.
- Finální typografie a branding karty.
- Sdílecí QR v `SharePanel.tsx` (řeší jen platební QR).
- Univerzální „Zaplatit" deep-link do banky — v ČR neexistuje jednotné schéma.
