# Unsubscribely

A free, open-source subscription management application built with Next.js 16, MongoDB, and Tremor UI. Track all your subscriptions in one place, get payment reminders, and visualize your spending with beautiful analytics. Includes a large-scale programmatic SEO system generating 100,000+ pages for service comparisons, alternatives, pricing, glossary, and more.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)

## Features

### Core App
- **Subscription Tracking** - Add and manage all your subscriptions with details like billing cycle, amount, and category
- **Payment Reminders** - Get email notifications before payments are due
- **Analytics Dashboard** - Visualize your spending patterns with interactive charts
- **Folders & Tags** - Organize subscriptions with custom folders and tags
- **Multi-Currency Support** - Track subscriptions in different currencies with automatic conversion
- **Import/Export** - Import subscriptions from CSV or export your data
- **Calendar View** - See upcoming payments in a calendar format
- **Dark Mode** - Full dark mode support

### SEO & Programmatic SEO (pSEO)
- **Service Directory** - Browse 100+ subscription services across 13 categories (`/browse`, `/browse/[category]`)
- **Service Pages** - Individual pages for each subscription service with pricing, features, and alternatives (`/services/[slug]`)
- **Comparison Pages** - ~103,000 head-to-head comparison pages generated programmatically (`/compare/[...slugs]`)
- **Alternatives Pages** - Find alternatives to any tracked service (`/alternatives/[slug]`)
- **Pricing Pages** - Detailed pricing breakdowns with long-term cost projections (`/pricing/[slug]`)
- **Glossary** - 50+ subscription and SaaS terminology definitions with A-Z navigation (`/glossary`, `/glossary/[term]`)
- **Persona Pages** - Targeted landing pages for 8 user personas (freelancers, students, families, etc.) (`/for/[persona]`)
- **Tools** - Free interactive tools like the subscription cost calculator (`/tools/subscription-cost-calculator`)
- **Structured Data** - Rich JSON-LD schemas (Organization, WebSite, Product, FAQPage, BreadcrumbList, DefinedTerm, and more)
- **Sitemap Architecture** - Sitemap index with chunked sitemaps handling 100k+ URLs
- **SEO Best Practices** - Canonical URLs, Open Graph tags, Twitter Cards, robots.txt, and dynamic metadata on every page

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Database**: [MongoDB](https://www.mongodb.com/) with Mongoose ODM
- **Authentication**: [NextAuth.js v5](https://authjs.dev/) with Google OAuth
- **UI Components**: [Tremor](https://tremor.so/) + [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Email**: [Resend](https://resend.com/)
- **SEO**: Structured Data (JSON-LD), Dynamic Sitemaps, Programmatic Page Generation

## Getting Started

### Prerequisites

- Node.js 18.x or later
- MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Google OAuth credentials
- (Optional) Resend API key for email notifications

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/kalashvasaniya/unsubscribely.git
cd unsubscribely
```

2. **Install dependencies**

```bash
npm install
# or
pnpm install
```

3. **Set up environment variables**

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

4. **Run the development server**

```bash
npm run dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database (Required)
MONGODB_URI=mongodb+srv://your-connection-string

# Authentication (Required)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Optional - for payment reminders)
RESEND_API_KEY=your-resend-api-key
RESEND_EMAIL_FROM=hello@yourdomain.com
RESEND_EMAIL_REPLY_TO=support@yourdomain.com

# Cron Jobs (Optional - for automated alerts)
CRON_SECRET=your-cron-secret

# Currency Conversion (Optional)
EXCHANGE_RATE_API_KEY=your-api-key-or-url
```

See [.env.example](.env.example) for more details on each variable.

## Project Structure

```
src/
â”œâ”€â”€ app/                    # Next.js App Router pages
â”‚   â”œâ”€â”€ (auth)/            # Authentication pages (login, register)
â”‚   â”œâ”€â”€ (dashboard)/       # Dashboard pages (protected routes)
â”‚   â”œâ”€â”€ (marketing)/       # Public marketing pages
â”‚   â”‚   â”œâ”€â”€ browse/        # Service directory hub & category pages
â”‚   â”‚   â”œâ”€â”€ services/      # Individual service pages
â”‚   â”‚   â”œâ”€â”€ compare/       # Head-to-head comparison pages
â”‚   â”‚   â”œâ”€â”€ alternatives/  # Alternatives pages
â”‚   â”‚   â”œâ”€â”€ pricing/       # Pricing breakdown pages
â”‚   â”‚   â”œâ”€â”€ glossary/      # Subscription glossary
â”‚   â”‚   â”œâ”€â”€ for/           # Persona-targeted landing pages
â”‚   â”‚   â””â”€â”€ tools/         # Free interactive tools
â”‚   â”œâ”€â”€ api/               # API routes
â”‚   â”œâ”€â”€ sitemap.ts         # Main sitemap (~1,500 URLs)
â”‚   â”œâ”€â”€ sitemap-index.xml/ # Sitemap index for chunked sitemaps
â”‚   â”œâ”€â”€ sitemaps/          # Chunked sitemaps (~103k comparison URLs)
â”‚   â””â”€â”€ robots.ts          # Robots.txt configuration
â”œâ”€â”€ components/            # React components
â”‚   â”œâ”€â”€ analytics/         # Analytics charts
â”‚   â”œâ”€â”€ dashboard/         # Dashboard components
â”‚   â”œâ”€â”€ landing/           # Landing page sections
â”‚   â”œâ”€â”€ pseo/              # pSEO components (breadcrumbs, CTAs, comparison tables)
â”‚   â”œâ”€â”€ subscriptions/     # Subscription forms
â”‚   â””â”€â”€ ui/                # Reusable UI components
â”œâ”€â”€ data/
â”‚   â””â”€â”€ pseo/              # Programmatic SEO data
â”‚       â”œâ”€â”€ services/      # 100+ subscription service definitions (13 categories)
â”‚       â”œâ”€â”€ comparisons.ts # Comparison pair generation (~103k combinations)
â”‚       â”œâ”€â”€ glossary.ts    # 50+ glossary terms
â”‚       â””â”€â”€ personas.ts    # 8 persona definitions
â”œâ”€â”€ lib/                   # Utility functions and configurations
â”‚   â””â”€â”€ jsonld.ts          # JSON-LD structured data generators
â”œâ”€â”€ models/                # Mongoose database models
â””â”€â”€ types/                 # TypeScript type definitions
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/subscriptions` | GET, POST | List/create subscriptions |
| `/api/subscriptions/[id]` | GET, PUT, DELETE | Manage single subscription |
| `/api/folders` | GET, POST | List/create folders |
| `/api/tags` | GET, POST | List/create tags |
| `/api/analytics` | GET | Get spending analytics |
| `/api/alerts/send` | POST | Trigger payment alerts |

## Programmatic SEO (pSEO)

The project includes a large-scale programmatic SEO system that generates **100,000+ pages** to drive organic traffic.

### Page Types

| Route Pattern | Pages | Description |
|---------------|-------|-------------|
| `/browse` | 1 | Service directory hub with 13 categories |
| `/browse/[category]` | 13 | Category listing pages |
| `/services/[slug]` | 100+ | Individual service detail pages |
| `/compare/[...slugs]` | ~103,000 | Head-to-head service comparisons |
| `/alternatives/[slug]` | 100+ | Alternative services pages |
| `/pricing/[slug]` | 100+ | Detailed pricing breakdowns |
| `/glossary` | 1 | Glossary hub (A-Z index) |
| `/glossary/[term]` | 50+ | Individual term definitions |
| `/for/[persona]` | 8 | Persona-targeted landing pages |
| `/tools` | 1 | Tools hub |
| `/tools/[tool]` | 1+ | Interactive tools (cost calculator, etc.) |

### Structured Data (JSON-LD)

Every page includes relevant structured data for rich search results:

- **Organization** & **WebSite** â€” site-wide identity and sitelinks search
- **SoftwareApplication** â€” app-level schema with ratings and features
- **Product** â€” service pages with pricing offers
- **ItemList** â€” directory and category pages
- **BreadcrumbList** â€” navigation hierarchy
- **DefinedTerm** / **DefinedTermSet** â€” glossary entries
- **WebApplication** â€” interactive tools
- **FAQPage** â€” FAQ sections for featured snippets

### Sitemap Architecture

- **Sitemap Index** (`/sitemap-index.xml`) â€” references all sitemap chunks
- **Main Sitemap** (`/sitemap.xml`) â€” ~1,500 core URLs with priorities and change frequencies
- **Chunked Sitemaps** (`/sitemaps/[id]`) â€” 40,000 URLs per chunk for comparison pages

### Adding New Services

To add a new subscription service to the pSEO system:

1. Add the service definition to the appropriate file in `src/data/pseo/services/`
2. The service automatically gets pages for: service detail, alternatives, pricing, and all comparison combinations
3. The sitemaps regenerate automatically on build

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kalashvasaniya/unsubscribely)

1. Click the deploy button above
2. Add your environment variables in the Vercel dashboard
3. Deploy!

### Self-Hosted

1. Build the application:

```bash
npm run build
```

2. Start the production server:

```bash
npm start
```

### Docker

```bash
# Build the image
docker build -t unsubscribely .

# Run the container
docker run -p 3000:3000 --env-file .env.local unsubscribely
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is based on the **Tremor Planner** template and is licensed under the MIT license provided by **Tremor Labs, Inc.**  
See the [LICENSE](LICENSE.md) file and the original [Tremor license information](https://blocks.tremor.so/license) for full details.

## Acknowledgments

- [Tremor](https://tremor.so/) for the beautiful UI components
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Vercel](https://vercel.com/) for hosting and deployment

## Support

If you find this project helpful, please consider:

- Giving it a star on GitHub
- [Sponsoring the project](https://github.com/sponsors/kalashvasaniya)
- Sharing it with others

---

Built with love by [Kalash Vasaniya](https://github.com/kalashvasaniya)
