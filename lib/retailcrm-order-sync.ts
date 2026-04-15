import { getSupabaseAdminClient } from "@/lib/supabase";
import type { RetailCrmWebhookPayload } from "@/lib/retailcrm-webhook";

type UpsertableOrder = {
  id: string | number;
  totalSumm: number;
  customerName: string;
};

function splitCustomerName(customerName: string) {
  const parts = customerName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null
  };
}

export async function upsertWebhookOrderToSupabase(
  order: UpsertableOrder,
  payload: RetailCrmWebhookPayload
) {
  const supabase = getSupabaseAdminClient();
  const customer = splitCustomerName(order.customerName);
  const now = new Date().toISOString();
  const row = {
    retailcrm_id: Number(order.id),
    total_summ: order.totalSumm,
    first_name: customer.firstName,
    last_name: customer.lastName,
    created_at: now,
    updated_at: now,
    raw: payload.order ?? payload
  };

  const { error } = await supabase
    .from("retailcrm_orders")
    .upsert(row as never, {
      onConflict: "retailcrm_id"
    });

  if (error) {
    throw new Error(`Supabase webhook upsert failed: ${error.message}`);
  }
}
