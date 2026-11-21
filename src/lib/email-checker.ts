import dns from "dns";

/**
 * Common disposable / temporary email domains that should never be permitted.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "fakemailgenerator.com",
  "trashmail.com",
  "getairmail.com",
  "dispostable.com",
  "mytemp.email",
  "nada.ltd",
  "temp-mail.org",
  "fakeinbox.com",
  "burnermail.io",
  "crazymailing.com",
  "generator.email",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "fake.com",
  "test.com",
  "asdasd.com",
  "example.com",
  "example.org",
  "example.net",
]);

const DISALLOWED_TLDS = new Set([
  "localhost",
  "local",
  "invalid",
  "example",
  "test",
  "internal",
  "lan",
  "fake",
]);

const EMAIL_SYNTAX_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface EmailLegitimacyResult {
  isValid: boolean;
  error?: string;
  domain?: string;
  normalizedEmail?: string;
}

/**
 * Validates whether an email address is syntactically sound, not disposable,
 * and possesses active mail routing (DNS MX or A records).
 */
export async function validateEmailLegitimacy(
  email: string
): Promise<EmailLegitimacyResult> {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  if (!EMAIL_SYNTAX_REGEX.test(trimmed)) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  const [localPart, rawDomain] = parts;

  // Local part validation
  if (!localPart || localPart.length > 64) {
    return { isValid: false, error: "Please enter a valid email address." };
  }
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  // Domain validation
  const domain = rawDomain.toLowerCase();
  if (!domain || domain.length > 253) {
    return { isValid: false, error: "Please enter a valid email address." };
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return { isValid: false, error: "Please enter a valid email address with a domain extension." };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,24}$/.test(tld) || DISALLOWED_TLDS.has(tld)) {
    return { isValid: false, error: "Please enter a valid email address." };
  }

  // Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: "Temporary or disposable email addresses are not permitted. Please enter a valid email address.",
    };
  }

  // DNS MX resolution check with timeout
  try {
    const hasActiveMailExchange = await checkDomainMailExchanger(domain);
    if (!hasActiveMailExchange) {
      return {
        isValid: false,
        error: "Please enter a valid email address. The domain cannot receive emails.",
        domain,
      };
    }
  } catch {
    // If DNS check encounters an unresolvable error
    return {
      isValid: false,
      error: "Please enter a valid email address.",
      domain,
    };
  }

  return {
    isValid: true,
    domain,
    normalizedEmail: `${localPart.toLowerCase()}@${domain}`,
  };
}

/**
 * Checks if a domain has valid DNS MX records, falling back to A records as per RFC 5321.
 */
async function checkDomainMailExchanger(domain: string): Promise<boolean> {
  const resolver = dns.promises;

  // Set a 3.5s timeout for DNS lookups to avoid slow networks blocking requests
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DNS_TIMEOUT")), 3500)
  );

  try {
    const mxLookup = resolver.resolveMx(domain);
    const mxRecords = await Promise.race([mxLookup, timeoutPromise]);
    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      return true;
    }
  } catch (err: any) {
    if (err.message === "DNS_TIMEOUT") {
      // In timeout scenarios (e.g. offline sandbox or slow DNS), allow standard domains
      return true;
    }
    // If ENOTFOUND or NXDOMAIN, domain definitely does not exist
    if (err.code === "ENOTFOUND" || err.code === "NXDOMAIN" || err.code === "NOTFOUND") {
      return false;
    }
    // For other errors (e.g., ENODATA - domain exists but has no MX record), fallback to A record check
  }

  try {
    const aLookup = resolver.resolve4(domain);
    const aRecords = await Promise.race([aLookup, timeoutPromise]);
    if (Array.isArray(aRecords) && aRecords.length > 0) {
      return true;
    }
  } catch (err: any) {
    if (err.message === "DNS_TIMEOUT") {
      return true;
    }
    return false;
  }

  return false;
}
