import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Geometric "S" Monogram Logo (Designed from user specification)
 */
export const SparkSLogo: React.FC<{
  className?: string;
  strokeWidth?: number;
}> = ({ className, strokeWidth = 3.6 }) => {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="SPARK S Logo"
    >
      <path
        d="M26 6L14 18V22H22V18M22 22L10 34"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Stylized Geometric "Spark" Wordmark (Designed from user specification)
 */
export const SparkWordmark: React.FC<{
  className?: string;
  strokeWidth?: number;
}> = ({ className, strokeWidth = 2.8 }) => {
  return (
    <svg
      viewBox="0 0 106 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="Spark"
    >
      {/* S */}
      <path
        d="M19 6.5L7 14L17.5 18.5L6.5 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* p */}
      <path
        d="M26 12V29M26 12H37V19.5L26 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* a */}
      <path
        d="M55 24H44V12H55V24L58.5 27.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* r */}
      <path
        d="M64 12V24M64 15L73 12L75.5 15.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* k */}
      <path
        d="M84 6.5V24M84 17L96 12M87 15.5L96.5 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface SparkLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  variant?: "auto" | "icon" | "wordmark" | "combo";
  withContainer?: boolean;
}

export const SparkLogo: React.FC<SparkLogoProps> = ({
  className,
  showWordmark = true,
  size = "md",
  href,
  variant = "auto",
  withContainer = true,
}) => {
  // Determine effective presentation mode
  let effectiveVariant: "icon" | "wordmark" | "combo" = "combo";
  if (variant === "icon") {
    effectiveVariant = "icon";
  } else if (variant === "wordmark") {
    effectiveVariant = "wordmark";
  } else if (variant === "combo") {
    effectiveVariant = "combo";
  } else {
    // auto
    effectiveVariant = showWordmark ? "combo" : "icon";
  }

  const iconSizes = {
    sm: { container: "w-6 h-6 rounded-[6px]", svg: "w-3.5 h-3.5", stroke: 3.4 },
    md: { container: "w-8 h-8 rounded-[8px]", svg: "w-4.5 h-4.5", stroke: 3.6 },
    lg: { container: "w-11 h-11 rounded-[10px]", svg: "w-6 h-6", stroke: 3.6 },
    xl: { container: "w-14 h-14 rounded-[12px]", svg: "w-8 h-8", stroke: 3.8 },
  };

  const wordmarkSizes = {
    sm: "h-5 w-auto",
    md: "h-6 w-auto",
    lg: "h-8 w-auto",
    xl: "h-10 w-auto",
  };

  const iconConfig = iconSizes[size];

  // Render standalone Wordmark
  if (effectiveVariant === "wordmark") {
    const wordmarkContent = (
      <div className={cn("inline-flex items-center text-[var(--spark-text-primary)] transition-colors duration-150 select-none", className)}>
        <SparkWordmark className={wordmarkSizes[size]} />
      </div>
    );

    if (href) {
      return (
        <Link href={href} className="inline-flex items-center group transition-opacity hover:opacity-90">
          {wordmarkContent}
        </Link>
      );
    }
    return wordmarkContent;
  }

  // Render standalone S Logo Icon
  if (effectiveVariant === "icon") {
    const iconContent = withContainer ? (
      <div
        className={cn(
          "inline-flex items-center justify-center bg-[var(--spark-accent)] text-white shadow-2xs transition-colors duration-150 group-hover:bg-[var(--spark-accent-hover)] select-none",
          iconConfig.container,
          className
        )}
      >
        <SparkSLogo className={iconConfig.svg} strokeWidth={iconConfig.stroke} />
      </div>
    ) : (
      <div className={cn("inline-flex items-center justify-center text-[var(--spark-accent)] select-none", className)}>
        <SparkSLogo className={iconConfig.svg} strokeWidth={iconConfig.stroke} />
      </div>
    );

    if (href) {
      return (
        <Link href={href} className="inline-flex items-center group transition-transform active:scale-95">
          {iconContent}
        </Link>
      );
    }
    return iconContent;
  }

  // Render Combo (Emblem + Wordmark)
  const comboContent = (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div
        className={cn(
          "inline-flex items-center justify-center bg-[var(--spark-accent)] text-white shadow-2xs transition-colors duration-150 group-hover:bg-[var(--spark-accent-hover)]",
          iconConfig.container
        )}
      >
        <SparkSLogo className={iconConfig.svg} strokeWidth={iconConfig.stroke} />
      </div>
      <div className="text-[var(--spark-text-primary)] transition-colors duration-150">
        <SparkWordmark className={wordmarkSizes[size]} />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group transition-opacity hover:opacity-90">
        {comboContent}
      </Link>
    );
  }

  return comboContent;
};
