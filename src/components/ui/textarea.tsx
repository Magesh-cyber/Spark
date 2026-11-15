import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-700 select-none"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          disabled={disabled}
          className={cn(
            "flex min-h-[80px] w-full rounded-[8px] border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200",
            error
              ? "border-red-500 focus-visible:ring-red-500"
              : "border-slate-200 hover:border-slate-300",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-600 font-normal">{error}</p>}
        {!error && hint && <p className="text-xs text-slate-500 font-normal">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

