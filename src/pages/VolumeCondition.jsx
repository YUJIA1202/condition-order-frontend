// src/pages/VolumeCondition.jsx
import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:8000";
function fmt(n, d = 3) { return Number(n).toFixed(d); }
function pct(v, d = 2) { return (v >= 0 ? "+" : "") + Number(v).toFixed(d) + "%"; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── K线图 ────────────────────────────────────────────────────────
function MiniKline({ code, t }) {
  const canvasRef = useRef(null);
  const [bars,    setBars]    = useState([]);
  const [period,  setPeriod]  = useState("1d");
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`${API}/kline?code=${encodeURIComponent(code)}&period=${period}&count=60`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setBars(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, period]);

  useEffect(() => {
    if (!bars.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const PAD = { top: 10, right: 8, bottom: 24, left: 46 };
    const cW  = W - PAD.left - PAD.right;
    const cH  = H - PAD.top  - PAD.bottom;
    const maxP  = Math.max(...bars.map(b => b.h));
    const minP  = Math.min(...bars.map(b => b.l));
    const range = maxP - minP || 1;
    const py    = v => PAD.top + cH - ((v - minP) / range) * cH;
    const barW  = cW / bars.length;
    const cndW  = Math.max(1, barW * 0.6);

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = t.border + "55"; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y   = PAD.top + (cH / 4) * i;
      const val = maxP - (range / 4) * i;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillStyle = t.muted; ctx.font = "10px monospace"; ctx.textAlign = "right";
      ctx.fillText(fmt(val, 3), PAD.left - 4, y + 3);
    }

    bars.forEach((b, i) => {
      const x   = PAD.left + i * barW + barW / 2;
      const up  = b.c >= b.o;
      const col = up ? t.pos : t.neg;
      const yO  = py(b.o), yC = py(b.c), yH = py(b.h), yL = py(b.l);
      const top = Math.min(yO, yC);
      const bH  = Math.max(1, Math.abs(yO - yC));

      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, top);      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, top + bH); ctx.lineTo(x, yL); ctx.stroke();

      if (up) {
        ctx.strokeRect(x - cndW / 2, top, cndW, bH);
        ctx.fillStyle = col + "30"; ctx.fillRect(x - cndW / 2, top, cndW, bH);
      } else {
        ctx.fillStyle = col; ctx.fillRect(x - cndW / 2, top, cndW, bH);
      }
    });

    if (tooltip !== null && tooltip >= 0 && tooltip < bars.length) {
      const x = PAD.left + tooltip * barW + barW / 2;
      ctx.strokeStyle = t.muted + "77"; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, H - PAD.bottom); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = t.muted; ctx.font = "10px monospace"; ctx.textAlign = "center";
    const step = Math.max(1, Math.floor(bars.length / 5));
    for (let i = 0; i < bars.length; i += step) {
      const d = new Date(bars[i].t * 1000);
      const label = period === "1d"
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      ctx.fillText(label, PAD.left + i * barW + barW / 2, H - 6);
    }
  }, [bars, tooltip, t, period]);

  const handleMouseMove = useCallback(e => {
    if (!canvasRef.current || !bars.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const barW = (rect.width - 54) / bars.length;
    const idx  = Math.floor((e.clientX - rect.left - 46) / barW);
    setTooltip(idx >= 0 && idx < bars.length ? idx : null);
  }, [bars]);

  const tb = tooltip !== null ? bars[tooltip] : null;

  return (
    <div style={{ marginTop: 12, background: t.surface, borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 8px", borderBottom: `1px solid ${t.border}`,
      }}>
        <span style={{ fontSize: 11, color: t.muted, fontFamily: "monospace" }}>K线</span>
        <div style={{ display: "flex", gap: 3 }}>
          {["1m","5m","15m","30m","1d"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "2px 7px", borderRadius: 4, border: "none", cursor: "pointer",
              fontFamily: "monospace", fontSize: 11,
              background: period === p ? t.accent : "transparent",
              color: period === p ? "#fff" : t.muted,
            }}>{p}</button>
          ))}
        </div>
      </div>
      {tb && (
        <div style={{
          display: "flex", gap: 10, padding: "3px 8px",
          fontSize: 11, fontFamily: "monospace", color: t.muted,
          background: t.card, borderBottom: `1px solid ${t.border}`,
        }}>
          <span>O <span style={{ color: t.text }}>{fmt(tb.o, 3)}</span></span>
          <span>H <span style={{ color: t.pos  }}>{fmt(tb.h, 3)}</span></span>
          <span>L <span style={{ color: t.neg  }}>{fmt(tb.l, 3)}</span></span>
          <span>C <span style={{ color: tb.c >= tb.o ? t.pos : t.neg }}>{fmt(tb.c, 3)}</span></span>
        </div>
      )}
      <div style={{ position: "relative", height: 140 }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 12, color: t.muted,
          }}>加载中…</div>
        )}
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
      </div>
    </div>
  );
}

