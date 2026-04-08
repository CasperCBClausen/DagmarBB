import React from 'react';

interface CurrencyRates {
  EUR: number;
  USD: number;
  GBP: number;
  SEK: number;
  NOK: number;
}

interface UseCurrencyRatesResult {
  rates: CurrencyRates | null;
  loading: boolean;
}

// Static fallback rates (DKK → other currency, i.e. 1 DKK = x currency)
const FALLBACK_RATES: CurrencyRates = {
  EUR: 0.134,
  USD: 0.144,
  GBP: 0.114,
  SEK: 1.56,
  NOK: 1.60,
};

const CACHE_KEY = 'dagmar-currency-rates';
const CACHE_TS_KEY = 'dagmar-currency-ts';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function useCurrencyRates(): UseCurrencyRatesResult {
  const [rates, setRates] = React.useState<CurrencyRates | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Check sessionStorage cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const cachedTs = sessionStorage.getItem(CACHE_TS_KEY);
      if (cached && cachedTs) {
        const age = Date.now() - parseInt(cachedTs, 10);
        if (age < CACHE_TTL_MS) {
          setRates(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    // Fetch from frankfurter.app: base DKK, amount per 1 DKK
    fetch('https://api.frankfurter.app/latest?from=DKK&to=EUR,USD,GBP,SEK,NOK')
      .then(r => r.json())
      .then((data: { rates: Record<string, number> }) => {
        const r: CurrencyRates = {
          EUR: data.rates.EUR ?? FALLBACK_RATES.EUR,
          USD: data.rates.USD ?? FALLBACK_RATES.USD,
          GBP: data.rates.GBP ?? FALLBACK_RATES.GBP,
          SEK: data.rates.SEK ?? FALLBACK_RATES.SEK,
          NOK: data.rates.NOK ?? FALLBACK_RATES.NOK,
        };
        setRates(r);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(r));
          sessionStorage.setItem(CACHE_TS_KEY, Date.now().toString());
        } catch {
          // ignore
        }
      })
      .catch(() => {
        setRates(FALLBACK_RATES);
      })
      .finally(() => setLoading(false));
  }, []);

  return { rates, loading };
}
