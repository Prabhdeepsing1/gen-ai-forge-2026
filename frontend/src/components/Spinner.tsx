import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-5 h-5 border-2 border-border rounded-full border-t-primary animate-spin",
        className
      )}
    />
  );
}

export default Spinner;
