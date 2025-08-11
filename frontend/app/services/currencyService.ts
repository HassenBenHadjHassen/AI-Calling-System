const API_KEY = import.meta.env.VITE_FCV_API_KEY;
const BASE_URL = "https://api.freecurrencyapi.com/v1";

interface CurrencyResponse {
	data: {
		[currency: string]: number;
	};
}

class CurrencyService {
	private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
	private readonly STORAGE_KEY = "currency_exchange_rates";

	private getStoredRates(): Record<
		string,
		{ rate: number; timestamp: number }
	> {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			return stored ? JSON.parse(stored) : {};
		} catch (error) {
			console.error("Failed to parse stored exchange rates:", error);
			return {};
		}
	}

	private setStoredRates(
		rates: Record<string, { rate: number; timestamp: number }>
	): void {
		try {
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rates));
		} catch (error) {
			console.error("Failed to store exchange rates:", error);
		}
	}

	async getExchangeRate(from: string, to: string): Promise<number> {
		const cacheKey = `${from}_${to}`;
		const storedRates = this.getStoredRates();
		const cached = storedRates[cacheKey];

		// Return cached rate if still valid (less than 24 hours old)
		if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
			console.log(
				`Using cached exchange rate for ${from} to ${to}: ${cached.rate}`
			);
			return cached.rate;
		}

		try {
			const response = await fetch(
				`${BASE_URL}/latest?apikey=${API_KEY}&base_currency=${from}&currencies=${to}`
			);

			if (!response.ok) {
				throw new Error(`Currency API error: ${response.status}`);
			}

			const data: CurrencyResponse = await response.json();
			const rate = data.data[to];

			if (!rate) {
				throw new Error(`Exchange rate not found for ${from} to ${to}`);
			}

			// Store the result
			const storedRates = this.getStoredRates();
			storedRates[cacheKey] = { rate, timestamp: Date.now() };
			this.setStoredRates(storedRates);

			console.log(`Fetched new exchange rate for ${from} to ${to}: ${rate}`);
			return rate;
		} catch (error) {
			console.error("Failed to fetch exchange rate:", error);

			// Return fallback rate if API fails
			const fallbackRates: Record<string, number> = {
				USD_EUR: 0.86,
				EUR_USD: 1.17,
			};

			return fallbackRates[cacheKey] || 1;
		}
	}

	async convertUSDToEUR(usdAmount: number): Promise<number> {
		const rate = await this.getExchangeRate("USD", "EUR");
		return usdAmount * rate;
	}

	clearCache(): void {
		localStorage.removeItem(this.STORAGE_KEY);
		console.log("Cleared stored exchange rates");
	}
}

export const currencyService = new CurrencyService();
