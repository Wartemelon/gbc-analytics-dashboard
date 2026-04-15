const TELEGRAM_API_BASE = "https://api.telegram.org";

function requireEnv(name: "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatHighValueOrderMessage(input: {
  id: string | number;
  totalSumm: number;
  customerName: string;
}) {
  const formattedSum = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(input.totalSumm);

  return [
    "🛒 <b>New high-value order!</b>",
    `ID: <code>${escapeHtml(String(input.id))}</code>`,
    `Sum: <b>${escapeHtml(formattedSum)} KZT</b>`,
    `Customer: ${escapeHtml(input.customerName)}`
  ].join("\n");
}

export async function sendTelegramMessage(text: string) {
  const botToken = requireEnv("TELEGRAM_BOT_TOKEN");
  const chatId = requireEnv("TELEGRAM_CHAT_ID");

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Telegram API request failed with status ${response.status}: ${errorText}`
    );
  }

  return response.json();
}
