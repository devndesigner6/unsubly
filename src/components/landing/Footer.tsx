import { Link } from "react-router-dom"
import { Logo } from "@/components/Logo"
import { RiTwitterXLine, RiGithubLine, RiLinkedinLine, RiHeartFill } from "@remixicon/react"

const navigation = {
  product: [
    { name: "Features", href: "#features", isAnchor: true },
    { name: "How It Works", href: "#how-it-works", isAnchor: true },
  ],
  resources: [
    { name: "Browse Services", href: "/browse" },
    { name: "Compare Services", href: "/compare" },
  ],
  support: [
    { name: "Contact", href: "mailto:kalashvasaniya@gmail.com" },
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
  ],
}

const social = [
  { name: "Twitter", href: "https://x.com/kalashbuilds", icon: RiTwitterXLine },
  { name: "GitHub", href: "https://github.com/kalashvasaniya/unsubscribely", icon: RiGithubLine },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/kalashvasaniya/", icon: RiLinkedinLine },
]

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-10 dark:border-gray-800 dark:bg-gray-950 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link to="/" className="group flex items-center gap-2 sm:gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gray-900 transition-transform group-hover:scale-105 dark:bg-white sm:size-10 sm:rounded-xl">
                <Logo className="size-4 text-white dark:text-gray-900 sm:size-5" />
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white sm:text-xl">Unsubscribely</span>
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400 sm:mt-4 sm:text-sm">Track all your subscriptions in one place. Never miss a payment or forget about unused services again.</p>
            <div className="mt-4 flex gap-2 sm:mt-6 sm:gap-3">
              {social.map((item) => (
                <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-all hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:text-white sm:size-10">
                  <item.icon className="size-4 sm:size-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">Product</h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              {navigation.product.map((item) => (
                <li key={item.name}>
                  {item.isAnchor ? (
                    <a href={item.href} className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">{item.name}</a>
                  ) : (
                    <Link to={item.href} className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">{item.name}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">Resources</h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              {navigation.resources.map((item) => (
                <li key={item.name}><Link to={item.href} className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">{item.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">Support</h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              {navigation.support.map((item) => (
                <li key={item.name}>
                  {item.href.startsWith("mailto:") ? (
                    <a href={item.href} className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">{item.name}</a>
                  ) : (
                    <Link to={item.href} className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:text-sm">{item.name}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 dark:border-gray-800 sm:mt-12 sm:flex-row sm:gap-4 sm:pt-8 lg:mt-16">
          <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">&copy; {new Date().getFullYear()} Unsubscribely. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">Made with <RiHeartFill className="size-3.5 animate-pulse text-red-500 sm:size-4" /> for subscription sanity</p>
        </div>
      </div>
    </footer>
  )
}
