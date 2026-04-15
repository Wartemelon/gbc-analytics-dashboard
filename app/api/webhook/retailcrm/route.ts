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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const payload = await parseRetailCrmWebhookRequest(request);
    const order = extractWebhookOrder(payload);

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
      return NextResponse.json({
        ok: true,
        notified: false,
        reason: `Order total is below threshold ${HIGH_VALUE_ORDER_THRESHOLD}.`,
        orderId: order.id
      });
    }

    const message = formatHighValueOrderMessage({
      id: order.id,
      totalSumm: order.totalSumm,
      customerName: order.customerName
    });

    await sendTelegramMessage(message);

    return NextResponse.json({
      ok: true,
      notified: true,
      orderId: order.id,
      totalSumm: order.totalSumm
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
    message: "RetailCRM webhook endpoint is ready. Use POST requests."
  });
}
