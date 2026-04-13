// src/App.jsx
import { useState, useEffect } from "react";
import { useMarketData } from "./hooks/useMarketData";
import HomePage from "./pages/Home";
import IndexConditionPage from "./pages/IndexCondition";
import VolumeConditionPage from "./pages/VolumeCondition";
import PositionPage from "./pages/Position";
import AnalyticsPage from "./pages/Analytics";
import ETFKline from "./pages/ETFKline";
import ETFPnl from "./pages/ETFPnl";

const BLUE   = "#1d4ed8";
const BORDER = "#e2e8f0";
const MUTED  = "#94a3b8";

const NAV_PAGES = [
  { id:"home",             label:"市场总览",       icon:"◎" },
  { id:"index-condition",  label:"股指条件单",     icon:"⊞" },
  { id:"volume-condition", label:"均价量能条件单", icon:"⟁" },
  { id:"position",         label:"持仓",           icon:"◈" },
  { id:"analytics",        label:"持仓分析",       icon:"◇" },
];

function Navbar({ page, setPage, connected, time, subPage, setSubPage }) {
  const isDetail = ["etf-kline","etf-pnl"].includes(subPage);
  const detailLabel = subPage==="etf-kline" ? "K线图" : "盈亏分析";

  return (
    <nav style={{
      display:"flex",flexDirection:"column",
      background:"#ffffff",
      borderBottom:`1.5px solid ${BORDER}`,
      position:"sticky",top:0,zIndex:100,
      boxShadow:"0 2px 12px rgba(29,78,216,0.06)",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:2,padding:"0 24px",height:52}}>
        <div style={{fontSize:15,fontWeight:900,color:BLUE,letterSpacing:2,marginRight:24,
          fontFamily:"'Courier New',monospace"}}>
          ETF·DESK
        </div>

        {NAV_PAGES.map(p=>{
          const active = page===p.id;
          return (
            <button key={p.id} onClick={()=>{ setPage(p.id); setSubPage("main"); }} style={{
              padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",
              fontSize:12,fontWeight:600,
              background:active?BLUE:"transparent",
              color:active?"#fff":"#64748b",
              transition:"all 0.15s",
            }}
              onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background="#f0f4ff"; e.currentTarget.style.color=BLUE; }}}
              onMouseLeave={e=>{ if(!active){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#64748b"; }}}
            >
              {p.icon} {p.label}
            </button>
          );
        })}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:MUTED,fontFamily:"monospace"}}>🕐</span>
            <span style={{fontSize:13,color:"#334155",fontFamily:"monospace",
              fontWeight:700,letterSpacing:1}}>{time}</span>
          </div>
          <div style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"4px 10px",borderRadius:20,
            background:connected?"#f0fdf4":"#f8fafc",
            border:`1px solid ${connected?"#86efac":BORDER}`,
          }}>
            <div style={{width:6,height:6,borderRadius:"50%",
              background:connected?"#16a34a":"#94a3b8",
              boxShadow:connected?"0 0 0 2px #bbf7d0":"none"}}/>
            <span style={{fontSize:11,fontWeight:700,
              color:connected?"#16a34a":"#94a3b8"}}>
              {connected?"已连接":"未连接"}
            </span>
          </div>
        </div>
      </div>

      {/* 返回栏 */}
      {isDetail&&(
        <div style={{display:"flex",alignItems:"center",
          padding:"0 24px",height:36,borderTop:`1px solid ${BORDER}`,background:"#fafbff"}}>
          <button onClick={()=>setSubPage("main")} style={{
            background:"none",border:"none",color:BLUE,
            cursor:"pointer",fontSize:13,fontWeight:600,
            display:"flex",alignItems:"center",gap:4,
          }}>← 返回持仓分析</button>
          <span style={{fontSize:12,color:MUTED,marginLeft:12}}>/ {detailLabel}</span>
        </div>
      )}
    </nav>
  );
}

export default function App() {
  const [page,        setPage]        = useState("home");
  const [subPage,     setSubPage]     = useState("main");
  const [time,        setTime]        = useState("");
  const [selectedETF, setSelectedETF] = useState(null);

  const { indices, triggered, volumeTriggered, stockTicks, sectors, connected } = useMarketData();

  useEffect(()=>{
    const update=()=>{
      const now     = new Date();
      const beijing = new Date(now.getTime()+(8*60*60*1000));
      setTime(beijing.toISOString().slice(11,19));
    };
    update();
    const iv = setInterval(update,1000);
    return ()=>clearInterval(iv);
  },[]);

  const goETFKline = etf=>{ setSelectedETF(etf); setSubPage("etf-kline"); };
  const goETFPnl   = etf=>{ setSelectedETF(etf); setSubPage("etf-pnl");   };

  return (
    <div style={{
      minHeight:"100vh",background:"#f0f4ff",color:"#0f172a",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:#bfdbfe;border-radius:4px;}
        ::-webkit-scrollbar-track{background:#f0f4ff;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#fff;color:#0f172a;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.4;}
      `}</style>

      <Navbar page={page} setPage={setPage} connected={connected}
        time={time} subPage={subPage} setSubPage={setSubPage}/>

      <div key={page+subPage} style={{animation:"fadeUp 0.2s ease"}}>
        {page==="home"             && <HomePage            indices={indices} sectors={sectors}/>}
        {page==="index-condition"  && <IndexConditionPage  indices={indices} triggered={triggered}/>}
        {page==="volume-condition" && <VolumeConditionPage stockTicks={stockTicks} volumeTriggered={volumeTriggered}/>}
        {page==="position"         && <PositionPage/>}
        {page==="analytics"&&subPage==="main"     && <AnalyticsPage onETFKline={goETFKline} onETFPnl={goETFPnl}/>}
        {page==="analytics"&&subPage==="etf-kline"&& <ETFKline etf={selectedETF}/>}
        {page==="analytics"&&subPage==="etf-pnl"  && <ETFPnl   etf={selectedETF}/>}
      </div>
    </div>
  );
}
