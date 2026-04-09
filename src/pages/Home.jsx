// src/pages/Home.jsx
import { useRef, useMemo } from "react";

const INDEX_META = {
  "000001.SH": { name: "上证指数", short: "沪指"  },
  "399001.SZ": { name: "深证成指", short: "深指"  },
  "399006.SZ": { name: "创业板指", short: "创业板" },
  "688000.SH": { name: "科创50",  short: "科创板" },
  "899050.BJ": { name: "北证50",  short: "北交所" },
};

const WEIGHT_SECTORS = ["券商","银行","白酒","煤炭","钢铁","地产"];

function fmt(n, d = 2) { return Number(n).toFixed(d); }
function pct(v, d = 2) { return (v >= 0 ? "+" : "") + fmt(v, d) + "%"; }
function round2(v) { return Math.round(v * 100) / 100; }

// ─── 指数卡片 ─────────────────────────────────────────────────────
function IndexCard({ data }) {
  const meta = INDEX_META[data.code] || { name: data.code, short: data.code };
  const up   = data.change >= 0;
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      padding: "18px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
      borderBottom: `3px solid ${up ? "#2563eb" : "#ef4444"}`,
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.10)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>
        {meta.short}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: "#0f172a", letterSpacing: -1 }}>
        {fmt(data.price)}
      </div>
      <div style={{
        fontSize: 13, fontFamily: "monospace", fontWeight: 700,
        marginTop: 8, color: up ? "#2563eb" : "#ef4444",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: 4,
          background: up ? "#dbeafe" : "#fee2e2",
          fontSize: 10,
        }}>{up ? "▲" : "▼"}</span>
        {Math.abs(data.change).toFixed(2)}%
      </div>
    </div>
  );
}

