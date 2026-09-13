import type { Announcement, SourceDebug } from "@/app/api/announcements/route";

export type { Announcement, SourceDebug };

export interface AnnouncementsResponse {
  announcements: Record<string, Announcement[]>;
  errors: string[];
  debug: Record<
    string,
    {
      nasdaq?: SourceDebug;
      secEdgar?: SourceDebug;
      splits?: SourceDebug;
      yahooNews?: SourceDebug;
      sgxApi?: SourceDebug;
      googleNews?: SourceDebug;
    }
  > & { sgx?: SourceDebug };
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
