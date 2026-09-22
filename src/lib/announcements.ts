import type { Announcement, AnnouncementsDebug, SourceDebug } from "@/lib/server/newsSources";

export type { Announcement, SourceDebug };

export interface AnnouncementsResponse {
  announcements: Record<string, Announcement[]>;
  errors: string[];
  debug: AnnouncementsDebug;
}

export async function fetchAnnouncements(
  items: { symbol: string; name?: string }[]
): Promise<AnnouncementsResponse> {
  if (items.length === 0) return { announcements: {}, errors: [], debug: {} };
  const symbols = items.map((i) => i.symbol).join(",");
  const names = items.map((i) => encodeURIComponent(i.name ?? "")).join(",");
  const res = await fetch(
    `/api/announcements?symbols=${encodeURIComponent(symbols)}&names=${names}`
  );
  if (!res.ok) {
    return { announcements: {}, errors: items.map((i) => i.symbol), debug: {} };
  }
  return res.json();
}
