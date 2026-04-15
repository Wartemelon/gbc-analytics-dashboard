"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ChartCard } from "@/components/dashboard/chart-card";
import { StatCard } from "@/components/ui/stat-card";
import type { DailyAggregate, OrdersApiResponse } from "@/lib/orders";

type DashboardClientProps = {
  initialData: OrdersApiResponse;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function formatRevenueAxis(value: number) {
  if (value === 0) {
    return "0";
  }

  return `${Math.round(value / 1000)}k`;
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-[28px] bg-white/70 shadow-panel"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-[370px] animate-pulse rounded-[32px] bg-white/70 shadow-panel"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[32px] border border-coral/20 bg-white/90 p-8 shadow-panel">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-coral">
        Data issue
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-ink">
        Не удалось обновить аналитику
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate">
        {message}
      </p>
      <button
        className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate"
        onClick={onRetry}
        type="button"
      >
        Попробовать снова
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[32px] border border-dashed border-slate/20 bg-white/85 p-10 text-center shadow-panel">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate">
        No data yet
      </p>
      <h2 className="mt-4 text-3xl font-semibold text-ink">
        Заказы пока не появились в витрине
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate">
        Как только синк из RetailCRM положит строки в таблицу `retailcrm_orders`,
        здесь автоматически появятся KPI и динамика по дням.
      </p>
    </div>
  );
}

function InsightPill({
  title,
  value
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-panel">
      <span className="text-slate">{title}: </span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function getPeakDay(days: DailyAggregate[]) {
  return [...days].sort((left, right) => right.orders_count - left.orders_count)[0] ?? null;
}

function getBestRevenueDay(days: DailyAggregate[]) {
  return [...days].sort((left, right) => right.revenue_sum - left.revenue_sum)[0] ?? null;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<OrdersApiResponse>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as OrdersApiResponse;
      setData(payload);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unknown error";
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  if (isRefreshing && !data.summary.totalOrders) {
    return <LoadingState />;
  }

  if (error && !data.summary.totalOrders) {
    return <ErrorState message={error} onRetry={() => void loadOrders()} />;
  }

  if (data.summary.totalOrders === 0) {
    return <EmptyState />;
  }

  const peakDay = getPeakDay(data.charts.daily);
  const bestRevenueDay = getBestRevenueDay(data.charts.daily);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[32px] border border-white/60 bg-white/65 p-5 shadow-panel backdrop-blur sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-coral">
              Analytics snapshot
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">
              Daily order flow with revenue context
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate">
              Metrics are aggregated by day from `created_at`. For demo-heavy data,
              the chart redistributes single-day imports across the last 7 days so
              the visual stays informative.
            </p>
          </div>
          <button
            className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/20 hover:bg-sand"
            onClick={() => void loadOrders()}
            type="button"
          >
            {isRefreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <InsightPill
            title="Peak orders day"
            value={
              peakDay
                ? `${formatChartDate(peakDay.date)} • ${formatCompactNumber(peakDay.orders_count)}`
                : "N/A"
            }
          />
          <InsightPill
            title="Best revenue day"
            value={
              bestRevenueDay
                ? `${formatChartDate(bestRevenueDay.date)} • ${formatCurrency(bestRevenueDay.revenue_sum)}`
                : "N/A"
            }
          />
          <InsightPill
            title="Chart window"
            value={`${data.meta.dateRangeDays} days`}
          />
          {data.meta.usedDemoDistribution ? (
            <InsightPill
              title="Visualization mode"
              value="Demo distribution enabled"
            />
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-coral/20 bg-white/85 px-5 py-4 text-sm text-slate shadow-panel">
          Showing last successful data. Latest refresh failed: {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          eyebrow="Total orders"
          value={formatCompactNumber(data.summary.totalOrders)}
          helper="All synced orders included in the current analytics view."
          accent="text-coral"
        />
        <StatCard
          eyebrow="Total revenue"
          value={formatCurrency(data.summary.totalRevenue)}
          helper="Total `total_summ` across all fetched orders."
          accent="text-ink"
        />
        <StatCard
          eyebrow="Average order value"
          value={formatCurrency(data.summary.averageOrderValue)}
          helper="Average revenue per order based on synced data."
          accent="text-mint"
        />
        <StatCard
          eyebrow="Orders today"
          value={formatCompactNumber(data.summary.ordersToday)}
          helper="Orders grouped into today's bucket."
          accent="text-slate"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Orders Over Time"
          description="Daily order count for the most recent analytics window."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.daily}>
              <CartesianGrid stroke="#E6ECF3" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                stroke="#486581"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                stroke="#486581"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCompactNumber(value), "Orders"]}
                labelFormatter={(value) => formatChartDate(String(value))}
                contentStyle={{
                  borderRadius: 18,
                  border: "1px solid #E6ECF3",
                  boxShadow: "0 18px 50px rgba(16, 42, 67, 0.08)"
                }}
              />
              <Line
                type="monotone"
                dataKey="orders_count"
                stroke="#102A43"
                strokeWidth={3}
                dot={{ r: 4, fill: "#FF845F" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Revenue Per Day"
          description="Daily revenue totals grouped from order creation date."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.daily}>
              <CartesianGrid stroke="#E6ECF3" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                stroke="#486581"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                stroke="#486581"
                tickFormatter={formatRevenueAxis}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                labelFormatter={(value) => formatChartDate(String(value))}
                contentStyle={{
                  borderRadius: 18,
                  border: "1px solid #E6ECF3",
                  boxShadow: "0 18px 50px rgba(16, 42, 67, 0.08)"
                }}
              />
              <Bar
                dataKey="revenue_sum"
                radius={[12, 12, 4, 4]}
                fill="#8FD3C7"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}
