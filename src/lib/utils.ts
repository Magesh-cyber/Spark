import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes redirect destination URLs to prevent Open Redirect vulnerabilities.
 * Strictly guarantees that return destinations are relative, internal paths.
 * Blocks absolute schemes (http, https, javascript, data), protocol-relative
 * paths (//), and backslash-based evasion techniques (/\ or \).
 */
export function getSafeRedirectUrl(target?: string | null, fallback = "/"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }
  const trimmed = target.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }
  return fallback;
}

