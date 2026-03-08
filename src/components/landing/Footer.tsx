import { Link } from "react-router-dom"
import { Logo } from "@/components/Logo"
import { RiTwitterXLine, RiGithubLine, RiLinkedinLine } from "@remixicon/react"

const navigation = {
  product: [
    { name: "Features", href: "#features" },
    { name: "Blockchain", href: "#blockchain" },
    { name: "How It Works", href: "#how-it-works" },
  ],
  support: [
    { name: "Contact", href: "mailto:peddadahemanth6@gmail.com" },
  ],
}

const social = [
  { name: "Twitter", href: "https://x.com/hemanttbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/devndesigner6", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hemanthp15gr6", icon: RiLinkedinLine },
]

export function Footer() {
  return (
    <footer className="border-t border-border py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
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
              Decentralized subscription management powered by Algorand.
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
            <h3 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Support</h3>
            <ul className="mt-4 space-y-3">
              {navigation.support.map((item) => (
                <li key={item.name}>
                  <a href={item.href} className="text-sm text-foreground/70 transition-colors hover:text-foreground">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Unsubscribely. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built on Algorand
          </p>
        </div>
      </div>
    </footer>
  )
}
