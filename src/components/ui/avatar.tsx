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
    sm: "h-2 w-2 ring-1",
    md: "h-2.5 w-2.5 ring-2",
    lg: "h-3 w-3 ring-2",
    xl: "h-3.5 w-3.5 ring-2",
  };

  const statusColor = {
    online: "bg-emerald-500",
    busy: "bg-red-500",
    away: "bg-amber-500",
    offline: "bg-slate-400",
  };

  // Generate initials
  const initials = React.useMemo(() => {
    if (!name) return alt ? alt.slice(0, 2).toUpperCase() : "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name, alt]);

  // Generate subtle predictable pastel-neutral background from name
  const bgHue = React.useMemo(() => {
    if (!name) return "bg-slate-100 text-slate-700";
    const colors = [
      "bg-blue-50 text-blue-700",
      "bg-slate-100 text-slate-700",
      "bg-indigo-50 text-indigo-700",
      "bg-sky-50 text-sky-700",
      "bg-teal-50 text-teal-700",
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
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none border border-slate-200/80 overflow-hidden",
        sizeClasses[size],
        bgHue,
        className
      )}
      {...props}
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

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-white",
            statusSize[size],
            statusColor[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};

