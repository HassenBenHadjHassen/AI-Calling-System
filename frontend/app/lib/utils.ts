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
  if (phone1.startsWith("0")) {
    return phone1.replace(
      /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
      "$1 $2 $3 $4 $5"
    );
  }

  if (phone1.startsWith("33")) {
    return phone1.replace(
      /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
      "$1 $2 $3 $4 $5"
    );
  }

  if (phone1.startsWith("+216")) {
    return phone1.replace(/(\+216)(\d{2})(\d{3})(\d{3})/, "$1 $2 $3 $4");
  }

  return phone1;
}
