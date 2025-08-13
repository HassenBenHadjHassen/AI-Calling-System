class TranslationService {
	private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
	private readonly STORAGE_KEY = "translations_en_fr";

	private getStoredTranslations(): Record<
		string,
		{ translation: string; timestamp: number }
	> {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			return stored ? JSON.parse(stored) : {};
		} catch (error) {
			console.error("Failed to parse stored translations:", error);
			return {};
		}
	}

	private setStoredTranslations(
		translations: Record<string, { translation: string; timestamp: number }>
	): void {
		try {
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(translations));
		} catch (error) {
			console.error("Failed to store translations:", error);
		}
	}

	private buildUrl(text: string): string {
		const baseUrl = "https://translate.googleapis.com/translate_a/single";
		const params = new URLSearchParams({
			client: "gtx",
			sl: "en",
			tl: "fr",
			dt: "t",
			q: text,
		});
		return `${baseUrl}?${params.toString()}`;
	}

	private parseTranslationResponse(data: unknown): string {
		// Expected minimal shape: [[ [ translatedText, originalText, ... ], ... ], ...]
		if (!Array.isArray(data) || !Array.isArray((data as unknown[])[0])) {
			return "";
		}
		const parts = (data as unknown[])[0];
		try {
			const translated = (parts as unknown[])
				.map((segment: unknown) =>
					Array.isArray(segment) ? (segment[0] as string) : ""
				)
				.join("");
			return translated || "";
		} catch (error) {
			console.error("Error while parsing translation response:", error);
			return "";
		}
	}

	async translateEnToFr(text: string): Promise<string> {
		const normalizedText = (text ?? "").trim();
		if (!normalizedText) return "";

		const stored = this.getStoredTranslations();
		const cached = stored[normalizedText];
		if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
			return cached.translation;
		}

		try {
			const response = await fetch(this.buildUrl(normalizedText));
			if (!response.ok) {
				throw new Error(`Translation API error: ${response.status}`);
			}
			const data = (await response.json()) as unknown;
			const translated = this.parseTranslationResponse(data);
			if (!translated) {
				throw new Error("Unable to parse translation response");
			}

			stored[normalizedText] = {
				translation: translated,
				timestamp: Date.now(),
			};
			this.setStoredTranslations(stored);
			return translated;
		} catch (error) {
			console.error("Failed to translate text:", error);
			// Fallback: return original text to avoid breaking UI
			return normalizedText;
		}
	}

	clearCache(): void {
		localStorage.removeItem(this.STORAGE_KEY);
	}
}

export const translationService = new TranslationService();
