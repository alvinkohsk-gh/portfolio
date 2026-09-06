/** A small local directory of major SGX-listed counters, used as a search
 * fallback merged alongside Yahoo Finance's search results in
 * src/app/api/search/route.ts. Yahoo's generic search endpoint sometimes
 * under-indexes SGX names when searched by company name rather than exact
 * ticker, so this fills the gap for well-known Singapore counters.
 *
 * Each entry was individually confirmed against public sources rather than
 * guessed - SGX ticker codes are short, unintuitive, and easy to mix up
 * between similarly-named companies (e.g. HRnetGroup is CHZ, not the "1B1"
 * a plausible-looking guess would land on). This is necessarily a small
 * curated subset of SGX's 700+ listings, not a full directory.
 *
 * Symbols use the ".SI" suffix Yahoo Finance expects, matching the
 * convention already used elsewhere in this app (e.g. "D05.SI" for DBS).
 */
export interface SgxListing {
  symbol: string;
  name: string;
}

export const SGX_DIRECTORY: SgxListing[] = [
  { symbol: "D05.SI", name: "DBS Group Holdings" },
  { symbol: "O39.SI", name: "Oversea-Chinese Banking Corporation (OCBC)" },
  { symbol: "U11.SI", name: "United Overseas Bank (UOB)" },
  { symbol: "Z74.SI", name: "Singapore Telecommunications (Singtel)" },
  { symbol: "S68.SI", name: "Singapore Exchange (SGX)" },
  { symbol: "C6L.SI", name: "Singapore Airlines" },
  { symbol: "S63.SI", name: "ST Engineering" },
  { symbol: "S58.SI", name: "SATS Ltd" },
  { symbol: "C52.SI", name: "ComfortDelGro Corporation" },
  { symbol: "G13.SI", name: "Genting Singapore" },
  { symbol: "F34.SI", name: "Wilmar International" },
  { symbol: "U96.SI", name: "Sembcorp Industries" },
  { symbol: "BN4.SI", name: "Keppel Ltd" },
  { symbol: "C09.SI", name: "City Developments Limited" },
  { symbol: "U14.SI", name: "UOL Group" },
  { symbol: "C07.SI", name: "Jardine Cycle & Carriage" },
  { symbol: "H78.SI", name: "Hongkong Land Holdings" },
  { symbol: "D01.SI", name: "DFI Retail Group Holdings" },
  { symbol: "Y92.SI", name: "Thai Beverage Public Company" },
  { symbol: "V03.SI", name: "Venture Corporation" },
  { symbol: "5E2.SI", name: "Seatrium Limited" },
  { symbol: "BS6.SI", name: "Yangzijiang Shipbuilding (Holdings)" },
  { symbol: "YF8.SI", name: "Yangzijiang Financial Holding" },
  { symbol: "E5H.SI", name: "Golden Agri-Resources" },
  { symbol: "S08.SI", name: "Singapore Post (SingPost)" },
  { symbol: "OV8.SI", name: "Sheng Siong Group" },
  { symbol: "558.SI", name: "UMS Integration" },
  { symbol: "AWX.SI", name: "AEM Holdings" },
  { symbol: "BSL.SI", name: "Raffles Medical Group" },
  { symbol: "P34.SI", name: "Delfi Limited" },
  { symbol: "AP4.SI", name: "Riverstone Holdings" },
  { symbol: "F03.SI", name: "Food Empire Holdings" },
  { symbol: "CHZ.SI", name: "HRnetGroup" },
  { symbol: "1B1.SI", name: "HC Surgical Specialists" },
  { symbol: "9CI.SI", name: "CapitaLand Investment" },
  { symbol: "A17U.SI", name: "CapitaLand Ascendas REIT" },
  { symbol: "C38U.SI", name: "CapitaLand Integrated Commercial Trust" },
  { symbol: "M44U.SI", name: "Mapletree Logistics Trust" },
  { symbol: "ME8U.SI", name: "Mapletree Industrial Trust" },
  { symbol: "N2IU.SI", name: "Mapletree Pan Asia Commercial Trust" },
  { symbol: "AJBU.SI", name: "Keppel DC REIT" },
  { symbol: "J69U.SI", name: "Frasers Centrepoint Trust" },
  { symbol: "BUOU.SI", name: "Frasers Logistics & Commercial Trust" },
  { symbol: "CJLU.SI", name: "NetLink NBN Trust" },
];
