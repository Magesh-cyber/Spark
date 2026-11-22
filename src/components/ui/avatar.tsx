import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "busy" | "away";
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = "md",
  status,
  className,
  ...props
}) => {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
    xl: "h-12 w-12 text-base",
  };

  const statusSize = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
    xl: "h-4 w-4",
  };

  const statusColor = {
    online: "bg-[#10B981]",
    busy: "bg-rose-500",
    away: "bg-[#F59E0B]",
    offline: "bg-zinc-300 dark:bg-zinc-600",
  };

  // Generate initials
  const initials = React.useMemo(() => {
    if (!name) return alt ? alt.slice(0, 2).toUpperCase() : "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name, alt]);

  // Subtle predictable violet-harmonized hues that work cleanly in both Light & Dark mode
  const bgHue = React.useMemo(() => {
    if (!name) return "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)]";
    const colors = [
      "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200",
      "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200",
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200",
      "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/45 dark:text-fuchsia-200",
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/45 dark:text-emerald-200",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [name]);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none transition-colors duration-150",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full w-full rounded-full border border-[var(--spark-border)] overflow-hidden flex items-center justify-center",
          bgHue
        )}
      >
        {src && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt || name || "Avatar"}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--spark-surface)] shadow-xs transition-colors duration-150",
            statusSize[size],
            statusColor[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};
