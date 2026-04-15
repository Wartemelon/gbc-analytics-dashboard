import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getOrdersDashboardData } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const initialData = await getOrdersDashboardData();

  return (
    <main className="min-h-screen overflow-hidden bg-mist">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(255,132,95,0.20),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(143,211,199,0.32),_transparent_38%),linear-gradient(180deg,_#fff8ef_0%,_#f6f8fb_72%)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="rounded-[36px] border border-white/60 bg-white/75 p-8 shadow-panel backdrop-blur md:p-12">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-coral">
              Supabase + RetailCRM
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-ink sm:text-5xl lg:text-6xl">
              Orders pulse, revenue rhythm, and sharper daily signals.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate sm:text-lg">
              The dashboard now aggregates RetailCRM orders by day, highlights
              revenue movement, and turns raw synced rows into a compact operating
              view your team can actually read.
            </p>
          </div>
        </section>

        <DashboardClient initialData={initialData} />
      </div>
    </main>
  );
}
