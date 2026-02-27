import { useState } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;
export type SortConfig = { key: string; direction: SortDirection };

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({ label, sortKey, currentSort, onSort, className }: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className || ""}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

export function useSort(defaultKey = "", defaultDir: SortDirection = null) {
  const [sort, setSort] = useState<SortConfig>({ key: defaultKey, direction: defaultDir });

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return { sort, handleSort };
}

export function sortData<T>(data: T[], sort: SortConfig, getVal: (item: T, key: string) => any): T[] {
  if (!sort.key || !sort.direction) return data;
  return [...data].sort((a, b) => {
    let va = getVal(a, sort.key);
    let vb = getVal(b, sort.key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const na = typeof va === "string" ? parseFloat(va.replace(/[^0-9.-]/g, "")) : va;
    const nb = typeof vb === "string" ? parseFloat(vb.replace(/[^0-9.-]/g, "")) : vb;
    if (!isNaN(na) && !isNaN(nb)) {
      return sort.direction === "asc" ? na - nb : nb - na;
    }
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return sort.direction === "asc" ? -1 : 1;
    if (sa > sb) return sort.direction === "asc" ? 1 : -1;
    return 0;
  });
}
