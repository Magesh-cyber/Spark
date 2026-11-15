import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SparkLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
}

export const SparkLogo: React.FC<SparkLogoProps> = ({
  className,
  showWordmark = true,
  size = "md",
  href,
}) => {
  const sizeMap = {
    sm: {
      icon: "w-5 h-5",
      text: "text-base tracking-tight",
      box: "h-7",
    },
    md: {
      icon: "w-6 h-6",
      text: "text-lg tracking-tight font-semibold",
      box: "h-8",
    },
    lg: {
      icon: "w-8 h-8",
      text: "text-2xl tracking-tight font-bold",
      box: "h-10",
    },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Precise geometric spark symbol: clean, non-decorative, professional */}
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-blue-600 text-white shadow-xs transition-colors",
          currentSize.icon
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          {/* Geometric Spark: 4-pointed symmetric star facet */}
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white" stroke="none" />
        </svg>
      </div>

      {showWordmark && (
        <span className={cn("text-slate-900 font-semibold tracking-tight", currentSize.text)}>
          SPARK
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group">
        {content}
      </Link>
    );
  }

  return content;
};

