import { ImageResponse } from "next/og";

export const alt = "SiAPI – Pemantauan & Prediksi Karhutla Riau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const RISK = ["#F3D27A", "#E98A3D", "#9E2F1C"];

export default function OpenGraphImage() {
  // A stylised risk grid next to the title.
  const cells = Array.from({ length: 48 }, (_, i) => {
    const v = (Math.sin(i * 1.7) + Math.cos(i * 0.9) + 2) / 4;
    return v < 0.35 ? null : RISK[Math.min(2, Math.floor((v - 0.35) * 5))];
  });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#F3F4F0",
          color: "#1C2321",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "#1F3B36",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 28, height: 36, borderRadius: "50% 50% 45% 45%", background: "#C2521F" }} />
            </div>
            <div style={{ fontSize: 64, fontWeight: 700 }}>SiAPI</div>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, marginTop: 32, lineHeight: 1.2 }}>
            Pemantauan &amp; Prediksi Karhutla Riau
          </div>
          <div style={{ fontSize: 26, color: "#4F5752", marginTop: 20, lineHeight: 1.4 }}>
            Hotspot satelit, zona kebakaran, dan prediksi risiko 7 hari per kotak grid 5 km.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 336, gap: 6 }}>
          {cells.map((color, i) => (
            <div
              key={i}
              style={{
                width: 50,
                height: 50,
                borderRadius: 6,
                background: color ?? "#FFFFFF",
                border: "1px solid #DCDFD8",
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
