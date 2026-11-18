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
        "2xs": "0 1px 1px 0 rgba(20, 17, 31, 0.04)",
        xs: "0 1px 2px 0 rgba(20, 17, 31, 0.06)",
        subtle: "0 1px 2px 0 rgba(20, 17, 31, 0.05)",
        card: "0 2px 8px -2px rgba(109, 40, 217, 0.08), 0 1px 2px 0 rgba(20, 17, 31, 0.04)",
        elevated:
          "0 8px 20px -4px rgba(20, 17, 31, 0.12), 0 2px 6px -2px rgba(20, 17, 31, 0.06)",
        modal:
          "0 20px 35px -8px rgba(13, 11, 20, 0.25), 0 8px 14px -6px rgba(13, 11, 20, 0.14)",
        "violet-glow": "0 0 0 2px rgba(139, 92, 246, 0.55), 0 0 24px rgba(139, 92, 246, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
