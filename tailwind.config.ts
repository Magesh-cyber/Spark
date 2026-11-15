import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SPARK Visual Tokens
        spark: {
          blue: {
            DEFAULT: "#2563EB",
            hover: "#1D4ED8",
            subtle: "#EFF6FF",
          },
          violet: {
            DEFAULT: "#7C3AED",
            subtle: "#F5F3FF",
          },
          bg: "#F8FAFC",
          surface: {
            DEFAULT: "#FFFFFF",
            secondary: "#F1F5F9",
          },
          text: {
            primary: "#0F172A",
            secondary: "#475569",
            muted: "#94A3B8",
          },
          border: {
            DEFAULT: "#E2E8F0",
            strong: "#CBD5E1",
          },
          status: {
            success: "#16A34A",
            warning: "#D97706",
            error: "#DC2626",
            info: "#2563EB",
          },
        },
      },
      borderRadius: {
        control: "8px",
        card: "10px",
        modal: "12px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
        modal: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;

