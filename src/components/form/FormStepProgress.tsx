import { cn } from "@/lib/utils";

export type FormStepMeta = { title: string; desc: string };

type FormStepProgressProps = {
  step: number;
  steps: readonly FormStepMeta[];
  className?: string;
};

/** Compact step indicator: thin segment bar + current step title + short description (replaces chunky pill steppers). */
export function FormStepProgress({ step, steps, className }: FormStepProgressProps) {
  const total = steps.length;
  const safeStep = Math.min(Math.max(0, step), total - 1);
  const current = steps[safeStep];

  return (
    <div className={cn("shrink-0 space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium tabular-nums tracking-wide text-muted-foreground">
          {safeStep + 1} / {total}
        </span>
        <span className="min-w-0 truncate text-right text-xs font-medium text-foreground">{current.title}</span>
      </div>
      <div
        className="flex gap-0.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={safeStep + 1}
        aria-label={`Step ${safeStep + 1} of ${total}: ${current.title}`}
      >
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn("h-0.5 min-w-[2rem] flex-1 rounded-full transition-colors duration-200", i <= safeStep ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{current.desc}</p>
    </div>
  );
}