// ─── 分时行情预览 ─────────────────────────────────────────────────
function MiniTick({ tick, t }) {
  if (!tick) return (
    <div style={{ height: 60, display: "flex", alignItems: "center",
      justifyContent: "center", color: t.muted, fontSize: 12 }}>
      暂无行情
    </div>
  );
  const dev    = tick.vwap > 0 ? ((tick.price - tick.vwap) / tick.vwap * 100).toFixed(2) : 0;
  const devNum = parseFloat(dev);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace",
          color: tick.change >= 0 ? t.pos : t.neg }}>{fmt(tick.price)}</span>
        <span style={{ fontSize: 13, fontFamily: "monospace",
          color: tick.change >= 0 ? t.pos : t.neg }}>{pct(tick.change)}</span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>均价线</div>
          <div style={{ fontSize: 13, fontFamily: "monospace", color: t.text, fontWeight: 600 }}>
            {fmt(tick.vwap)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>价格偏离</div>
          <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600,
            color: devNum > 0 ? t.pos : devNum < 0 ? t.neg : t.muted }}>
            {devNum >= 0 ? "+" : ""}{dev}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: t.muted, marginBottom: 2 }}>量比</div>
          <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600,
            color: tick.vol_ratio >= 1.5 ? t.pos : t.text }}>{tick.vol_ratio}x</div>
        </div>
      </div>
    </div>
  );
}

// ─── 滑块 ─────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step, unit, t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: t.muted }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: t.accent }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: t.accent, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: t.muted }}>{min}{unit}</span>
        <span style={{ fontSize: 10, color: t.muted }}>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── 全市场搜索框 ─────────────────────────────────────────────────
function StockSearch({ onSelect, t }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const search = useCallback((q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API}/search-stock?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data); setOpen(true);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 300);
  }, []);

  const handleSelect = item => {
    setQuery(`${item.code.split(".")[0]}  ${item.name}`);
    setOpen(false); onSelect(item);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="搜索股票或ETF代码/名称..."
          style={{
            width: "100%", padding: "8px 30px 8px 10px", boxSizing: "border-box",
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 6, color: t.text, fontSize: 13,
            fontFamily: "monospace", outline: "none",
          }}
        />
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%",
            transform: "translateY(-50%)", fontSize: 12, color: t.muted }}>…</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 8, zIndex: 200, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {results.map(item => (
            <div key={item.code} onClick={() => handleSelect(item)}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 13,
                fontFamily: "monospace", color: t.text,
                borderBottom: `1px solid ${t.border}`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.surface}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: t.accent, marginRight: 10 }}>{item.code.split(".")[0]}</span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 状态标签 ─────────────────────────────────────────────────────
