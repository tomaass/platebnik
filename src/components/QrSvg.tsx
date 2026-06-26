// Inject responsive fill sizing into a qrcode <svg>. Matches "<svg" without a trailing char so
// it survives "<svg ", "<svg>" and "<svg\n". qrcode emits only a viewBox (no width/height), so
// without this the SVG can render at the default 300x150 inside a sized box.
export const fillSvg = (markup: string): string =>
  markup.replace('<svg', '<svg style="width:100%;height:100%;display:block"')

interface Props {
  markup: string // trusted <svg> string from QRCode.toString (our own data, never user input)
  label: string
  className?: string // caller sizes the box via its own CSS
}

// Shared accessible inline-SVG QR renderer. The SVG fills the caller-sized box.
// `markup` MUST be qrcode output, not user input — it is injected via dangerouslySetInnerHTML.
export default function QrSvg({ markup, label, className }: Props) {
  return (
    <div
      className={className}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: fillSvg(markup) }}
    />
  )
}
