import { ExternalLink } from "lucide-react";
import { SOURCES, type SourceKey } from "@/lib/sources";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  source: SourceKey;
  className?: string;
  /** Show the label text alongside the icon */
  withLabel?: boolean;
};

/**
 * Tiny "↗ source" link to indicate where a piece of data comes from.
 * Drop next to a section header or table title.
 */
export default function SourceLink({ source, className, withLabel }: Props) {
  const meta = SOURCES[source];
  if (!meta) return null;
  const inner = (
    <a
      href={meta.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <ExternalLink className="h-3 w-3" />
      {withLabel && <span>source</span>}
    </a>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Source: {meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}