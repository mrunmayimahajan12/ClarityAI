import { cn } from "@/lib/utils";

type Risk = "high" | "medium" | "low";

interface RiskBadgeProps {
  risk: Risk;
  size?: "sm" | "md";
  className?: string;
}

const riskConfig: Record<Risk, { label: string; classes: string }> = {
  high: {
    label: "High",
    classes: "bg-[var(--risk-high-bg)] text-[var(--risk-high)] border-[var(--risk-high)]/20",
  },
  medium: {
    label: "Medium",
    classes: "bg-[var(--risk-medium-bg)] text-[var(--risk-medium)] border-[var(--risk-medium)]/20",
  },
  low: {
    label: "Low",
    classes: "bg-[var(--risk-low-bg)] text-[var(--risk-low)] border-[var(--risk-low)]/20",
  },
};

export function RiskBadge({ risk, size = "md", className }: RiskBadgeProps) {
  const config = riskConfig[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function RiskDot({ risk, className }: { risk: Risk; className?: string }) {
  const dotColors: Record<Risk, string> = {
    high: "bg-[var(--risk-high)]",
    medium: "bg-[var(--risk-medium)]",
    low: "bg-[var(--risk-low)]",
  };
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", dotColors[risk], className)}
    />
  );
}