function StatusTag({ status, t }) {
  const cfg = {
    active:    { label: "监控中", bg: t.accent + "22", color: t.accent },
    triggered: { label: "已触发", bg: t.pos    + "22", color: t.pos    },
    cancelled: { label: "已取消", bg: t.muted  + "22", color: t.muted  },
  };
  const c = cfg[status] || cfg.active;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: 11,
      fontFamily: "monospace", background: c.bg, color: c.color, fontWeight: 600,
    }}>{c.label}</span>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function VolumeConditionPage({ stockTicks, volumeTriggered, t }) {
  const [leftPct,       setLeftPct]       = useState(38);
  const [expandedKline, setExpandedKline] = useState(null);
  const isDragging          = useRef(false);
  const containerRef        = useRef(null);
  const prevVolumeTriggered = useRef([]);
  const [previewTick, setPreviewTick] = useState(null);

  const [selectedStock, setSelectedStock] = useState(null);
  const [action,        setAction]        = useState("buy");
  const [op,            setOp]            = useState("lte");
  const [triggerPrice,  setTriggerPrice]  = useState("");
  const [qty,           setQty]           = useState("");
  const [volThr,        setVolThr]        = useState(1.5);
  const [vwapThr,       setVwapThr]       = useState(1.5);
  const [conditions,    setConditions]    = useState([]);
  const [logs,          setLogs]          = useState([]);
  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  if (!selectedStock) { setPreviewTick(null); return; }
  fetch(`${API}/stock-tick?code=${encodeURIComponent(selectedStock.code)}`)
    .then(r => r.json())
    .then(setPreviewTick)
    .catch(() => setPreviewTick(null));
}, [selectedStock]);

  useEffect(() => {
    fetch(`${API}/volume-conditions`)
      .then(r => r.json()).then(setConditions).catch(console.error);
  }, []);

  useEffect(() => {
    if (!volumeTriggered?.length) return;
    const newEvents = volumeTriggered.filter(
      e => !prevVolumeTriggered.current.find(
        p => p.id === e.id && p.trigger_time === e.trigger_time
      )
    );
    prevVolumeTriggered.current = volumeTriggered;
    if (!newEvents.length) return;
    setConditions(prev => prev.map(c => {
      const ev = newEvents.find(e => e.id === c.id);
      return ev ? { ...c, status: ev.status, cancel_reason: ev.cancel_reason,
        trigger_time: ev.trigger_time, order_result: ev.order_result } : c;
    }));
    setLogs(prev => [...newEvents, ...prev].slice(0, 100));
  }, [volumeTriggered]);

  const currentTick = (selectedStock && stockTicks?.[selectedStock.code])
  ? stockTicks[selectedStock.code]
  : previewTick;

  const onDividerMouseDown = useCallback(e => {
    e.preventDefault(); isDragging.current = true;
    const onMove = e => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLeftPct(clamp(((e.clientX - rect.left) / rect.width) * 100, 25, 65));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const handleAdd = async () => {
    if (!selectedStock)                                                        return alert("请先搜索并选择股票");
    if (!triggerPrice || isNaN(triggerPrice) || parseFloat(triggerPrice) <= 0) return alert("请输入有效的触发价格");
    if (!qty || isNaN(qty) || parseInt(qty) <= 0)                              return alert("请输入有效的数量");
    try {
      const res  = await fetch(`${API}/volume-conditions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_code: selectedStock.code, stock_name: selectedStock.name,
          action, op,
          trigger_price:       parseFloat(triggerPrice),
          qty:                 parseInt(qty),
          vol_ratio_threshold: volThr,
          vwap_dev_threshold:  vwapThr,
        }),
      });
      const data = await res.json();
      setConditions(prev => [data, ...prev]);
      setTriggerPrice(""); setQty("");
    } catch (e) { alert("添加失败：" + e.message); }
  };

  const handleDelete = async cid => {
    try {
      await fetch(`${API}/volume-conditions/${cid}`, { method: "DELETE" });
      setConditions(prev => prev.filter(c => c.id !== cid));
    } catch (e) { console.error(e); }
  };

  const opLabel = op === "lte" ? "≤" : "≥";

  return (
    <div ref={containerRef} style={{
      display: "flex", height: "calc(100vh - 52px)",
      fontFamily: "'IBM Plex Mono','Courier New',monospace", overflow: "hidden",
    }}>

      {/* ══ 左栏 ══ */}
      <div style={{
        width: `${leftPct}%`, minWidth: 280,
        display: "flex", flexDirection: "column",
        borderRight: `1px solid ${t.border}`, overflowY: "auto",
      }}>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

          <div style={{ fontSize: 13, color: t.muted, letterSpacing: 2, fontWeight: 600 }}>
            ⟁ 均价量能条件单
          </div>

          {/* 选择标的 */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: t.muted }}>选择标的</div>
            <StockSearch onSelect={setSelectedStock} t={t} />
            {selectedStock && (<>
              <div style={{ fontSize: 11, color: t.muted, padding: "4px 8px",
                background: t.surface, borderRadius: 4, fontFamily: "monospace" }}>
                {selectedStock.code} · {selectedStock.name}
              </div>
              <MiniTick tick={currentTick} t={t} />
            </>)}
          </div>

          {/* 操作方向 */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: t.muted }}>操作方向</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "buy",  label: "买入", desc: "价格到位后验证量能再买" },
                { id: "sell", label: "卖出", desc: "价格到位后验证量能再卖" },
              ].map(a => (
                <button key={a.id} onClick={() => { setAction(a.id); setOp(a.id === "buy" ? "lte" : "gte"); }} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "monospace", fontSize: 13, fontWeight: 600,
                  border: `2px solid ${action === a.id ? (a.id === "buy" ? t.pos : t.neg) : t.border}`,
                  background: action === a.id ? (a.id === "buy" ? t.pos + "18" : t.neg + "18") : "transparent",
                  color: action === a.id ? (a.id === "buy" ? t.pos : t.neg) : t.sub,
                  transition: "all 0.15s",
                }}>
                  {a.label}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3,
                    color: action === a.id ? (a.id === "buy" ? t.pos : t.neg) : t.muted }}>
                    {a.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 触发条件 */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: t.muted }}>触发条件</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={op} onChange={e => setOp(e.target.value)} style={{
                padding: "8px 10px", borderRadius: 6, fontSize: 13,
                fontFamily: "monospace", fontWeight: 700,
                background: t.surface, border: `1px solid ${t.border}`,
                color: t.text, cursor: "pointer", minWidth: 60,
              }}>
                <option value="lte">≤</option>
                <option value="gte">≥</option>
              </select>
              <input type="number" step="0.001" min="0" value={triggerPrice}
                onChange={e => setTriggerPrice(e.target.value)} placeholder="触发价格"
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 6,
                  background: t.surface, border: `1px solid ${t.border}`,
                  color: t.text, fontSize: 13, fontFamily: "monospace", outline: "none",
                }} />
            </div>
            {currentTick && (
              <div style={{ fontSize: 11, color: t.muted, fontFamily: "monospace" }}>
                当前价 {fmt(currentTick.price)}
                {triggerPrice && !isNaN(triggerPrice) && (
                  <span style={{ marginLeft: 8,
                    color: parseFloat(triggerPrice) < currentTick.price ? t.neg : t.pos }}>
                    距触发 {((parseFloat(triggerPrice) - currentTick.price) / currentTick.price * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
            <input type="number" step="100" min="100" value={qty}
              onChange={e => setQty(e.target.value)} placeholder="数量（股）"
              style={{
                padding: "8px 10px", borderRadius: 6,
                background: t.surface, border: `1px solid ${t.border}`,
                color: t.text, fontSize: 13, fontFamily: "monospace", outline: "none",
              }} />
          </div>

          {/* 量能参数 */}
          <div style={{ background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 12, color: t.muted }}>量能过滤参数</div>
            <Slider label="量比阈值（超过此值判定为放量）"
              value={volThr} onChange={setVolThr} min={0.5} max={3.0} step={0.1} unit="x" t={t} />
            <Slider label="均价线偏离阈值（价格偏离超过此值触发判断）"
              value={vwapThr} onChange={setVwapThr} min={0.5} max={3.0} step={0.1} unit="%" t={t} />
            <div style={{
              background: t.surface, borderRadius: 8, padding: 12,
              fontSize: 11, color: t.muted, lineHeight: 1.9,
              borderLeft: `3px solid ${t.accent}`,
            }}>
              <div style={{ color: t.accent, fontWeight: 600, marginBottom: 4 }}>当前逻辑预览</div>
              {action === "buy" ? (<>
                <div>✓ 价格 {opLabel} {triggerPrice || "?"} 时触发检查</div>
                <div style={{ color: t.neg }}>✗ 下跌触发：放量({volThr}x↑) + 跌破均价线({vwapThr}%↓) → 取消买入</div>
                <div style={{ color: t.neg }}>✗ 上涨触发：放量({volThr}x↑) + 价格虚高({vwapThr}%↑) → 取消买入</div>
                <div style={{ color: t.pos }}>✓ 其余情况 → 正常买入</div>
              </>) : (<>
                <div>✓ 价格 {opLabel} {triggerPrice || "?"} 时触发检查</div>
                <div style={{ color: t.neg }}>✗ 上涨触发：放量({volThr}x↑) + 均价线走高({vwapThr}%↑) → 取消卖出</div>
                <div style={{ color: t.neg }}>✗ 下跌触发：缩量({volThr}x↓) → 取消卖出</div>
                <div style={{ color: t.pos }}>✓ 其余情况 → 正常卖出</div>
              </>)}
            </div>
          </div>

          <button onClick={handleAdd} style={{
            width: "100%", padding: "12px 0", borderRadius: 8,
            border: "none", cursor: "pointer", fontFamily: "monospace",
            fontSize: 14, fontWeight: 700,
            background: action === "buy" ? t.pos : t.neg,
            color: "#fff", transition: "opacity 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            + 添加{action === "buy" ? "买入" : "卖出"}条件单
          </button>
        </div>
      </div>

      {/* ══ 分割线 ══ */}
      <div onMouseDown={onDividerMouseDown}
        style={{ width: 4, cursor: "col-resize", flexShrink: 0, background: "transparent", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = t.accent + "66"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      />

      {/* ══ 右栏 ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ flex: 1, overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, color: t.muted, letterSpacing: 2 }}>
              条件单监控
              <span style={{ marginLeft: 10, fontSize: 11, color: t.accent, fontFamily: "monospace" }}>
                {conditions.filter(c => c.status === "active").length} 活跃
              </span>
            </div>
          </div>

          {conditions.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: t.muted, fontSize: 13 }}>
              暂无条件单，在左侧添加
            </div>
          )}

          {conditions.map(cond => {
            const tick        = stockTicks?.[cond.stock_code];
            const isActive    = cond.status === "active";
            const isTriggered = cond.status === "triggered";
            const isCancelled = cond.status === "cancelled";
            const isExpanded  = expandedKline === cond.id;
            return (
              <div key={cond.id} style={{
                background: t.card,
                border: `1px solid ${isTriggered ? t.pos + "66" : isCancelled ? t.muted + "44" : t.border}`,
                borderRadius: 10, padding: 16,
                opacity: isCancelled ? 0.65 : 1, transition: "all 0.2s",
              }}>
                {/* 头部 */}
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                      color: cond.action === "buy" ? t.pos : t.neg }}>
                      {cond.action === "buy" ? "买↑" : "卖↓"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {cond.stock_code.split(".")[0]}
                    </span>
                    <span style={{ fontSize: 12, color: t.muted }}>{cond.stock_name}</span>
                    <StatusTag status={cond.status} t={t} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setExpandedKline(isExpanded ? null : cond.id)} style={{
                      background: "none", border: `1px solid ${t.border}`,
                      borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                      color: isExpanded ? t.accent : t.muted,
                      fontSize: 11, fontFamily: "monospace",
                    }}>
                      {isExpanded ? "收起" : "K线 ▾"}
                    </button>
                    {isActive && (
                      <button onClick={() => handleDelete(cond.id)} style={{
                        background: "none", border: `1px solid ${t.border}`,
                        borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                        color: t.muted, fontSize: 11, fontFamily: "monospace",
                      }}>删除</button>
                    )}
                  </div>
                </div>

                {/* 参数行 */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap",
                  fontSize: 12, fontFamily: "monospace" }}>
                  <span style={{ color: t.muted }}>触发价 <span style={{ color: t.text, fontWeight: 600 }}>
                    {cond.op === "lte" ? "≤" : "≥"} {fmt(cond.trigger_price)}
                  </span></span>
                  <span style={{ color: t.muted }}>数量 <span style={{ color: t.text, fontWeight: 600 }}>
                    {cond.qty.toLocaleString()}股
                  </span></span>
                  <span style={{ color: t.muted }}>量比阈值 <span style={{ color: t.accent, fontWeight: 600 }}>
                    {cond.vol_ratio_threshold}x
                  </span></span>
                  <span style={{ color: t.muted }}>偏离阈值 <span style={{ color: t.accent, fontWeight: 600 }}>
                    {cond.vwap_dev_threshold}%
                  </span></span>
                </div>

                {/* 实时行情 */}
                {isActive && tick && (
                  <div style={{ marginTop: 10, padding: "8px 12px",
                    background: t.surface, borderRadius: 6,
                    display: "flex", gap: 20, fontSize: 12, fontFamily: "monospace" }}>
                    <span style={{ color: tick.change >= 0 ? t.pos : t.neg, fontWeight: 600 }}>
                      {fmt(tick.price)} {pct(tick.change)}
                    </span>
                    <span style={{ color: t.muted }}>均价线 <span style={{ color: t.text }}>
                      {fmt(tick.vwap)}
                    </span></span>
                    <span style={{ color: t.muted }}>量比 <span style={{
                      color: tick.vol_ratio >= cond.vol_ratio_threshold ? t.pos : t.text,
                      fontWeight: tick.vol_ratio >= cond.vol_ratio_threshold ? 700 : 400,
                    }}>{tick.vol_ratio}x</span></span>
                    <span style={{ color: t.muted }}>距触发 <span style={{
                      color: Math.abs((tick.price - cond.trigger_price) / cond.trigger_price) < 0.005
                        ? t.warn : t.text,
                    }}>
                      {((tick.price - cond.trigger_price) / cond.trigger_price * 100).toFixed(2)}%
                    </span></span>
                  </div>
                )}

                {/* 取消原因 */}
                {isCancelled && cond.cancel_reason && (
                  <div style={{ marginTop: 10, padding: "6px 10px",
                    background: t.muted + "11", borderRadius: 6,
                    fontSize: 11, color: t.muted, fontFamily: "monospace" }}>
                    ✗ {cond.cancel_reason}
                  </div>
                )}

                {/* 触发结果 */}
                {isTriggered && cond.order_result && (
                  <div style={{ marginTop: 10, padding: "6px 10px",
                    background: t.pos + "11", borderRadius: 6,
                    fontSize: 11, color: t.pos, fontFamily: "monospace" }}>
                    ✓ {cond.order_result.msg}
                  </div>
                )}

                {/* K线展开 */}
                {isExpanded && <MiniKline code={cond.stock_code} t={t} />}
              </div>
            );
          })}
        </div>

        {/* 触发日志 */}
        <div style={{ height: 180, borderTop: `1px solid ${t.border}`,
          display: "flex", flexDirection: "column", background: t.surface }}>
          <div style={{ padding: "8px 16px", fontSize: 11, color: t.muted,
            borderBottom: `1px solid ${t.border}`, letterSpacing: 1, fontWeight: 600 }}>
            触发日志
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {logs.length === 0 && (
              <div style={{ padding: "20px 16px", color: t.muted,
                fontSize: 12, textAlign: "center" }}>暂无日志</div>
            )}
            {logs.map((log, i) => {
              const ts       = log.trigger_time
                ? new Date(log.trigger_time * 1000).toLocaleTimeString("zh-CN") : "--:--:--";
              const isCancel = log.status === "cancelled";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "5px 16px", borderBottom: `1px solid ${t.border}22`,
                  fontSize: 11, fontFamily: "monospace",
                }}>
                  <span style={{ color: t.muted,  flexShrink: 0 }}>{ts}</span>
                  <span style={{ color: isCancel ? t.muted : t.pos, flexShrink: 0 }}>
                    {isCancel ? "✗ 取消" : "✓ 触发"}
                  </span>
                  <span style={{ color: log.action === "buy" ? t.pos : t.neg, flexShrink: 0 }}>
                    {log.action === "buy" ? "买" : "卖"} {log.stock_code?.split(".")?.[0]}
                  </span>
                  <span style={{ color: t.muted, flex: 1 }}>
                    {isCancel ? log.cancel_reason : log.order_result?.msg}
                  </span>
                  {!isCancel && (
                    <span style={{ color: t.muted, flexShrink: 0 }}>量比 {log.vol_ratio}x</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}