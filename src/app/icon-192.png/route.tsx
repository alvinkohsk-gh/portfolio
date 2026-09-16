import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#34d399",
          fontSize: 120,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        P
      </div>
    ),
    { width: 192, height: 192 }
  );
}
