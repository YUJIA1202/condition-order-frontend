// src/pages/ETFKline.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { createChart, CandlestickSeries, LineSeries, LineStyle } from "lightweight-charts";
import { getKline } from "../api/index";

const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const TEXT   = "#0f172a";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }

function fullCode(code) {
  if(!code) return code;
  if(code.includes(".")) return code;
  if(code.startsWith("6")||code.startsWith("5")) return code+".SH";
  return code+".SZ";
}

const PERIODS = [
  {id:"5m",  label:"5分",  period:"5m",  count:240,  intraday:true},
  {id:"15m", label:"15分", period:"15m", count:200,  intraday:true},
  {id:"30m", label:"30分", period:"30m", count:200,  intraday:true},
  {id:"60m", label:"60分", period:"60m", count:200,  intraday:true},
  {id:"1d",  label:"日K",  period:"1d",  count:365,  intraday:false},
  {id:"1w",  label:"周K",  period:"1d",  count:730,  intraday:false, weekly:true},
];

function toWeekly(bars) {
  const map = {};
  bars.forEach(b=>{
    const d   = new Date(b.date);
    const day = d.getDay();
    const diff= day===0?-6:1-day;
    const mon = new Date(d);
    mon.setDate(d.getDate()+diff);
    const key = mon.toISOString().slice(0,10);
    if(!map[key]) map[key]={date:key,open:b.open,high:b.high,low:b.low,close:b.close,vol:b.vol,ts:b.ts};
    else {
      map[key].high  = Math.max(map[key].high, b.high);
      map[key].low   = Math.min(map[key].low,  b.low);
      map[key].close = b.close;
      map[key].vol  += b.vol;
    }
  });
  return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date));
}

