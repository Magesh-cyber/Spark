import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "SPARK — All-in-one AI-powered Workplace Platform",
  description:
    "One workspace. Every conversation. Every project. Every possibility. SPARK brings communication, video meetings, project management, tasks, documentation, and AI into one connected workplace environment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
