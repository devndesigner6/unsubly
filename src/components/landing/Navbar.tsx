import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { cx } from "@/lib/utils"
import useScroll from "@/lib/useScroll"
import { RiMenuLine, RiCloseLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { useState } from "react"

const navigation = [
  { name: "Platform", href: "#features" },
  { name: "Blockchain", href: "#blockchain" },
  { name: "How It Works", href: "#how-it-works" },
]

export function Navbar() {
  const scrolled = useScroll(50)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-border bg-background/90 backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground transition-transform group-hover:scale-105">
            <Logo className="size-5 text-background" />
          </div>
          <span className="text-base font-medium tracking-tight text-foreground">
            Unsubscribely
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Log In</Link>
          </Button>
          <Button size="sm" asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-5">
            <Link to="/register">Get Started</Link>
          </Button>
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-xl hover:bg-muted md:hidden transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <RiCloseLine className="size-5 text-foreground" />
          ) : (
            <RiMenuLine className="size-5 text-foreground" />
          )}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="absolute inset-x-0 top-full border-t border-border bg-background/95 backdrop-blur-xl px-6 py-6 md:hidden">
          <div className="flex flex-col gap-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="px-4 py-3 text-base text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-6 mt-4 border-t border-border">
              <Button variant="secondary" asChild className="justify-center rounded-full">
                <Link to="/login">Log In</Link>
              </Button>
              <Button asChild className="justify-center rounded-full bg-foreground text-background">
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
