import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(date: string) {
	const dateObj = new Date(date);

	return new Intl.DateTimeFormat("fr-FR", {
		timeZone: "Europe/Paris",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(dateObj);
}

export function formatPhoneNumber(phone1: string) {
	// Remove any non-digit characters
	const cleaned = phone1.replace(/\D/g, "");

	// If it starts with 0, remove it and add +33
	if (cleaned.startsWith("0")) {
		return "+33" + cleaned.substring(1);
	}

	// If it already starts with 33, add the + prefix
	if (cleaned.startsWith("33")) {
		return "+" + cleaned;
	}

	// If it's already in international format, return as is
	if (cleaned.startsWith("+")) {
		return phone1;
	}

	// Default case: assume it's a French number and add +33
	return "+33" + cleaned;
}
