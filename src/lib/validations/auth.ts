import { z } from "zod";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidLegitEmail(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const email = val.trim();
  if (email.length < 5 || email.length > 254) return false;
  if (!EMAIL_REGEX.test(email)) return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;

  // Local part checks
  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;

  // Domain checks
  if (!domain || domain.length > 253) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;

  const domainParts = domain.split(".");
  if (domainParts.length < 2) return false;

  // TLD check: must be at least 2 characters and strictly alphabetical
  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,24}$/.test(tld)) return false;

  // Disallow localhost / invalid placeholder TLDs
  const disallowedTlds = new Set(["localhost", "local", "invalid", "example", "test"]);
  if (disallowedTlds.has(tld.toLowerCase())) return false;

  return true;
}

export const legitEmailSchema = z
  .string()
  .trim()
  .min(1, "Email address is required.")
  .email("Please enter a valid email address.")
  .refine(isValidLegitEmail, {
    message: "Please enter a valid, complete email address (e.g. name@company.com).",
  });

export const loginSchema = z.object({
  email: legitEmailSchema,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters.")
      .max(100, "Full name cannot exceed 100 characters."),
    email: legitEmailSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms of Service to proceed." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: legitEmailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[a-zA-Z]/, "Password must contain at least one letter.")
      .regex(/[0-9]/, "Password must contain at least one number."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name cannot exceed 100 characters."),
  avatarUrl: z.string().optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

