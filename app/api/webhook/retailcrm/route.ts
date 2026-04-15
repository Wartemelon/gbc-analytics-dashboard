import { NextResponse } from "next/server";

import {
  extractWebhookOrder,
  HIGH_VALUE_ORDER_THRESHOLD,
  isHighValueOrder,
  parseRetailCrmWebhookRequest
} from "@/lib/retailcrm-webhook";
import {
  formatHighValueOrderMessage,
  sendTelegramMessage
} from "@/lib/telegram";
import { upsertWebhookOrderToSupabase } from "@/lib/retailcrm-order-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const payload = await parseRetailCrmWebhookRequest(request);
    const order = extractWebhookOrder(payload);

    console.log("RetailCRM webhook received:", {
      event: payload.event ?? null,
      hasOrder: Boolean(payload.order),
      parsedOrderId: order?.id ?? null,
      parsedTotalSumm: order?.totalSumm ?? null
    });

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid webhook payload: order.id is required."
        },
        { status: 400 }
      );
    }

    if (!isHighValueOrder(order.totalSumm)) {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await upsertWebhookOrderToSupabase(order, payload);
      }

      return NextResponse.json({
        ok: true,
        notified: false,
        reason: `Order total is below threshold ${HIGH_VALUE_ORDER_THRESHOLD}.`,
        orderId: order.id,
        syncedToSupabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      });
    }

    const message = formatHighValueOrderMessage({
      id: order.id,
      totalSumm: order.totalSumm,
      customerName: order.customerName
    });

    await sendTelegramMessage(message);

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await upsertWebhookOrderToSupabase(order, payload);
    }

    return NextResponse.json({
      ok: true,
      notified: true,
      orderId: order.id,
      totalSumm: order.totalSumm,
      syncedToSupabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    });
  } catch (error) {
    console.error("RetailCRM webhook handling failed:", error);

    const message =
      error instanceof Error ? error.message : "Unexpected webhook error";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "RetailCRM webhook endpoint is ready. Use POST requests.",
    env: {
      hasTelegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hasTelegramChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    }
  });
}
