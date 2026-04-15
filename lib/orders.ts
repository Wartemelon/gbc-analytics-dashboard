import { getSupabaseClient } from "@/lib/supabase";

const CHART_WINDOW_DAYS = 14;
const DEMO_DISTRIBUTION_DAYS = 7;

export type RetailCrmOrderRow = {
  retailcrm_id: number;
  total_summ: number | null;
  created_at: string | null;
};

export type DailyAggregate = {
  date: string;
  orders_count: number;
  revenue_sum: number;
};

export type OrdersApiResponse = {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersToday: number;
  };
  charts: {
    daily: DailyAggregate[];
  };
  meta: {
    dateRangeDays: number;
    usedDemoDistribution: boolean;
  };
};

function toNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function shiftDays(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function buildChartWindow(days: number) {
  const today = startOfDay(new Date());
  const window: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    window.push(formatDateKey(shiftDays(today, -offset)));
  }

  return window;
}

function hasSingleKnownDate(rows: RetailCrmOrderRow[]) {
  const uniqueDates = new Set(
    rows
      .map((row) => parseDate(row.created_at))
      .filter((value): value is Date => value !== null)
      .map((value) => formatDateKey(startOfDay(value)))
  );

  return uniqueDates.size <= 1;
}

function distributeRowsForDemo(rows: RetailCrmOrderRow[]) {
  const anchor = startOfDay(new Date());

  return rows.map((row, index) => {
    const dayOffset = (DEMO_DISTRIBUTION_DAYS - 1) - (index % DEMO_DISTRIBUTION_DAYS);
    const simulatedDate = shiftDays(anchor, -dayOffset);

    return {
      ...row,
      created_at: simulatedDate.toISOString()
    };
  });
}

function aggregateRowsByDay(rows: RetailCrmOrderRow[]) {
  const buckets = new Map<string, DailyAggregate>();

  for (const row of rows) {
    const parsedDate = parseDate(row.created_at);
    if (!parsedDate) {
      continue;
    }

    const dateKey = formatDateKey(startOfDay(parsedDate));
    const current = buckets.get(dateKey) ?? {
      date: dateKey,
      orders_count: 0,
      revenue_sum: 0
    };

    current.orders_count += 1;
    current.revenue_sum += toNumber(row.total_summ);
    buckets.set(dateKey, current);
  }

  return buckets;
}

function buildDailySeries(rows: RetailCrmOrderRow[]) {
  const chartWindow = buildChartWindow(CHART_WINDOW_DAYS);
  const dailyBuckets = aggregateRowsByDay(rows);

  return chartWindow.map((date) => {
    const bucket = dailyBuckets.get(date);

    return {
      date,
      orders_count: bucket?.orders_count ?? 0,
      revenue_sum: Number((bucket?.revenue_sum ?? 0).toFixed(2))
    };
  });
}

export async function getOrdersDashboardData(): Promise<OrdersApiResponse> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("retailcrm_orders")
    .select("retailcrm_id,total_summ,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const rows = (data ?? []) as RetailCrmOrderRow[];
  const shouldDistributeForDemo = rows.length > 0 && hasSingleKnownDate(rows);
  const normalizedRows = shouldDistributeForDemo ? distributeRowsForDemo(rows) : rows;
  const daily = buildDailySeries(normalizedRows);
  const todayKey = formatDateKey(startOfDay(new Date()));

  const totalRevenue = Number(
    normalizedRows.reduce((sum, row) => sum + toNumber(row.total_summ), 0).toFixed(2)
  );

  return {
    summary: {
      totalOrders: normalizedRows.length,
      totalRevenue,
      averageOrderValue:
        normalizedRows.length > 0
          ? Number((totalRevenue / normalizedRows.length).toFixed(2))
          : 0,
      ordersToday:
        daily.find((day) => day.date === todayKey)?.orders_count ?? 0
    },
    charts: {
      daily
    },
    meta: {
      dateRangeDays: CHART_WINDOW_DAYS,
      usedDemoDistribution: shouldDistributeForDemo
    }
  };
}
