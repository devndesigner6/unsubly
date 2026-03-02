import { siteConfig } from "@/lib/siteConfig"

export function organizationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "Organization",
    name: siteConfig.name, url: siteConfig.url, logo: `${siteConfig.url}/logo.png`,
    description: siteConfig.description,
  })
}

export function webSiteJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "WebSite",
    name: siteConfig.name, url: siteConfig.url, description: siteConfig.description,
  })
}

export function softwareApplicationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: siteConfig.name, description: siteConfig.description, url: siteConfig.url,
    applicationCategory: "FinanceApplication", operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  })
}

export function faqPageJsonLd(questions: { question: string; answer: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question", name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  })
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name, item: `${siteConfig.url}${item.url}`,
    })),
  })
}

export function webPageJsonLd(page: { name: string; description: string; url: string }): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "WebPage",
    name: page.name, description: page.description, url: `${siteConfig.url}${page.url}`,
  })
}

export function productJsonLd(service: { name: string; description: string; url: string; category: string; price?: number | null; currency?: string }): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Product",
    name: service.name, description: service.description, category: service.category, url: service.url,
  }
  if (service.price != null && service.price > 0) {
    schema.offers = { "@type": "Offer", price: service.price, priceCurrency: service.currency || "USD" }
  }
  return JSON.stringify(schema)
}

export function definedTermJsonLd(term: { name: string; description: string; url: string }): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "DefinedTerm",
    name: term.name, description: term.description, url: `${siteConfig.url}${term.url}`,
  })
}

export function definedTermSetJsonLd(terms: { name: string; url: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "DefinedTermSet",
    name: "Subscription & SaaS Glossary", url: `${siteConfig.url}/glossary`,
    hasDefinedTerm: terms.map((t) => ({ "@type": "DefinedTerm", name: t.name, url: `${siteConfig.url}${t.url}` })),
  })
}

export function itemListJsonLd(name: string, description: string, items: { name: string; url: string }[]): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "ItemList", name, description,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: `${siteConfig.url}${item.url}` })),
  })
}

export function webApplicationJsonLd(tool: { name: string; description: string; url: string }): string {
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "WebApplication",
    name: tool.name, description: tool.description, url: `${siteConfig.url}${tool.url}`,
    applicationCategory: "FinanceApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  })
}
