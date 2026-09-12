import type { Announcement } from "@/app/api/announcements/route";

export type { Announcement };

export async function fetchAnnouncements(
  items: { symbol: string; name?: string }[]
): Promise<{ announcements: Record<string, Announcement[]>; errors: string[] }> {
  if (items.length === 0) return { announcements: {}, errors: [] };
  const symbols = items.map((i) => i.symbol).join(",");
  const names = items.map((i) => encodeURIComponent(i.name ?? "")).join(",");
  const res = await fetch(
    `/api/announcements?symbols=${encodeURIComponent(symbols)}&names=${names}`
  );
  if (!res.ok) {
    return { announcements: {}, errors: items.map((i) => i.symbol) };
  }
  return res.json();
}
