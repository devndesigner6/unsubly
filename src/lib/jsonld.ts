import { siteConfig } from "@/lib/siteConfig"

// â”€â”€ Organization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function organizationJsonLd(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    description: siteConfig.description,
    sameAs: [
      "https://x.com/kalashbuilds",
      "https://github.com/kalashvasaniya/unsubscribely",
      "https://www.linkedin.com/in/kalashvasaniya/",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "kalashvasaniya@gmail.com",
      contactType: "customer support",
    },
  }
  return JSON.stringify(schema)
}

// â”€â”€ WebSite (with SearchAction for sitelinks search) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function webSiteJsonLd(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/browse?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
  return JSON.stringify(schema)
}

// â”€â”€ SoftwareApplication â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function softwareApplicationJsonLd(): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "500",
      bestRating: "5",
      worstRating: "1",
    },
    featureList: [
      "Subscription tracking",
      "Payment alerts",
      "Spending analytics",
      "Calendar view",
      "Multi-currency support",
      "CSV import/export",
    ],
  }
  return JSON.stringify(schema)
}

// â”€â”€ WebPage (for generic pages like Privacy, Terms) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function webPageJsonLd(page: {
  name: string
  description: string
  url: string
  dateModified?: string
}): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.name,
    description: page.description,
    url: `${siteConfig.url}${page.url}`,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    ...(page.dateModified ? { dateModified: page.dateModified } : {}),
  }
  return JSON.stringify(schema)
}

// â”€â”€ Breadcrumb List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function breadcrumbJsonLd(
  items: { name: string; url: string }[]
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  }
  return JSON.stringify(schema)
}

// â”€â”€ Item List (for browse / directory pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function itemListJsonLd(
  name: string,
  description: string,
  items: { name: string; url: string; description?: string; image?: string }[]
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${siteConfig.url}${item.url}`,
      ...(item.description ? { description: item.description } : {}),
    })),
  }
  return JSON.stringify(schema)
}

// â”€â”€ Product (for comparison / service pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function productJsonLd(service: {
  name: string
  description: string
  url: string
  category: string
  price?: number | null
  currency?: string
}): string {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: service.name,
    description: service.description,
    category: service.category,
    url: service.url,
  }
  if (service.price != null && service.price > 0) {
    schema.offers = {
      "@type": "Offer",
      price: service.price,
      priceCurrency: service.currency || "USD",
      availability: "https://schema.org/InStock",
    }
  }
  return JSON.stringify(schema)
}

// â”€â”€ Defined Term (for glossary pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function definedTermJsonLd(term: {
  name: string
  description: string
  url: string
}): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.name,
    description: term.description,
    url: `${siteConfig.url}${term.url}`,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Subscription & SaaS Glossary",
      url: `${siteConfig.url}/glossary`,
    },
  }
  return JSON.stringify(schema)
}

// â”€â”€ Defined Term Set (for glossary hub) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function definedTermSetJsonLd(
  terms: { name: string; url: string }[]
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Subscription & SaaS Glossary",
    description:
      "Comprehensive glossary of subscription, SaaS, and recurring billing terminology.",
    url: `${siteConfig.url}/glossary`,
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.name,
      url: `${siteConfig.url}${t.url}`,
    })),
  }
  return JSON.stringify(schema)
}

// â”€â”€ Web Application (for tools pages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function webApplicationJsonLd(tool: {
  name: string
  description: string
  url: string
}): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    description: tool.description,
    url: `${siteConfig.url}${tool.url}`,
    applicationCategory: "FinanceApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
  }
  return JSON.stringify(schema)
}

// â”€â”€ FAQ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function faqPageJsonLd(
  questions: { question: string; answer: string }[]
): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  }
  return JSON.stringify(schema)
}
