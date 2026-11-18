import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "SPARK — All-in-one AI-powered Workplace Platform",
  description:
    "One workspace. Every conversation. Every project. Every possibility. SPARK brings communication, video meetings, project management, tasks, documentation, and AI into one connected workplace environment.",
};

// Prevent theme flicker (FOUC) on initial paint by reading localStorage or prefers-color-scheme synchronously
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('spark_theme');var d=t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.setAttribute('data-theme','dark');}else{r.classList.remove('dark');r.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-[var(--spark-canvas)] text-[var(--spark-text-primary)] min-h-screen antialiased selection:bg-[var(--spark-highlight)] selection:text-[var(--spark-highlight-text)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
