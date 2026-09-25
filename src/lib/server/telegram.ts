/** Sends a message via the Telegram Bot API. TELEGRAM_BOT_TOKEN is a
 * server-only secret (never NEXT_PUBLIC_) - create a bot via @BotFather to
 * get one. Returns false on any failure rather than throwing, since a
 * missed alert shouldn't take down the rest of the price-alert run. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
