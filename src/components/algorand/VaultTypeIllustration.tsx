import type { VaultType } from "@/lib/algorand/constants"

interface Props {
  type: VaultType
  status?: string
  className?: string
}

const GRADIENTS: Record<VaultType, string> = {
  standard:    "from-slate-700 via-slate-800 to-slate-900",
  agent:       "from-emerald-600 via-emerald-700 to-emerald-900",
  time_locked: "from-amber-500 via-orange-600 to-rose-700",
  multi_sig:   "from-indigo-600 via-violet-700 to-purple-900",
  dispute:     "from-rose-600 via-red-700 to-rose-900",
  asa:         "from-yellow-500 via-amber-600 to-orange-700",
}

export function VaultTypeIllustration({ type, status, className = "" }: Props) {
  const grad = GRADIENTS[type] ?? GRADIENTS.standard
  const dim = status === "killed" || status === "released"

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad} ${dim ? "saturate-50 opacity-90" : ""} ${className}`}>
      {/* subtle grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* glossy highlight */}
      <div
        aria-hidden
        className="absolute -top-8 -left-6 h-24 w-32 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%)" }}
      />

      <div className="relative flex h-full w-full items-center justify-center">
        {type === "standard" && <StandardArt />}
        {type === "agent" && <AgentArt />}
        {type === "time_locked" && <TimeLockedArt />}
        {type === "multi_sig" && <MultiSigArt />}
        {type === "dispute" && <DisputeArt />}
        {type === "asa" && <AsaArt />}
      </div>

      {status && (
        <div className="absolute right-3 top-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${
              status === "locked"
                ? "bg-white/25 text-white ring-1 ring-white/40"
                : status === "released"
                  ? "bg-emerald-400/80 text-emerald-950"
                  : status === "killed"
                    ? "bg-red-500/80 text-white"
                    : "bg-white/20 text-white"
            }`}
          >
            {status}
          </span>
        </div>
      )}
    </div>
  )
}

function StandardArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      <rect x="32" y="50" width="56" height="48" rx="6" fill="currentColor" />
      <path d="M44 50V36a16 16 0 0 1 32 0v14" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="60" cy="72" r="6" fill="#0f172a" />
      <rect x="58" y="76" width="4" height="10" rx="1.5" fill="#0f172a" />
    </svg>
  )
}

function AgentArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      {/* antenna */}
      <line x1="60" y1="22" x2="60" y2="34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="20" r="3" fill="currentColor" />
      {/* head */}
      <rect x="32" y="34" width="56" height="46" rx="10" fill="currentColor" />
      {/* eyes */}
      <circle cx="48" cy="55" r="5" fill="#064e3b" />
      <circle cx="72" cy="55" r="5" fill="#064e3b" />
      <circle cx="49" cy="54" r="1.5" fill="white" />
      <circle cx="73" cy="54" r="1.5" fill="white" />
      {/* mouth */}
      <rect x="50" y="68" width="20" height="3" rx="1.5" fill="#064e3b" />
      {/* body bar */}
      <rect x="40" y="86" width="40" height="14" rx="4" fill="currentColor" opacity="0.85" />
      <circle cx="50" cy="93" r="2" fill="#064e3b" />
      <circle cx="60" cy="93" r="2" fill="#064e3b" />
      <circle cx="70" cy="93" r="2" fill="#064e3b" />
    </svg>
  )
}

function TimeLockedArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      <circle cx="60" cy="62" r="36" fill="currentColor" />
      <circle cx="60" cy="62" r="30" fill="none" stroke="#7c2d12" strokeWidth="2" />
      {/* tick marks */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * 90 * Math.PI) / 180
        const x1 = 60 + Math.cos(angle) * 28
        const y1 = 62 + Math.sin(angle) * 28
        const x2 = 60 + Math.cos(angle) * 32
        const y2 = 62 + Math.sin(angle) * 32
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7c2d12" strokeWidth="2" />
      })}
      {/* hands */}
      <line x1="60" y1="62" x2="60" y2="42" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="62" x2="76" y2="62" stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="62" r="3" fill="#7c2d12" />
      {/* lock badge */}
      <rect x="76" y="78" width="20" height="18" rx="3" fill="white" />
      <path d="M81 78v-4a4 4 0 0 1 8 0v4" fill="none" stroke="white" strokeWidth="3" />
      <circle cx="86" cy="87" r="2" fill="#7c2d12" />
    </svg>
  )
}

function MultiSigArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      {/* two keys overlapping */}
      <g transform="rotate(-25 60 60)">
        <circle cx="42" cy="56" r="14" fill="none" stroke="currentColor" strokeWidth="6" />
        <rect x="54" y="53" width="34" height="6" rx="2" fill="currentColor" />
        <rect x="78" y="53" width="6" height="12" rx="1.5" fill="currentColor" />
      </g>
      <g transform="rotate(25 60 60)">
        <circle cx="42" cy="56" r="14" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
        <rect x="54" y="53" width="34" height="6" rx="2" fill="white" opacity="0.7" />
        <rect x="78" y="53" width="6" height="12" rx="1.5" fill="white" opacity="0.7" />
      </g>
    </svg>
  )
}

function DisputeArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      {/* scales of justice */}
      <line x1="60" y1="22" x2="60" y2="100" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <line x1="30" y1="34" x2="90" y2="34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="22" r="5" fill="currentColor" />
      {/* left pan */}
      <line x1="30" y1="34" x2="30" y2="48" stroke="currentColor" strokeWidth="2" />
      <path d="M18 48h24l-4 12H22l-4-12Z" fill="currentColor" />
      {/* right pan */}
      <line x1="90" y1="34" x2="90" y2="48" stroke="currentColor" strokeWidth="2" />
      <path d="M78 48h24l-4 12H82l-4-12Z" fill="currentColor" />
      {/* base */}
      <rect x="46" y="98" width="28" height="6" rx="2" fill="currentColor" />
    </svg>
  )
}

function AsaArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] text-white drop-shadow-lg">
      {/* stack of coins */}
      <ellipse cx="60" cy="92" rx="34" ry="8" fill="currentColor" opacity="0.9" />
      <rect x="26" y="76" width="68" height="16" fill="currentColor" opacity="0.9" />
      <ellipse cx="60" cy="76" rx="34" ry="8" fill="currentColor" />

      <ellipse cx="60" cy="62" rx="34" ry="8" fill="currentColor" opacity="0.9" />
      <rect x="26" y="46" width="68" height="16" fill="currentColor" opacity="0.9" />
      <ellipse cx="60" cy="46" rx="34" ry="8" fill="currentColor" />

      <ellipse cx="60" cy="32" rx="28" ry="6.5" fill="currentColor" opacity="0.9" />
      <rect x="32" y="22" width="56" height="10" fill="currentColor" opacity="0.9" />
      <ellipse cx="60" cy="22" rx="28" ry="6.5" fill="currentColor" />
      <text x="60" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7c2d12">A</text>
    </svg>
  )
}
