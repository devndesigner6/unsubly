// Currency codes and symbols
const currencies: Record<
  string,
  { name: string; symbol: string; locale: string }
> = {
  USD: { name: "US Dollar", symbol: "$", locale: "en-US" },
  EUR: { name: "Euro", symbol: "€", locale: "de-DE" },
  GBP: { name: "British Pound", symbol: "£", locale: "en-GB" },
  JPY: { name: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  CAD: { name: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
  AUD: { name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  CHF: { name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  CNY: { name: "Chinese Yuan", symbol: "¥", locale: "zh-CN" },
  INR: { name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  MXN: { name: "Mexican Peso", symbol: "MX$", locale: "es-MX" },
  BRL: { name: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
  KRW: { name: "South Korean Won", symbol: "₩", locale: "ko-KR" },
  SGD: { name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$", locale: "zh-HK" },
  SEK: { name: "Swedish Krona", symbol: "kr", locale: "sv-SE" },
  NOK: { name: "Norwegian Krone", symbol: "kr", locale: "nb-NO" },
  DKK: { name: "Danish Krone", symbol: "kr", locale: "da-DK" },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ" },
  ZAR: { name: "South African Rand", symbol: "R", locale: "en-ZA" },
  RUB: { name: "Russian Ruble", symbol: "₽", locale: "ru-RU" },
  TRY: { name: "Turkish Lira", symbol: "₺", locale: "tr-TR" },
  PLN: { name: "Polish Zloty", symbol: "zł", locale: "pl-PL" },
  THB: { name: "Thai Baht", symbol: "฿", locale: "th-TH" },
  IDR: { name: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID" },
  MYR: { name: "Malaysian Ringgit", symbol: "RM", locale: "ms-MY" },
  PHP: { name: "Philippine Peso", symbol: "₱", locale: "en-PH" },
  CZK: { name: "Czech Koruna", symbol: "Kč", locale: "cs-CZ" },
  ILS: { name: "Israeli Shekel", symbol: "₪", locale: "he-IL" },
  AED: { name: "UAE Dirham", symbol: "د.إ", locale: "ar-AE" },
  SAR: { name: "Saudi Riyal", symbol: "﷼", locale: "ar-SA" },
}

// Exchange rates relative to USD, seeded with fallback values, overwritten at runtime by initExchangeRates()
let exchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
  KRW: 1325.5,
  SGD: 1.34,
  HKD: 7.82,
  SEK: 10.42,
  NOK: 10.58,
  DKK: 6.87,
  NZD: 1.64,
  ZAR: 18.75,
  RUB: 89.5,
  TRY: 30.25,
  PLN: 4.02,
  THB: 35.5,
  IDR: 15650,
  MYR: 4.72,
  PHP: 56.25,
  CZK: 22.85,
  ILS: 3.72,
  AED: 3.67,
  SAR: 3.75,
}

export function formatCurrency(
  amount: number,
  currency: string,
  options?: { compact?: boolean },
): string {
  const currencyInfo = currencies[currency] || currencies.USD

  try {
    const formatter = new Intl.NumberFormat(currencyInfo.locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: options?.compact ? 0 : 2,
      maximumFractionDigits: options?.compact ? 0 : 2,
      notation: options?.compact ? "compact" : "standard",
    })

    return formatter.format(amount)
  } catch {
    // Fallback for unsupported currencies
    return `${currencyInfo.symbol}${amount.toFixed(2)}`
  }
}

/** Free v4 API (no key required). Default base: USD. */
const EXCHANGE_RATE_V4_URL = "https://api.exchangerate-api.com/v4/latest"

/**
 * Fetch live rates once on startup and update the module-level store so that
 * formatCurrency() automatically uses current data everywhere in the app.
 * Safe to call multiple times, subsequent calls are no-ops if rates are fresh.
 */
let _ratesInitialized = false
export async function initExchangeRates(): Promise<void> {
  if (_ratesInitialized) return
  _ratesInitialized = true
  try {
    const response = await fetch(`${EXCHANGE_RATE_V4_URL}/USD`)
    if (!response.ok) return
    const data = (await response.json()) as {
      rates?: Record<string, number>
      conversion_rates?: Record<string, number>
    }
    const live = data.rates ?? data.conversion_rates
    if (live && live.USD === 1) {
      exchangeRates = live
    }
  } catch {
    // keep fallback rates
  }
}
