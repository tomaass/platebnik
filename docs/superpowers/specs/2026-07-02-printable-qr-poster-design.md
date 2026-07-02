# Printable QR poster (A4) — V1 design

## Purpose

Let a host print a branded A4 poster carrying the board's QR code, so they can
stick it by the beer tap / on the wall. People at the table scan it, open the
board in the browser, click what they had, and pay with a QR payment — no app
install, no host chasing anyone.

This builds on the existing branded QR artifacts (`renderQrCard` PNG card +
`SharePanel`), extending them from "share on a phone" to "print for a table".

## Scope

**In (V1):**

- Server-side PDF generation of a single **A4 portrait** poster.
- New route handler `GET /b/[token]/print.pdf`.
- "Vytisknout QR na stůl" entry point in the host's board view (`SharePanel`).
- Czech user-facing copy.
- PostHog event so we can see whether people use it.

**Out (future, not V1):**

- Table-tent and cut-up small-card layouts (add only if people want them).
- Paid print service / physical fulfilment (the eventual monetization idea).
- Custom brand font in the PDF (V1 uses a built-in font).

## The QR target

The poster's QR encodes the **board URL** (`{origin}/b/{token}`), **not** a
fixed-amount SPAYD. A poster by the tap is seen by a whole group where everyone
owes a different amount; scanning must open the board so each person selects
their own items and gets their own payment QR. (Fixed-amount SPAYD is reserved
for the existing per-person "Uložit QR" card.)

## Architecture / data flow

- **Route:** `GET /b/[token]/print.pdf`, **Node.js runtime** (required by
  `@react-pdf/renderer`; declare `export const runtime = 'nodejs'`).
- Load the board by token using the same lookup as `/b/[token]/page.tsx`.
  Unknown / missing token → **404**.
- Build the board URL from the request origin, generate the QR as a PNG data
  URL via the existing `renderQrDataUrl(url)`, and embed it as an `<Image>`.
  - Note: `renderQrDataUrl` currently lives in client-oriented `save-qr.ts`
    (uses `qrcode`'s `toDataURL`, which works in Node too). If importing it
    server-side drags in browser-only code, factor the pure QR-encoding helper
    into a runtime-neutral module and import from there. Decide during
    implementation; do not duplicate the encoding logic.
- Render the React-PDF document to a stream/buffer and return it:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="platebnik-<slug>.pdf"` — reuse the
    existing `qrFileName` slug logic (swap `.png` → `.pdf`, or generalize it).
  - Generated on demand; no caching layer in V1 (low volume).

## PDF content (single A4 portrait page)

Vertically centered, generous margins:

- **Wordmark:** `Platebník` (top).
- **Board title** (the board's name).
- **Large QR** encoding the board URL — the dominant element, sized so it
  scans easily from a poster on a wall.
- **Instruction line** (see copy below).
- **Footer:** `platebnik.cz`.

Title truncation: reuse the existing caption-truncation approach so long board
names don't break the layout.

## Copy (Czech, user-facing)

- Heading: **„Zaplať svoji útratu"**
- Instruction: **„Naskenuj telefonem → naklikej, co sis dal → zaplať QR
  platbou."**
- Footer: **`platebnik.cz`**

## Entry point

- In `SharePanel` (host's board view, next to the existing "Uložit QR"), add a
  **„Vytisknout QR na stůl"** link/button that opens `/b/[token]/print.pdf` in
  a new tab. The host then uses the browser's Save/Print.

## Analytics

- Fire a PostHog event **`board_print_pdf`** (with the board token) when the
  poster is generated / requested, consistent with the existing server-side
  funnel events, so we can measure adoption before investing in more layouts.

## Testing

- Unit: filename/slug helper (`.pdf` variant) and any extracted QR-encoding
  helper.
- Route: `200` + `application/pdf` for a valid token; `404` for an unknown
  token. Assert the response is a non-empty PDF (magic bytes `%PDF`).
- Keep the PDF-layout React component thin and free of data-loading so it stays
  testable in isolation.

## Dependencies

- Add **`@react-pdf/renderer`**.

## Open questions

None blocking. The `renderQrDataUrl` import-location decision above is a small
implementation detail, resolved while building.
