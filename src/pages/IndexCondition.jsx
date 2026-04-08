// src/pages/IndexCondition.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { getConditions, addCondition, deleteCondition } from "../api/index";

const API = "http://localhost:8000";
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmt(n, d = 2) { return Number(n).toFixed(d); }

const INDEX_OPTIONS = [
  { code: "000001.SH", name: "上证指数" },
  { code: "399001.SZ", name: "深证成指" },
  { code: "399006.SZ", name: "创业板指" },
  { code: "688000.SH", name: "科创50" },
  { code: "899050.BJ", name: "北证50" },
];

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

// ─── 全市场搜索框 ─────────────────────────────────────────────────
function StockSearch({ onSelect, t, placeholder }) {
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
          placeholder={placeholder || "搜索代码或名称…"}
          style={{
            width: "100%", padding: "8px 30px 8px 10px", boxSizing: "border-box",
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 6, color: t.text, fontSize: 13,
            fontFamily: "monospace", outline: "none",
          }}
        />
        {loading && (
          <span style={{
            position: "absolute", right: 10, top: "50%",
            transform: "translateY(-50%)", fontSize: 12, color: t.muted,
          }}>…</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: t.card, border: `1px solid ${t.border}`,
          borderRadius: 8, zIndex: 300, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
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

// ─── 条件单卡片 ───────────────────────────────────────────────────
function ConditionCard({ c, t, expandedKline, setExpandedKline, onDelete }) {
  const isExpanded = expandedKline === c.id;
  const idxName    = INDEX_OPTIONS.find(i => i.code === c.index_code)?.name ?? c.index_code;
  const etfCode    = c.etf_code ?? "";
  const etfName    = c.etf_name ?? etfCode;

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${c.triggered ? t.pos + "66" : t.border}`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: c.triggered ? t.pos : t.accent, fontFamily: "monospace" }}>
          {c.triggered ? "✓ 已触发" : "● 监控中"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {etfCode && (
            <button onClick={() => setExpandedKline(isExpanded ? null : c.id)} style={{
              background: "none", border: `1px solid ${t.border}`,
              borderRadius: 4, padding: "2px 8px", cursor: "pointer",
              color: isExpanded ? t.accent : t.muted,
              fontSize: 11, fontFamily: "monospace",
            }}>
              {isExpanded ? "收起" : "K线 ▾"}
            </button>
          )}
          <button onClick={() => onDelete(c.id)} style={{
            background: "none", border: "none", color: t.muted,
            cursor: "pointer", fontSize: 13, fontFamily: "monospace",
          }}>删除</button>
        </div>
      </div>

      <div style={{ fontSize: 15, color: t.text, fontFamily: "monospace" }}>
        {idxName}
        <span style={{ color: t.warn }}>{" "}{c.op === "lte" ? "≤" : "≥"} {c.price}</span>
      </div>
      <div style={{ fontSize: 14, color: t.sub, marginTop: 4, fontFamily: "monospace" }}>
        →{" "}
        <span style={{ color: c.action === "buy" ? t.pos : t.neg }}>
          {c.action === "buy" ? "买入" : "卖出"}
        </span>
        {" "}{etfName}{etfName !== etfCode && etfCode ? ` (${etfCode})` : ""} · {c.qty}手
      </div>

      {isExpanded && etfCode && <MiniKline code={etfCode} t={t} />}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function IndexConditionPage({ indices, triggered, t }) {
  const [conditions,    setConditions]    = useState([]);
  const [selectedETF,   setSelectedETF]   = useState(null);
  const [expandedKline, setExpandedKline] = useState(null);
  const [form, setForm] = useState({
    index_code: "000001.SH", op: "lte", price: "", action: "buy", qty: "",
  });
  const [leftPct,    setLeftPct]    = useState(50);
  const containerRef = useRef();
  const isDragging   = useRef(false);

  const inp = {
    background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
    color: t.text, padding: "8px 12px", fontSize: 15, outline: "none",
    fontFamily: "monospace", width: "100%", boxSizing: "border-box",
  };

  const onDividerMouseDown = useCallback(e => {
    e.preventDefault(); isDragging.current = true;
  }, []);

  useEffect(() => {
    const onMove = e => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLeftPct(clamp((e.clientX - rect.left) / rect.width * 100, 25, 75));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  useEffect(() => {
    getConditions().then(setConditions).catch(console.error);
  }, []);

  useEffect(() => {
    if (triggered.length > 0) getConditions().then(setConditions).catch(console.error);
  }, [triggered]);

  const handleAdd = async () => {
    if (!form.price || !form.qty) return alert("请填写触发点位和数量");
    if (!selectedETF)             return alert("请搜索并选择标的ETF/股票");
    try {
      await addCondition({
        ...form,
        price:    parseFloat(form.price),
        qty:      parseInt(form.qty),
        etf_code: selectedETF.code,
        etf_name: selectedETF.name,
      });
      setForm({ index_code: "000001.SH", op: "lte", price: "", action: "buy", qty: "" });
      setSelectedETF(null);
      getConditions().then(setConditions);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async cid => {
    await deleteCondition(cid);
    setConditions(prev => prev.filter(c => c.id !== cid));
  };

  const priceMap = Object.fromEntries(indices.map(i => [i.code, i.price]));

  return (
    <div ref={containerRef} style={{
      display: "flex", padding: "20px 24px", gap: 0,
      position: "relative", alignItems: "flex-start",
      fontFamily: "'IBM Plex Mono','Courier New',monospace",
    }}>

      {/* ══ 左栏 ══ */}
      <div style={{
        width: `${leftPct}%`, paddingRight: 8, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 12,
      }}>

        {/* 当前指数 */}
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: 2, marginBottom: 8 }}>当前指数</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {INDEX_OPTIONS.map(idx => (
              <div key={idx.code} style={{ background: t.surface, borderRadius: 6, padding: "4px 10px" }}>
                <span style={{ fontSize: 13, color: t.muted }}>{idx.name} </span>
                <span style={{ fontSize: 15, fontFamily: "monospace", fontWeight: 700, color: t.text }}>
                  {priceMap[idx.code] ? Number(priceMap[idx.code]).toFixed(2) : "--"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 新建条件单 */}
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: 2, marginBottom: 14 }}>新建条件单</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>触发指数</div>
                <select style={inp} value={form.index_code}
                  onChange={e => setForm(p => ({ ...p, index_code: e.target.value }))}>
                  {INDEX_OPTIONS.map(i => <option key={i.code} value={i.code}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>条件</div>
                <select style={inp} value={form.op}
                  onChange={e => setForm(p => ({ ...p, op: e.target.value }))}>
                  <option value="lte">≤</option>
                  <option value="gte">≥</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>触发点位</div>
              <input style={inp} type="number" placeholder="输入点位..."
                value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>操作</div>
                <select style={inp} value={form.action}
                  onChange={e => setForm(p => ({ ...p, action: e.target.value }))}>
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>数量（手）</div>
                <input style={inp} type="number" placeholder="1000"
                  value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, color: t.muted, marginBottom: 4 }}>标的 ETF / 股票</div>
              <StockSearch t={t} placeholder="搜索代码或名称（如 510300、沪深300）"
                onSelect={item => setSelectedETF(item)} />
              {selectedETF && (
                <div style={{
                  marginTop: 6, fontSize: 11, color: t.muted,
                  padding: "4px 8px", background: t.surface,
                  borderRadius: 4, fontFamily: "monospace",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>
                    <span style={{ color: t.accent }}>{selectedETF.code.split(".")[0]}</span>
                    {"  "}{selectedETF.name}
                  </span>
                  <span style={{ cursor: "pointer", color: t.muted }}
                    onClick={() => setSelectedETF(null)}>✕</span>
                </div>
              )}
            </div>

            <button onClick={handleAdd} style={{
              marginTop: 4, padding: "10px", background: t.accent,
              border: "none", borderRadius: 7, color: "#fff",
              fontSize: 15, cursor: "pointer", fontFamily: "monospace", fontWeight: 700,
            }}>＋ 添加条件单</button>
          </div>
        </div>

        {/* 条件单列表 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conditions.length === 0
            ? <div style={{ color: t.muted, fontSize: 15, textAlign: "center", padding: 20 }}>暂无条件单</div>
            : conditions.map(c => (
              <ConditionCard key={c.id} c={c} t={t}
                expandedKline={expandedKline}
                setExpandedKline={setExpandedKline}
                onDelete={handleDelete} />
            ))
          }
        </div>
      </div>

      {/* ══ 分割线 ══ */}
      <div onMouseDown={onDividerMouseDown} style={{
        width: 14, flexShrink: 0, cursor: "col-resize",
        display: "flex", alignItems: "stretch",
        justifyContent: "center", alignSelf: "stretch", minHeight: 400, padding: "0 4px",
      }}>
        <div style={{ width: 3, borderRadius: 3, background: t.border, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = t.accent}
          onMouseLeave={e => e.currentTarget.style.background = t.border} />
      </div>

      {/* ══ 右栏：触发日志 ══ */}
      <div style={{ flex: 1, paddingLeft: 8 }}>
        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: t.muted, letterSpacing: 3, marginBottom: 14 }}>触发日志</div>
          {triggered.length === 0
            ? <div style={{ color: t.muted, fontSize: 15, textAlign: "center", marginTop: 20 }}>
                等待条件触发...
              </div>
            : triggered.map((item, i) => (
              <div key={i} style={{
                fontSize: 14, color: t.pos, fontFamily: "monospace",
                padding: "10px 14px", background: t.surface, borderRadius: 6,
                borderLeft: `3px solid ${t.pos}`, marginBottom: 8,
              }}>
                {item.action === "buy" ? "买入" : "卖出"} {item.etf_code} {item.qty}手
                · {INDEX_OPTIONS.find(x => x.code === item.index_code)?.name} 触及 {item.price}
                · 成交价 {Number(item.current_price).toFixed(2)}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}