// ─── 画线工具栏 ───────────────────────────────────────────────────
function Toolbar({ tool, setTool, lines, onDeleteLine, onClearLines }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",
      padding:"8px 12px",background:CARD,
      border:`1.5px solid ${BORDER}`,borderRadius:10,
    }}>
      <span style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:1}}>画线工具</span>
      <div style={{width:1,height:16,background:BORDER}}/>
      {[
        {id:"none",      label:"✋ 指针"},
        {id:"hline",     label:"━ 水平线"},
        {id:"trendline", label:"↗ 趋势线"},
      ].map(t=>(
        <button key={t.id} onClick={()=>setTool(t.id)} style={{
          padding:"4px 12px",borderRadius:6,cursor:"pointer",
          fontSize:12,fontWeight:600,fontFamily:"monospace",
          background:tool===t.id?BLUE:"transparent",
          border:`1.5px solid ${tool===t.id?BLUE:BORDER}`,
          color:tool===t.id?"#fff":"#64748b",
          transition:"all 0.15s",
        }}>{t.label}</button>
      ))}
      {lines.length>0&&<>
        <div style={{width:1,height:16,background:BORDER}}/>
        <button onClick={onClearLines} style={{
          padding:"4px 12px",borderRadius:6,cursor:"pointer",
          fontSize:12,fontWeight:600,
          background:"transparent",border:`1.5px solid ${BORDER}`,color:RED,
        }}>🗑 清除全部</button>
      </>}
      <span style={{fontSize:11,color:MUTED}}>
        {tool==="none"     &&lines.length>0&&"点击 ✕ 删除线条，或按 Delete 键"}
        {tool==="hline"    &&"点击图表添加水平线（向右自动延伸）"}
        {tool==="trendline"&&"点击两点画趋势线（向右延伸1年）"}
      </span>
      {lines.length>0&&(
        <div style={{width:"100%",display:"flex",flexWrap:"wrap",gap:4,marginTop:2}}>
          {lines.map(l=>(
            <div key={l.id} style={{
              display:"flex",alignItems:"center",gap:6,
              padding:"2px 8px",borderRadius:4,
              background:BORDER+"44",border:`1px solid ${BORDER}`,
              fontSize:11,fontFamily:"monospace",color:TEXT,
            }}>
              <div style={{width:12,height:2,background:l.color,borderRadius:1}}/>
              <span>{l.type==="hline"?"水平":"趋势"}{l.type==="hline"?" "+fmt(l.price,3):""}</span>
              <button onClick={()=>onDeleteLine(l.id)} style={{
                background:"none",border:"none",cursor:"pointer",
                color:MUTED,fontSize:12,padding:"0 2px",
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── K线图 ────────────────────────────────────────────────────────
function KlineChart({ bars, tool, onAddLine, lines }) {
  const containerRef  = useRef();
  const chartRef      = useRef();
  const candleRef     = useRef();
  const lineSeriesMap = useRef({});
  const pendingPoint  = useRef(null);
  const [pendingMsg, setPendingMsg] = useState(false);

  // 初始化图表
  useEffect(()=>{
    if(!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width:  containerRef.current.offsetWidth,
      height: 500,
      layout: {background:{color:CARD}, textColor:TEXT},
      grid:   {vertLines:{color:BORDER}, horzLines:{color:BORDER}},
      rightPriceScale: {borderColor:BORDER},
      timeScale: {borderColor:BORDER, timeVisible:true},
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:BLUE, downColor:RED,
      borderUpColor:BLUE, borderDownColor:RED,
      wickUpColor:BLUE,   wickDownColor:RED,
    });
    chartRef.current  = chart;
    candleRef.current = candle;
    const ro = new ResizeObserver(()=>{
      if(containerRef.current)
        chart.applyOptions({width:containerRef.current.offsetWidth});
    });
    ro.observe(containerRef.current);
    return ()=>{ chart.remove(); ro.disconnect(); };
  },[]);

  // 数据更新
  useEffect(()=>{
    if(!candleRef.current||!bars.length) return;
    candleRef.current.setData(bars.map(b=>({
      time:b.date, open:b.open, high:b.high, low:b.low, close:b.close,
    })));
    chartRef.current.timeScale().fitContent();
  },[bars]);

  // 线条同步
  useEffect(()=>{
    if(!chartRef.current||!bars.length) return;
    const chart   = chartRef.current;
    const existing = new Set(Object.keys(lineSeriesMap.current));

    lines.forEach(l=>{
      if(lineSeriesMap.current[l.id]) { existing.delete(l.id); return; }

      if(l.type==="hline") {
        const s = chart.addSeries(LineSeries, {
          color:l.color, lineWidth:1, lineStyle:LineStyle.Dashed,
          priceLineVisible:false, lastValueVisible:true,
          crosshairMarkerVisible:false,
        });
        // 水平线从第一根K线延伸到1年后
        const firstTime = typeof bars[0].date==="number"
          ? bars[0].date
          : new Date(bars[0].date).getTime()/1000;
        const farTime = firstTime + 365*24*3600;
        s.setData([
          {time: firstTime, value: l.price},
          {time: farTime,   value: l.price},
        ]);
        lineSeriesMap.current[l.id] = s;

      } else if(l.type==="trendline"&&l.p1&&l.p2) {
        const s = chart.addSeries(LineSeries, {
          color:l.color, lineWidth:1.5, lineStyle:LineStyle.Solid,
          priceLineVisible:false, lastValueVisible:false,
          crosshairMarkerVisible:false,
        });
        // 把时间统一转成数字
        const t1 = typeof l.p1.time==="number" ? l.p1.time : new Date(l.p1.time).getTime()/1000;
        const t2 = typeof l.p2.time==="number" ? l.p2.time : new Date(l.p2.time).getTime()/1000;
        const slope    = (t2-t1) !== 0 ? (l.p2.price-l.p1.price)/(t2-t1) : 0;
        const farTime  = t2 + 365*24*3600; // 1年后
        const farPrice = l.p2.price + slope*(farTime-t2);
        s.setData([
          {time: t1,       value: l.p1.price},
          {time: t2,       value: l.p2.price},
          {time: farTime,  value: farPrice},
        ]);
        lineSeriesMap.current[l.id] = s;
      }
      existing.delete(l.id);
    });

    existing.forEach(id=>{
      chart.removeSeries(lineSeriesMap.current[id]);
      delete lineSeriesMap.current[id];
    });
  },[lines, bars]);

  // 点击事件
  useEffect(()=>{
    if(!chartRef.current) return;
    const chart   = chartRef.current;
    const handler = param=>{
      if(!param.point||!param.time) return;
      const price = candleRef.current.coordinateToPrice(param.point.y);
      if(price==null) return;
      if(tool==="hline") {
        onAddLine({type:"hline", price, color:BLUE});
      } else if(tool==="trendline") {
        if(!pendingPoint.current) {
          pendingPoint.current = {time:param.time, price};
          setPendingMsg(true);
        } else {
          const p1 = pendingPoint.current;
          const p2 = {time:param.time, price};
          const [a,b] = p1.time<=p2.time ? [p1,p2] : [p2,p1];
          onAddLine({type:"trendline", p1:a, p2:b, color:"#7c3aed"});
          pendingPoint.current = null;
          setPendingMsg(false);
        }
      }
    };
    chart.subscribeClick(handler);
    return ()=>chart.unsubscribeClick(handler);
  },[tool, onAddLine]);

  return (
    <div style={{position:"relative"}}>
      <div ref={containerRef} style={{width:"100%"}}/>
      {pendingMsg&&(
        <div style={{
          position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",
          background:"#7c3aed22",border:"1px solid #7c3aed",borderRadius:6,
          padding:"3px 14px",fontSize:12,color:"#7c3aed",
          fontFamily:"monospace",pointerEvents:"none",
        }}>第一点已选定，请点击第二点完成趋势线</div>
      )}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function ETFKline({ etf }) {
  const [periodId, setPeriodId] = useState("1d");
  const [bars,     setBars]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [tool,     setTool]     = useState("none");
  const [lines,    setLines]    = useState([]);
  const lineIdRef = useRef(0);

  const periodCfg = PERIODS.find(p=>p.id===periodId) || PERIODS[4];

  useEffect(()=>{
    if(!etf) return;
    let cancelled = false;
    const code = fullCode(etf.code);
    Promise.resolve().then(()=>{ setLoading(true); setBars([]); setLines([]); });
    getKline(code, periodCfg.period, periodCfg.count)
      .then(raw=>{
        if(cancelled) return;
        let normalized = raw.map(b=>{
          const isIntraday = periodCfg.intraday;
          return {
            date:  isIntraday ? b.t : new Date(b.t*1000).toISOString().slice(0,10),
            open:  b.o, high:b.h, low:b.l, close:b.c, vol:b.v, ts:b.t,
          };
        });
        if(periodCfg.weekly) normalized = toWeekly(normalized);
        setBars(normalized);
        setLoading(false);
      })
      .catch(e=>{ console.error("[ETFKline]",e); if(!cancelled) setLoading(false); });
    return ()=>{ cancelled=true; };
  },[etf, periodId, periodCfg.period, periodCfg.count, periodCfg.weekly, periodCfg.intraday]);

  const handleAddLine = useCallback(ld=>{
    const id = String(++lineIdRef.current);
    setLines(prev=>[...prev,{...ld,id}]);
    setTool("none");
  },[]);

  const handleDeleteLine = useCallback(id=>{
    setLines(prev=>prev.filter(l=>l.id!==id));
  },[]);

  useEffect(()=>{
    const onKey = e=>{ if(e.key==="Delete") setLines(prev=>prev.slice(0,-1)); };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
  },[]);

  if(!etf) return (
    <div style={{padding:60,textAlign:"center",color:MUTED,fontSize:15}}>未选择ETF</div>
  );

  const todayBar = bars[bars.length-1];
  const up = (todayBar?.close??0) >= (todayBar?.open??0);

  return (
    <div style={{
      padding:"24px 28px",display:"flex",flexDirection:"column",gap:16,
      background:"#f0f4ff",minHeight:"100vh",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* Header */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
        padding:"18px 24px",display:"flex",alignItems:"center",
        justifyContent:"space-between",flexWrap:"wrap",gap:16,
        boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <div>
          <div style={{fontSize:12,color:MUTED,marginBottom:6,letterSpacing:1}}>
            {fullCode(etf.code)} · {etf.name}
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:14}}>
            <span style={{fontSize:30,fontWeight:900,fontFamily:"monospace",
              color:up?BLUE:RED}}>
              {fmt(todayBar?.close??etf.price??0,3)}
            </span>
            {todayBar&&(
              <span style={{fontSize:16,fontFamily:"monospace",color:up?BLUE:RED}}>
                {pct((todayBar.close-todayBar.open)/todayBar.open*100)}
              </span>
            )}
          </div>
          {todayBar&&(
            <div style={{display:"flex",gap:20,marginTop:8}}>
              {[
                {label:"开盘",  val:fmt(todayBar.open,3)},
                {label:"最高",  val:fmt(todayBar.high,3), color:BLUE},
                {label:"最低",  val:fmt(todayBar.low,3),  color:RED},
                {label:"成交量",val:`${(todayBar.vol/10000).toFixed(0)}万`},
              ].map(item=>(
                <div key={item.label}>
                  <div style={{fontSize:11,color:MUTED,marginBottom:2}}>{item.label}</div>
                  <div style={{fontSize:13,fontFamily:"monospace",fontWeight:700,
                    color:item.color||TEXT}}>{item.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 周期选择 */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {PERIODS.map(p=>(
            <button key={p.id} onClick={()=>setPeriodId(p.id)} style={{
              padding:"7px 14px",borderRadius:8,cursor:"pointer",
              fontFamily:"monospace",fontSize:12,fontWeight:600,
              background:periodId===p.id?BLUE:"transparent",
              border:`1.5px solid ${periodId===p.id?BLUE:BORDER}`,
              color:periodId===p.id?"#fff":"#64748b",
              transition:"all 0.15s",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* 画线工具栏 */}
      <Toolbar
        tool={tool} setTool={setTool}
        lines={lines}
        onDeleteLine={handleDeleteLine}
        onClearLines={()=>setLines([])}
      />

      {/* K线图 */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
        padding:"16px 20px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
          <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>
            {periodCfg.label} K线
          </span>
          {tool!=="none"&&(
            <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,
              background:BLUE+"22",color:BLUE,fontWeight:600}}>
              {tool==="hline"?"水平线模式":"趋势线模式"}
            </span>
          )}
          <span style={{fontSize:11,color:MUTED,marginLeft:"auto"}}>
            滚轮缩放 · 拖拽平移
          </span>
        </div>
        {loading ? (
          <div style={{height:500,display:"flex",alignItems:"center",
            justifyContent:"center",color:MUTED,fontSize:14}}>
            加载K线数据...
          </div>
        ) : bars.length>0 ? (
          <KlineChart
            bars={bars} tool={tool}
            onAddLine={handleAddLine} lines={lines}
          />
        ) : (
          <div style={{height:500,display:"flex",alignItems:"center",
            justifyContent:"center",color:MUTED,fontSize:14}}>
            暂无K线数据
          </div>
        )}
      </div>
    </div>
  );
}
