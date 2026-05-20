import { Link } from "react-router-dom"
import { Logo } from "@/components/Logo"
import { RiTwitterXLine, RiGithubLine, RiLinkedinLine, RiTelegramLine } from "@remixicon/react"

const navigation = {
  product: [
    { name: "Features", href: "#features" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Blockchain", href: "#blockchain" },
    { name: "Pricing", href: "#pricing" },
  ],
  resources: [
    { name: "Documentation", href: "/docs" },
    { name: "GTM Plan", href: "/Unsubscribely-GTM-Plan.pdf", external: true },
    { name: "Telegram Bot", href: "https://t.me/unsublyybot", external: true },
    { name: "GitHub", href: "https://github.com/devndesigner6/unsubly", external: true },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Contact", href: "mailto:peddadahemanth6@gmail.com" },
  ],
}

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
  { name: "Telegram", href: "https://t.me/unsublyybot", icon: RiTelegramLine },
]

export function Footer() {
  return (
    <footer className="border-t border-border py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex size-9 items-center justify-center rounded-xl bg-foreground transition-transform group-hover:scale-105">
                <Logo className="size-5 text-background" />
              </div>
              <span className="text-base font-medium tracking-tight text-foreground">
                Unsubscribely
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              Autonomous subscription management powered by Algorand. Track, control, and cancel — all on-chain.
            </p>
            <div className="mt-6 flex gap-2">
              {social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow us on ${item.name}`}
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground"
                >
                  <item.icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {navigation.product.map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Resources</h3>
            <ul className="mt-4 space-y-3">
              {navigation.resources.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  {item.href.startsWith("mailto:") ? (
                    <a href={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                      {item.name}
                    </a>
                  ) : (
                    <Link to={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                      {item.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Unsubscribely. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Built on Algorand · Open Source
            </p>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground border border-border dark:border-white/10 rounded-full px-2.5 py-1">
              <img src="/icons/algorand-black.svg" alt="" className="size-3 dark:hidden" />
              <img src="/icons/algorand-white.svg" alt="" className="size-3 hidden dark:block" />
              AlgoBharat 2026
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
