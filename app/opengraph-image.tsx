import { ImageResponse } from "next/og"
import { SITE_NAME } from "@/lib/site"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "LaggardScan — lead intelligence for agencies"

const dark = "#06121a"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #080b10 0%, #0d1117 60%, #0a1620 100%)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#22d3ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 46,
                border: `6px solid ${dark}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 10, background: dark }} />
            </div>
          </div>
          <span style={{ marginLeft: 22, fontSize: 40, fontWeight: 800, color: "white" }}>
            {SITE_NAME}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 22,
              color: "#67e8f9",
              border: "1px solid rgba(103,232,249,0.35)",
              borderRadius: 8,
              padding: "8px 16px",
            }}
          >
            Lead intelligence for agencies
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: "white", lineHeight: 1.05, maxWidth: 960 }}>
            Find businesses your agency can actually help.
          </span>
          <span style={{ marginTop: 26, fontSize: 30, color: "rgba(255,255,255,0.62)", maxWidth: 900 }}>
            Scan a city, audit weak websites, and turn each finding into a sharper outreach angle.
          </span>
        </div>

        {/* Signal pills */}
        <div style={{ display: "flex", gap: 14 }}>
          {["No website", "Old website", "No booking", "Weak SEO", "No chat capture"].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 22,
                color: "rgba(255,255,255,0.7)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "10px 18px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
