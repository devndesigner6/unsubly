import { Button } from "@/components/Button"
import { Logo } from "@/components/Logo"
import { RiMenuLine, RiCloseLine, RiMoonLine, RiSunLine } from "@remixicon/react"
import { Link } from "react-router-dom"
import { useState, useRef } from "react"
import { useTheme } from "next-themes"
import { motion, useScroll as useMotionScroll, useMotionValueEvent } from "motion/react"

const navigation = [
  { name: "Platform", href: "#features" },
  { name: "Blockchain", href: "#blockchain" },
  { name: "How It Works", href: "#how-it-works" },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [hidden, setHidden] = useState(false)
  const { scrollY } = useMotionScroll()
  const lastScrollY = useRef(0)

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastScrollY.current
    if (latest > prev && latest > 150) {
      setHidden(true)
    } else {
      setHidden(false)
    }
    lastScrollY.current = latest
  })

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark")

  return (
    <motion.header
      animate={{ y: hidden ? -100 : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center pt-4 px-4"
    >
      {/* Floating pill navbar */}
      <nav className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 backdrop-blur-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_-4px_rgba(0,0,0,0.3)] px-2 py-1.5 max-w-fit">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 pl-2 pr-3 group">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground transition-transform group-hover:scale-105">
            <Logo className="size-3.5 text-background" />
          </div>
          <span className="text-sm font-medium tracking-tight text-foreground hidden sm:block">
            Unsubscribely
          </span>
        </Link>

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-border/60 mx-1" />

        {/* Nav links */}
        <div className="hidden md:flex items-center">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground rounded-full hover:bg-muted/50"
            >
              {item.name}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-border/60 mx-1" />

        {/* Right side actions */}
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <RiSunLine className="size-3.5" /> : <RiMoonLine className="size-3.5" />}
          </button>
          <Link
            to="/login"
            className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
          >
            Log In
          </Link>
          <Link
            to="/register"
            className="px-4 py-1.5 text-[13px] font-medium bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={toggleTheme}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <RiSunLine className="size-4" /> : <RiMoonLine className="size-4" />}
          </button>
          <button
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <RiCloseLine className="size-4 text-foreground" />
            ) : (
              <RiMenuLine className="size-4 text-foreground" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 inset-x-4 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-lg px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 mt-3 border-t border-border/60">
              <Button variant="secondary" asChild className="justify-center rounded-full">
                <Link to="/login">Log In</Link>
              </Button>
              <Button asChild className="justify-center rounded-full bg-foreground text-background">
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
