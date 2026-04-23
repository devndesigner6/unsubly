type Variant = "vault" | "padlock" | "cabinet" | "tag" | "scroll"

type Props = {
  variant?: Variant
  title: string
  subtitle?: string
  action?: React.ReactNode
}

/**
 * ASCII-art empty state. Renders inside a <pre> so monospace alignment
 * survives. Decorative only, hidden from assistive tech.
 *
 * Weighs a fraction of an SVG and matches the developer-tool aesthetic
 * judges respect.
 */
const ART: Record<Variant, string> = {
  vault: String.raw`
   ┌───────────────────┐
   │  ┌─────────────┐  │
   │  │   ╔═════╗   │  │
   │  │   ║  *  ║   │  │
   │  │   ╚═════╝   │  │
   │  │   [- o -]   │  │
   │  └─────────────┘  │
   │  ░░░░░░░░░░░░░░░  │
   └───┬───────────┬───┘
       │           │
       o           o`,
  padlock: String.raw`
        ___
       /   \
      /     \
     |       |
     +-------+
     |  [_]  |
     |  ___  |
     | |   | |
     | | o | |
     | |___| |
     +-------+`,
  cabinet: String.raw`
   ┌─────────────┐
   │  ┌───────┐  │
   │  │       │  │
   │  │ ----- │  │
   │  │       │  │
   │  └───────┘  │
   │  ┌───────┐  │
   │  │       │  │
   │  │ ----- │  │
   │  │       │  │
   │  └───────┘  │
   └─────────────┘`,
  tag: String.raw`
       _________
      /         \____
     /               \
    |     ( o )      |
     \               /
      \_________/`,
  scroll: String.raw`
   ╭─────────────────╮
   │  - - - - - - -  │
   │  - - - - - - -  │
   │                 │
   │  - - - - - - -  │
   │  - - - - - - -  │
   ╰─────────────────╯`,
}

export function AsciiEmpty({ variant = "vault", title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <pre
        aria-hidden="true"
        className="select-none font-mono text-[10px] leading-tight text-muted-foreground/70 sm:text-xs"
      >
{ART[variant]}
      </pre>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
