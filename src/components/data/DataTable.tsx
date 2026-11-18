import * as React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyState,
  className,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)]",
        className
      )}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/70 text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-secondary)]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn("px-4 py-3 first:pl-5 last:pr-5", column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--spark-border)]">
          {data.map((item) => {
            const key = keyExtractor(item);
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "transition-colors duration-150 hover:bg-[var(--spark-surface-subtle)]/50",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((column, colIndex) => {
                  const content = column.cell
                    ? column.cell(item)
                    : column.accessorKey
                    ? (item[column.accessorKey] as React.ReactNode)
                    : null;

                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        "px-4 py-3 text-xs text-[var(--spark-text-secondary)] first:pl-5 last:pr-5 first:font-medium first:text-[var(--spark-text-primary)]",
                        column.className
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
