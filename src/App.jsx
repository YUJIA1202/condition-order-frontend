// src/App.jsx
import { useState, useEffect } from "react";
import { useMarketData } from "./hooks/useMarketData";
import HomePage from "./pages/Home";
import IndexConditionPage from "./pages/IndexCondition";   // 原 Condition，改名
import VolumeConditionPage from "./pages/VolumeCondition"; // 新页面
import PositionPage from "./pages/Position";
import AnalyticsPage from "./pages/Analytics";
import AnalyticsCalendar from "./pages/AnalyticsCalendar";
import ETFDetail from "./pages/ETFDetail";
import ETFKline from "./pages/ETFKline";

const THEMES = {
  light: {
    bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", text:"#24292f",
    muted:"#8c959f", sub:"#57606a", accent:"#0969da",
    pos:"#e03131", neg:"#2f9e44",
    warn:"#e67700", surface:"#f6f8fa", tag:"#eaeef2",
    navBg:"#ffffff",
  },
  dark: {
    bg:"#07090f", card:"#0d1117", border:"#1c2333", text:"#e6edf3",
    muted:"#484f58", sub:"#8b949e", accent:"#388bfd",
    pos:"#ff4d4f", neg:"#52c41a",
    warn:"#d29922", surface:"#161b22", tag:"#21262d",
    navBg:"#0d1117",
  },
};

function Navbar({ page, setPage, connected, dark, setDark, time, subPage, setSubPage }) {
  const t = THEMES[dark ? "dark" : "light"];
  const pages = [
    { id:"home",             label:"市场总览",     icon:"◎" },
    { id:"index-condition",  label:"股指条件单",   icon:"⊞" },
    { id:"volume-condition", label:"均价量能条件单", icon:"⟁" },
    { id:"position",         label:"持仓",         icon:"◈" },
    { id:"analytics",        label:"收益分析",     icon:"◇" },
  ];

  const analyticsSubPages = [
    { id:"main",     label:"总览" },
    { id:"calendar", label:"日历 & 对比" },
  ];

  return (
    <nav style={{
      display:"flex", flexDirection:"column",
      background:t.navBg, borderBottom:`1px solid ${t.border}`,
      position:"sticky", top:0, zIndex:100,
      fontFamily:"'IBM Plex Mono','Courier New',monospace",
    }}>
      {/* 主导航 */}
      <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 24px",height:52}}>
        <div style={{fontSize:13,fontWeight:700,color:t.accent,letterSpacing:2,marginRight:20}}>
          ETF·DESK
        </div>
        {pages.map(p => (
          <button key={p.id} onClick={() => { setPage(p.id); setSubPage("main"); }} style={{
            padding:"6px 14px", borderRadius:6, border:"none", cursor:"pointer",
            fontFamily:"monospace", fontSize:12,
            background: page === p.id ? t.accent : "transparent",
            color: page === p.id ? "#fff" : t.sub,
            transition:"all 0.15s",
          }}>{p.icon} {p.label}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:t.muted,fontFamily:"monospace"}}>🕐 北京</span>
            <span style={{fontSize:13,color:t.text,fontFamily:"monospace",fontWeight:700}}>{time}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:connected?t.pos:t.neg}}/>
            <span style={{fontSize:11,color:connected?t.pos:t.neg,fontFamily:"monospace"}}>
              {connected?"已连接":"未连接"}
            </span>
          </div>
          <button onClick={() => setDark(d => !d)} style={{
            background:t.tag, border:`1px solid ${t.border}`,
            borderRadius:6, padding:"4px 12px", cursor:"pointer",
            color:t.sub, fontSize:11, fontFamily:"monospace",
          }}>{dark ? "☀ 浅色" : "☾ 深色"}</button>
        </div>
      </div>

      {/* 收益分析子导航 */}
      {page === "analytics" && !["etf-detail","etf-kline"].includes(subPage) && (
        <div style={{display:"flex",alignItems:"center",gap:2,
          padding:"0 24px",height:36,borderTop:`1px solid ${t.border}`,
          background:t.surface}}>
          {analyticsSubPages.map(p => (
            <button key={p.id} onClick={() => setSubPage(p.id)} style={{
              padding:"4px 14px", borderRadius:6, border:"none", cursor:"pointer",
              fontFamily:"monospace", fontSize:12,
              background: subPage===p.id ? t.accent+"22" : "transparent",
              color: subPage===p.id ? t.accent : t.muted,
              borderBottom: subPage===p.id ? `2px solid ${t.accent}` : "2px solid transparent",
            }}>{p.label}</button>
          ))}
        </div>
      )}

      {/* ETF详情/K线 返回按钮 */}
      {["etf-detail","etf-kline"].includes(subPage) && (
        <div style={{display:"flex",alignItems:"center",gap:8,
          padding:"0 24px",height:36,borderTop:`1px solid ${t.border}`,
          background:t.surface}}>
          <button onClick={() => setSubPage("main")} style={{
            background:"none",border:"none",color:t.accent,
            cursor:"pointer",fontFamily:"monospace",fontSize:13,
          }}>← 返回收益分析</button>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [page, setPage]       = useState("home");
  const [subPage, setSubPage] = useState("main");
  const [dark, setDark]       = useState(false);
  const [time, setTime]       = useState("");
  const [selectedETF, setSelectedETF] = useState(null);

  const { indices, triggered, volumeTriggered, stockTicks, connected } = useMarketData();
  const t = THEMES[dark ? "dark" : "light"];

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const beijing = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      setTime(beijing.toISOString().slice(11,19));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const goETFDetail = (etf) => { setSelectedETF(etf); setSubPage("etf-detail"); };
  const goETFKline  = (etf) => { setSelectedETF(etf); setSubPage("etf-kline");  };

  return (
    <div style={{minHeight:"100vh", background:t.bg, color:t.text,
      fontFamily:"'IBM Plex Mono','Courier New',monospace"}}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-thumb { background:#30363d; border-radius:4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        select option { background:${t.card}; color:${t.text}; }
      `}</style>
      <Navbar page={page} setPage={setPage} connected={connected}
        dark={dark} setDark={setDark} time={time}
        subPage={subPage} setSubPage={setSubPage}/>
      <div key={page+subPage} style={{animation:"fadeUp 0.2s ease"}}>
        {page==="home"             && <HomePage           indices={indices} t={t}/>}
        {page==="index-condition"  && <IndexConditionPage indices={indices} triggered={triggered} t={t}/>}
        {page==="volume-condition" && <VolumeConditionPage stockTicks={stockTicks} volumeTriggered={volumeTriggered} t={t}/>}
        {page==="position"         && <PositionPage        t={t}/>}
        {page==="analytics" && subPage==="main"       && <AnalyticsPage     t={t} onETFDetail={goETFDetail} onETFKline={goETFKline}/>}
        {page==="analytics" && subPage==="calendar"   && <AnalyticsCalendar t={t}/>}
        {page==="analytics" && subPage==="etf-detail" && <ETFDetail etf={selectedETF} t={t}/>}
        {page==="analytics" && subPage==="etf-kline"  && <ETFKline  etf={selectedETF} t={t}/>}
      </div>
    </div>
  );
}
