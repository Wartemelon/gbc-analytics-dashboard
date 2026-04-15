import { NextResponse } from "next/server";

import { getOrdersDashboardData } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getOrdersDashboardData();

    return NextResponse.json(data, {
      status: 200
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json(
      { error: message },
      {
        status: 500
      }
    );
  }
}
