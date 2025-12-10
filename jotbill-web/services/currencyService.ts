
export interface ExchangeRatesData {
  rates: Record<string, number>;
  lastUpdated: number;
}

const API_URL = 'https://open.er-api.com/v6/latest/CNY';
const CACHE_KEY = 'exchange_rates_cache';

// Default Fallback Rates (Base: CNY)
const DEFAULT_RATES: Record<string, number> = {
  'CNY': 1,
  'USD': 0.138,
  'EUR': 0.128,
  'JPY': 20.8,
  'GBP': 0.11,
  'HKD': 1.08,
  'CHF': 0.12,
};

export const fetchExchangeRates = async (): Promise<ExchangeRatesData> => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    
    const data = await res.json();
    if (data && data.rates) {
      const cache: ExchangeRatesData = {
        rates: data.rates,
        lastUpdated: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return cache;
    }
  } catch (e) {
    console.warn("Failed to fetch real-time rates, attempting to load cache...", e);
  }

  // Fallback to Cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate cache structure
      if (parsed && parsed.rates) {
          return parsed;
      }
    }
  } catch (e) {
    console.warn("Cache is corrupted", e);
  }

  // Final Fallback
  return {
    rates: DEFAULT_RATES,
    lastUpdated: 0 // Indicates default/stale data
  };
};

export const formatLastUpdated = (timestamp: number, language: 'en' | 'zh' | 'fr' = 'en'): string => {
    if (!timestamp) return language === 'zh' ? '使用默认汇率' : 'Using default rates';
    
    const date = new Date(timestamp);
    return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    });
};
