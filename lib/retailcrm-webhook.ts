export const HIGH_VALUE_ORDER_THRESHOLD = 50000;

type RetailCrmCustomer = {
  firstName?: string | null;
  lastName?: string | null;
};

export type RetailCrmWebhookOrder = {
  id?: number | string;
  totalSumm?: number | string | null;
  firstName?: string | null;
  lastName?: string | null;
  customer?: RetailCrmCustomer | null;
};

export type RetailCrmWebhookPayload = {
  event?: string;
  order?: RetailCrmWebhookOrder | null;
};

type LooseWebhookRecord = Record<string, FormDataEntryValue | unknown>;

function parseNumericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function parseJsonIfString<T>(value: unknown): T | null {
  if (typeof value !== "string") {
    return (value as T) ?? null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function buildOrderFromFlatPayload(payload: LooseWebhookRecord): RetailCrmWebhookOrder | null {
  const id =
    payload["order[id]"] ??
    payload.orderId ??
    payload.id;
  const totalSumm =
    payload["order[totalSumm]"] ??
    payload.totalSumm ??
    payload.total_sum;
  const firstName =
    payload["order[firstName]"] ??
    payload.firstName;
  const lastName =
    payload["order[lastName]"] ??
    payload.lastName;
  const customerFirstName =
    payload["order[customer][firstName]"] ??
    payload["customer[firstName]"];
  const customerLastName =
    payload["order[customer][lastName]"] ??
    payload["customer[lastName]"];

  if (id === undefined || id === null) {
    return null;
  }

  return {
    id: parseString(id) ?? (typeof id === "number" ? id : String(id)),
    totalSumm:
      parseString(totalSumm) ??
      (typeof totalSumm === "number" ? totalSumm : null),
    firstName: parseString(firstName),
    lastName: parseString(lastName),
    customer:
      customerFirstName || customerLastName
        ? {
            firstName: parseString(customerFirstName),
            lastName: parseString(customerLastName)
          }
        : null
  };
}

function getCustomerName(order: RetailCrmWebhookOrder) {
  const customerFirstName = order.customer?.firstName ?? "";
  const customerLastName = order.customer?.lastName ?? "";
  const orderFirstName = order.firstName ?? "";
  const orderLastName = order.lastName ?? "";

  const fullName = [
    customerFirstName || orderFirstName,
    customerLastName || orderLastName
  ]
    .join(" ")
    .trim();

  return fullName || "Unknown customer";
}

export function extractWebhookOrder(payload: RetailCrmWebhookPayload) {
  if (!payload.order || payload.order.id === undefined || payload.order.id === null) {
    return null;
  }

  const totalSumm = parseNumericValue(payload.order.totalSumm);

  return {
    event: payload.event ?? "unknown",
    id: payload.order.id,
    totalSumm,
    customerName: getCustomerName(payload.order)
  };
}

export function isHighValueOrder(totalSumm: number) {
  return totalSumm > HIGH_VALUE_ORDER_THRESHOLD;
}

export async function parseRetailCrmWebhookRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as RetailCrmWebhookPayload;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData.entries());

    return {
      event:
        typeof payload.event === "string"
          ? payload.event
          : typeof payload.action === "string"
            ? payload.action
            : undefined,
      order:
        parseJsonIfString<RetailCrmWebhookOrder>(payload.order) ??
        parseJsonIfString<RetailCrmWebhookOrder>(payload.data) ??
        buildOrderFromFlatPayload(payload)
    };
  }

  const rawText = await request.text();
  const parsedPayload = parseJsonIfString<RetailCrmWebhookPayload>(rawText);

  if (parsedPayload) {
    return parsedPayload;
  }

  const flatPayload = parseJsonIfString<LooseWebhookRecord>(rawText);
  if (flatPayload) {
    return {
      event:
        parseString(flatPayload.event) ??
        parseString(flatPayload.action) ??
        undefined,
      order: buildOrderFromFlatPayload(flatPayload)
    };
  }

  throw new Error("Unsupported webhook payload format.");
}
