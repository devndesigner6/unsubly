import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/subscriptions/",
          "/settings/",
          "/analytics/",
          "/calendar/",
          "/folders/",
          "/tags/",
          "/payment-methods/",
          "/login",
          "/register",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
    ],
    sitemap: "https://unsubscribely.com/sitemap-index.xml",
    host: "https://unsubscribely.com",
  }
}
