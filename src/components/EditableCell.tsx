import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string | number | null | undefined;
  onSave: (next: string) => Promise<void> | void;
  type?: "text" | "number";
  placeholder?: string;
  required?: boolean;
  className?: string;
  display?: (v: string | number | null | undefined) => string;
};

export function EditableCell({ value, onSave, type = "text", placeholder, required, className, display }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (required && !draft.trim()) {
      setStatus("error");
      return;
    }
    if (draft === (value == null ? "" : String(value))) {
      setEditing(false);
      return;
    }
    try {
      setStatus("saving");
      await onSave(draft);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
    } finally {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setEditing(false); }
          }}
          className={cn("h-7 text-sm", status === "error" && "border-destructive", className)}
        />
      </div>
    );
  }

  const shown = display ? display(value) : (value == null || value === "" ? <span className="text-muted-foreground italic">—</span> : String(value));
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "text-left w-full px-1 py-0.5 rounded hover:bg-accent/30 transition-colors text-sm",
        status === "saving" && "opacity-60",
        className
      )}
      title="Click to edit"
    >
      {shown}
      {status === "saved" && <span className="ml-2 text-xs text-green-600">✓</span>}
    </button>
  );
}

export default EditableCell;