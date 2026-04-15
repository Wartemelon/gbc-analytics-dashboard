type StatCardProps = {
  eyebrow: string;
  value: string;
  helper: string;
  accent?: string;
};

export function StatCard({
  eyebrow,
  value,
  helper,
  accent = "text-coral"
}: StatCardProps) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-panel backdrop-blur transition hover:-translate-y-0.5">
      <p className={`text-xs font-medium uppercase tracking-[0.24em] ${accent}`}>
        {eyebrow}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate">
        {helper}
      </p>
    </div>
  );
}
