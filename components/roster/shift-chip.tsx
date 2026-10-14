import { displayValue, SHIFT_STYLE, shiftKind, type ShiftValue } from "@/lib/roster";
import { cn } from "@/lib/utils";

export function ShiftChip({ value, muted }: { value: ShiftValue; muted?: boolean }) {
  const style = SHIFT_STYLE[shiftKind(value)];
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-lg px-2 font-mono text-[12.5px] tabular-nums",
        muted && "line-through opacity-60",
      )}
      style={{ color: style.color, background: style.bg }}
    >
      {displayValue(value)}
    </span>
  );
}
