import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// Radar mark: concentric rings + center dot on the brand cyan. Flexbox only
// (ImageResponse/Satori does not support grid).
export default function AppleIcon() {
  const dark = "#06121a"
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#22d3ee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 122,
            height: 122,
            borderRadius: 122,
            border: `10px solid ${dark}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 56,
              border: `10px solid ${dark}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 18, background: dark }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
