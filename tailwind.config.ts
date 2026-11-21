import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SPARK Dual-Theme Purple & Violet Tokens
        spark: {
          canvas: "var(--spark-canvas)",
          surface: {
            DEFAULT: "var(--spark-surface)",
            subtle: "var(--spark-surface-subtle)",
            secondary: "var(--spark-surface-subtle)",
          },
          border: {
            DEFAULT: "var(--spark-border)",
            strong: "var(--spark-border-strong)",
          },
          text: {
            primary: "var(--spark-text-primary)",
            secondary: "var(--spark-text-secondary)",
            muted: "var(--spark-text-muted)",
          },
          accent: {
            DEFAULT: "var(--spark-accent)",
            hover: "var(--spark-accent-hover)",
            fg: "var(--spark-accent-fg)",
          },
          highlight: {
            DEFAULT: "var(--spark-highlight)",
            text: "var(--spark-highlight-text)",
          },
          bg: "var(--spark-canvas)",
          violet: {
            DEFAULT: "var(--spark-accent)",
            hover: "var(--spark-accent-hover)",
            subtle: "var(--spark-highlight)",
          },
          status: {
            success: "#10B981",
            warning: "#F59E0B",
            error: "#EF4444",
            info: "var(--spark-accent)",
          },
        },
      },
      borderRadius: {
        control: "6px",
        card: "10px",
        modal: "12px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        "2xs": "0 1px 1.5px 0 rgba(36, 30, 38, 0.04)",
        xs: "0 1px 2px 0 rgba(36, 30, 38, 0.06)",
        subtle: "0 1px 3px 0 rgba(36, 30, 38, 0.06), 0 1px 2px -1px rgba(36, 30, 38, 0.04)",
        card: "0 2px 6px -1px rgba(74, 53, 79, 0.06), 0 1px 3px 0 rgba(36, 30, 38, 0.04)",
        elevated:
          "0 10px 24px -4px rgba(36, 30, 38, 0.1), 0 3px 8px -2px rgba(36, 30, 38, 0.05)",
        modal:
          "0 24px 48px -12px rgba(36, 30, 38, 0.22), 0 8px 16px -4px rgba(36, 30, 38, 0.08)",
        "plum-focus": "0 0 0 2px rgba(107, 78, 113, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
