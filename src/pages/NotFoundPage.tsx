import { Link } from "react-router-dom"
import { Button } from "@/components/Button"
import { RiArrowRightLine, RiHome3Line } from "@remixicon/react"
import { Logo } from "@/components/Logo"

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
      {/* Soft gradient halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_30%,hsl(var(--primary)/0.15),transparent_70%)]"
      />

      <Link to="/" className="mb-8 inline-flex items-center gap-2">
        <Logo className="h-8 w-auto" />
      </Link>

      <p className="font-mono text-sm uppercase tracking-widest text-primary">
        Error 404
      </p>
      <h1 className="mt-3 text-7xl font-bold tracking-tight text-foreground sm:text-8xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-balance text-base text-muted-foreground">
        The page you're looking for doesn't exist, was moved, or the link is broken.
        Let's get you back on track.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/">
            <RiHome3Line className="mr-2 size-4" />
            Back to dashboard
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/service-registry">
            Browse service registry <RiArrowRightLine className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Unsubscribely · On-chain subscription manager on Algorand
      </p>
    </div>
  )
}
