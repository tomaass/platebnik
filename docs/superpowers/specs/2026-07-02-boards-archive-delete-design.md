# Archivace a mazání akcí — návrh

## Kontext

„Akce" = **board** (`boards`). Host vytvoří akci, nasdílí partě, lidi se na
veřejné stránce `/b/[token]` podepíšou a zaplatí (`contributions`). Po skončení
akce ji host potřebuje dostat z cesty.

Dnes existuje jen **tvrdé mazání** (`deleteBoard` v `src/db/boards.ts` +
`deleteBoardAction` v `src/app/(host)/actions.ts`), které **není napojené na
žádné UI**. Archivace neexistuje — žádný `status` ani soft-delete.

## Cíl

Zavést dva doplňkové koncepty:

- **Archivace** (nové, hlavní) — bezpečné, vratné „ukliď mi to z cesty".
- **Mazání** (zpřístupnění existujícího backendu) — nevratná výjimka, dostupná
  **jen z archivu** (flow archiv → smazat, model koše).

## Sémantika

| | Archivace | Mazání |
|---|---|---|
| Efekt | Ukončí akci, schová ze seznamu aktivních | Nevratně smaže akci i s příspěvky (kaskáda) |
| Veřejná stránka `/b/[token]` | Ukáže „akce skončila", nepřijímá podpisy/platby | 404 |
| Data | Zůstávají | Pryč |
| Vratné | Ano (Odarchivovat) | Ne |
| Potvrzení | Žádné | Lehký confirm |
| Dostupnost | Aktivní akce | **Jen archivovaná akce** |

## Datový model

Nový nullable sloupec na `boards`:

```ts
archivedAt: timestamp('archived_at'), // NULL = aktivní, vyplněné = archivované
```

Nová Drizzle migrace (`drizzle-kit generate`). `NULL` je výchozí — stávající
akce zůstanou aktivní.

## Repository vrstva (`src/db/boards.ts`)

Vše přes stávající `assertOwner(token, userId)`.

- `archiveBoard(token, userId)` — `set archivedAt = new Date()`.
- `unarchiveBoard(token, userId)` — `set archivedAt = null`.
- `deleteBoard(token, userId)` — **beze změny** (zůstává jako nízkoúrovňový
  primitiv; testy ho volají jako cleanup i na nearchivovaných akcích).

Úpravy čtení:

- `listBoardsByUser` — `BoardSummary` rozšířit o `archivedAt: Date | null`, ať
  stránka umí rozdělit aktivní (`archivedAt == null`) / archivované. Řadí
  aktivní i archivované.
- `getBoardByToken` / `getBoardMeta` — vrátí i `archivedAt`, host vidí aktivní
  i archivované (kvůli detailu a metadatům).
- `getLatestBoardTheme` — bere **jen aktivní** akce (`isNull(archivedAt)`), ať
  archivovaná akce neovlivní výchozí styl nové akce.

## Server actions (`src/app/(host)/actions.ts`)

- `archiveBoardAction(token)` — `requireUser`, `archiveBoard`, `track('board_archived', …)`,
  `revalidatePath('/boards')` + `/boards/[token]`.
- `unarchiveBoardAction(token)` — obdobně, bez analytics eventu (YAGNI).
- `deleteBoardAction(token)` — **guard: akci lze smazat jen když je archivovaná.**
  Načte board, pokud `archivedAt == null` → vrátí chybu (nemaže). Jinak
  `deleteBoard`, `track('board_deleted', …)`, `revalidatePath('/boards')`.
  Guard žije v action vrstvě, aby db `deleteBoard` zůstal čistý primitiv.

## Veřejná stránka (`src/app/b/[token]`)

Archivovaná akce → **„akce skončila"**: stránka nepřijímá nové podpisy ani
platby. Buď dedikovaný „closed" stav v `page.tsx` / `BoardClient.tsx`, nebo
`notFound()` — preferovaný je **explicitní stav „akce skončila"** (jasnější než
404). `sign-action.ts` musí archivovanou akci odmítnout i na serveru (obrana
proti přímému POST).

## UI

### Detail `/boards/[token]`

Pod editorem **nebezpečná zóna** (nový `'use client'` komponent, aby zvládl
confirm dialog a `useRouter`/`revalidate`):

- Aktivní akce → **Archivovat**.
- Archivovaná akce → **Odarchivovat** + **Smazat** (lehký confirm
  „Opravdu smazat akci …? Nevratně zmizí i příspěvky." → Zrušit / Smazat).

### Seznam `/boards` „Moje akce"

- Aktivní akce nahoře.
- Pod nimi oddělená sekce **„Archivované"** (jen když nějaká existuje).
- Karta má `…` menu s rychlými akcemi:
  - aktivní → **Archivovat** (bez potvrzení),
  - archivovaná → **Odarchivovat** + **Smazat** (confirm).
- Klik na kartu vždy otevře detail.
- Archivovaná karta vizuálně ztlumená (`opacity`), ať je stav jasný.

Karta se rychlými akcemi se stává interaktivní → vyčlenit `'use client'`
komponent karty (dnes je stránka čistě server-side se statickými `Link`).

## Analytics (`src/lib/analytics.ts`)

Rozšířit uzavřenou `AnalyticsEvent` unii o:

- `board_archived` — volá `archiveBoardAction`.
- `board_deleted` — volá `deleteBoardAction`.

`board_unarchived` vynecháno (YAGNI).

## Testy

- `src/db/boards.test.ts`:
  - `archiveBoard` nastaví `archivedAt`, `listBoardsByUser` akci označí jako
    archivovanou.
  - `unarchiveBoard` vrátí `archivedAt` na `null`.
  - `getLatestBoardTheme` ignoruje archivované akce.
  - `deleteBoard` kaskáduje na příspěvky (už pokryto — ověřit).
- Action-vrstva: `deleteBoardAction` odmítne smazat nearchivovanou akci.
- (Volitelně) e2e: archivace z karty schová akci do sekce Archivované; veřejná
  stránka archivované akce ukáže „akce skončila".

## Mimo rozsah (YAGNI)

- Hromadné akce (archivovat/smazat víc akcí najednou).
- Automatická archivace po čase.
- Event `board_unarchived`.
- Koš s automatickým mazáním po N dnech.
