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
      icon: "w-6 h-6",
      svg: "w-3.5 h-3.5",
      text: "text-base tracking-tight",
    },
    md: {
      icon: "w-7 h-7",
      svg: "w-4 h-4",
      text: "text-[17px] tracking-tight font-semibold",
    },
    lg: {
      icon: "w-9 h-9",
      svg: "w-5 h-5",
      text: "text-2xl tracking-tight font-bold",
    },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Geometric Spark Emblem — Royal Violet (Light) / Luminous Violet (Dark) */}
      <div
        className={cn(
          "flex items-center justify-center rounded-[8px] bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white shadow-xs ring-1 ring-inset ring-white/15 transition-all duration-150 group-hover:brightness-110",
          currentSize.icon
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={currentSize.svg}
          aria-hidden="true"
        >
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="white"
          />
        </svg>
      </div>

      {showWordmark && (
        <span
          className={cn(
            "text-[var(--spark-text-primary)] font-semibold tracking-tight transition-colors duration-150",
            currentSize.text
          )}
        >
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