// ─── 仪表盘 ───────────────────────────────────────────────────────
function Gauge({ label, value, sub }) {
  const c     = Math.max(0, Math.min(100, value));
  const color = c > 60 ? "#16a34a" : c < 40 ? "#dc2626" : "#d97706";
  const r = 38, cx = 50, cy = 50;
  const circ = Math.PI * r;
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={100} height={60} viewBox="0 0 100 60">
        <path d={`M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke="#f1f5f9" strokeWidth="8" strokeLinecap="round" />
        <path d={`M${cx - r},${cy} A${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(c / 100) * circ} ${circ}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={cx} y={cy + 2} textAnchor="middle" fill={color}
          fontSize="14" fontFamily="monospace" fontWeight="800">{Math.round(c)}</text>
      </svg>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

// ─── 黄白线 ───────────────────────────────────────────────────────
function YWPanel({ shanghaiChange, sectors }) {
  const equalWeight = useMemo(() => {
    if (sectors.length === 0) return round2(shanghaiChange - 0.35);
    return round2(sectors.reduce((s, x) => s + x.change, 0) / sectors.length);
  }, [sectors, shanghaiChange]);

  const diff    = round2(shanghaiChange - equalWeight);
  const absDiff = Math.abs(diff);

  const { signal, sigColor, sigDesc } = useMemo(() => {
    if (diff > 0.8)  return { signal: "权重护盘", sigColor: "#d97706", sigDesc: "大市值拉指数，个股普跌" };
    if (diff < -0.8) return { signal: "小票行情", sigColor: "#16a34a", sigDesc: "个股普涨，指数被权重拖累" };
    if (shanghaiChange > 0 && equalWeight > 0) return { signal: "普涨格局", sigColor: "#16a34a", sigDesc: "指数与个股同步上涨" };
    if (shanghaiChange < 0 && equalWeight < 0) return { signal: "普跌格局", sigColor: "#dc2626", sigDesc: "指数与个股同步下跌" };
    return { signal: "分化震荡", sigColor: "#94a3b8", sigDesc: "指数与个股方向分歧" };
  }, [diff, shanghaiChange, equalWeight]);

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, fontWeight: 600 }}>黄白线背离</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { label: "白线（沪指·加权）", val: shanghaiChange, dash: false, color: "#1e293b" },
          { label: "黄线（全市·等权）", val: equalWeight,    dash: true,  color: "#d97706" },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width={28} height={12} style={{ flexShrink: 0 }}>
              <line x1="0" y1="6" x2="28" y2="6" stroke={row.color}
                strokeWidth="2.5" strokeDasharray={row.dash ? "5,3" : "none"} />
            </svg>
            <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>{row.label}</span>
            <span style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 700,
              color: row.val >= 0 ? "#2563eb" : "#ef4444" }}>{pct(row.val)}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>黄白线背离值</span>
          <span style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 700,
            color: absDiff > 0.8 ? "#d97706" : "#94a3b8" }}>
            {diff >= 0 ? "+" : ""}{fmt(diff)}%
          </span>
        </div>
      </div>

      <div style={{
        background: sigColor + "12", borderRadius: 10, padding: "12px 16px",
        borderLeft: `4px solid ${sigColor}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: sigColor, whiteSpace: "nowrap" }}>{signal}</span>
        <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{sigDesc}</span>
      </div>
    </div>
  );
}

// ─── 板块徽章 ─────────────────────────────────────────────────────
function SectorBadge({ sector, shanghaiChange }) {
  const up      = sector.change >= 0;
  const sameDir = sector.change * shanghaiChange >= 0;
  return (
    <div style={{
      background: up ? "#eff6ff" : "#fef2f2",
      border: `1px solid ${up ? "#bfdbfe" : "#fecaca"}`,
      borderRadius: 10, padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 10,
      transition: "transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{sector.name}</span>
      <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 800,
        color: up ? "#2563eb" : "#ef4444" }}>{pct(sector.change)}</span>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
        color: sameDir ? "#d97706" : "#94a3b8",
        background: sameDir ? "#fef9c3" : "#f8fafc",
        padding: "2px 6px", borderRadius: 4,
      }}>
        {sameDir ? "联动" : "背离"}
      </span>
    </div>
  );
}

// ─── 板块排行 ─────────────────────────────────────────────────────
function SectorRank({ sectors }) {
  const sorted = [...sectors].sort((a, b) => b.change - a.change);
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.change)), 1);
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "24px 28px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, marginBottom: 20, fontWeight: 600 }}>
        板块 ETF 涨跌排行
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((s, i) => {
          const up   = s.change >= 0;
          const barW = Math.abs(s.change) / maxAbs * 100;
          return (
            <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{
                fontSize: 11, color: i < 3 ? (up ? "#2563eb" : "#ef4444") : "#94a3b8",
                width: 20, textAlign: "right", fontFamily: "monospace", fontWeight: 700,
              }}>{i + 1}</span>
              <span style={{ fontSize: 13, width: 44, color: "#334155", fontWeight: 600 }}>{s.name}</span>
              <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${barW}%`, height: "100%", borderRadius: 3,
                  background: up
                    ? `linear-gradient(90deg, #3b82f6, #2563eb)`
                    : `linear-gradient(90deg, #f87171, #ef4444)`,
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span style={{
                fontSize: 14, fontFamily: "monospace", fontWeight: 700,
                color: up ? "#2563eb" : "#ef4444", width: 64, textAlign: "right",
              }}>{pct(s.change)}</span>
              <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", width: 52 }}>
                {fmt(s.price, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 主页 ─────────────────────────────────────────────────────────
export default function HomePage({ indices, sectors }) {
  const sectorRankRef  = useRef(null);
  const shanghaiChange = indices.find(i => i.code === "000001.SH")?.change ?? 0;
  const upCount        = sectors.filter(s => s.change > 0).length;
  const downCount      = sectors.length - upCount;
  const sentimentScore = sectors.length > 0 ? (upCount / sectors.length) * 100 : 50;
  const weightSectors  = sectors.filter(s => WEIGHT_SECTORS.includes(s.name));

  return (
    <div style={{
      fontFamily: "'IBM Plex Mono','Courier New',monospace",
      background: "#f8fafc", minHeight: "100vh",
    }}>

      {/* ══ 首屏 ══ */}
      <div style={{
        minHeight: "calc(100vh - 52px)",
        padding: "28px 36px 36px",
        display: "flex", flexDirection: "column", gap: 24,
      }}>

        {/* 五大指数 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
          {indices.length === 0
            ? Array(5).fill(0).map((_, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 14, padding: "18px 20px", height: 110,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>连接中...</span>
              </div>
            ))
            : indices.map(idx => <IndexCard key={idx.code} data={idx} />)
          }
        </div>

        {/* 情绪 + 黄白线 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* 市场情绪 */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: "20px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, marginBottom: 20, fontWeight: 600 }}>
              市场情绪
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20 }}>
              <Gauge label="赚钱效应" value={sentimentScore}
                sub={`${upCount}涨 / ${downCount}跌`} />
              <Gauge label="涨跌比"   value={sentimentScore} />
              <Gauge label="量比"     value={60} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "上涨", val: upCount * 10,   color: "#2563eb", bg: "#eff6ff" },
                { label: "下跌", val: downCount * 10, color: "#ef4444", bg: "#fef2f2" },
                { label: "涨停", val: Math.max(0, Math.floor(sentimentScore / 5 + 2)), color: "#2563eb", bg: "#eff6ff" },
                { label: "跌停", val: Math.max(0, Math.floor((100 - sentimentScore) / 14 + 1)), color: "#ef4444", bg: "#fef2f2" },
              ].map(item => (
                <div key={item.label} style={{
                  background: item.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: "monospace" }}>
                    {item.val}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <YWPanel shanghaiChange={shanghaiChange} sectors={sectors} />
        </div>

        {/* 权重板块 */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 3, marginBottom: 16, fontWeight: 600 }}>
            指数权重板块
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {weightSectors.length > 0
              ? weightSectors.map(s => (
                <SectorBadge key={s.code} sector={s} shanghaiChange={shanghaiChange} />
              ))
              : <span style={{ color: "#94a3b8", fontSize: 13 }}>连接中...</span>
            }
          </div>
        </div>

        {/* 滚动提示 */}
        <div style={{ textAlign: "center" }}>
          <button onClick={() => sectorRankRef.current?.scrollIntoView({ behavior: "smooth" })} style={{
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 24, padding: "10px 28px", cursor: "pointer",
            color: "#64748b", fontSize: 12, fontFamily: "monospace",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
          >
            查看板块排行 ↓
          </button>
        </div>
      </div>

      {/* ══ 板块排行（滚动后显示）══ */}
      <div ref={sectorRankRef} style={{ padding: "36px 36px 48px", borderTop: "1px solid #e2e8f0" }}>
        {sectors.length > 0
          ? <SectorRank sectors={sectors} />
          : <div style={{ textAlign: "center", color: "#94a3b8", padding: 60, fontSize: 14 }}>
              板块数据加载中...
            </div>
        }
      </div>
    </div>
  );
}