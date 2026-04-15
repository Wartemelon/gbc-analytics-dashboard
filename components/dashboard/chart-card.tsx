"use client";

import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-panel backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate">
            {description}
          </p>
        </div>
      </div>
      <div className="h-[320px] w-full sm:h-[360px]">{children}</div>
    </section>
  );
}
