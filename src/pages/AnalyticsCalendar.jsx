// src/pages/AnalyticsCalendar.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

const MOCK_ETF_POSITIONS = [
  { code:"510300", name:"沪深300ETF", qty:5000, cost:3.921, price:4.012 },
  { code:"159915", name:"创业板ETF",  qty:3000, cost:1.842, price:1.798 },
  { code:"512000", name:"券商ETF",    qty:2000, cost:1.205, price:1.231 },
];

function genHistory(days=365) {
  const result = [];
  let portfolio=100, shanghai=100, hs300=100;
  const totalCost = MOCK_ETF_POSITIONS.reduce((s,p)=>s+p.qty*p.cost,0);
  for(let i=0; i<days; i++) {
    portfolio *= (1+(Math.random()-0.47)*0.015);
    shanghai  *= (1+(Math.random()-0.48)*0.010);
    hs300     *= (1+(Math.random()-0.475)*0.011);
    const d = new Date(Date.now()-(days-i)*86400000);
    const dailyPct = (Math.random()-0.47)*1.5;
    // 每只ETF当天收益模拟
    const etfReturns = MOCK_ETF_POSITIONS.map(etf=>({
      code: etf.code,
      name: etf.name,
      pct:  (Math.random()-0.47)*2.0,
      pnl:  (Math.random()-0.47)*2.0/100 * etf.qty * etf.price,
    }));
    result.push({
      date:  d.toISOString().slice(0,10),
      month: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      portfolio, shanghai, hs300,
      dailyPnl: (dailyPct/100)*totalCost,
      dailyPct,
      etfReturns,
    });
  }
  return result;
}

const HISTORY = genHistory(365);

// ─── 当日明细弹窗 ─────────────────────────────────────────────────
function DayDetailModal({ data, showField, t, onClose }) {
  if(!data) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",
      zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",
      backdropFilter:"blur(4px)",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:t.card,border:`1px solid ${t.border}`,borderRadius:16,
        width:"min(480px,92vw)",padding:28,
        boxShadow:"0 24px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{fontSize:13,color:t.muted,marginBottom:4}}>{data.date} · 当日收益</div>
            <div style={{display:"flex",alignItems:"baseline",gap:12}}>
              <span style={{fontSize:28,fontWeight:800,fontFamily:"monospace",
                color:data.dailyPnl>=0?t.pos:t.neg}}>
                {data.dailyPnl>=0?"+":""}¥{fmt(data.dailyPnl)}
              </span>
              <span style={{fontSize:16,fontFamily:"monospace",
                color:data.dailyPct>=0?t.pos:t.neg}}>
                {pct(data.dailyPct)}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:t.surface,border:`1px solid ${t.border}`,
            borderRadius:8,padding:"6px 14px",color:t.sub,
            cursor:"pointer",fontFamily:"monospace",fontSize:14,
            alignSelf:"flex-start",
          }}>✕</button>
        </div>

        {/* 各ETF当日收益 */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:12,color:t.muted,letterSpacing:2,marginBottom:4}}>各ETF明细</div>
          {data.etfReturns.map((etf,i)=>{
            const colors=[t.pos,t.accent,t.warn];
            return (
              <div key={etf.code} style={{
                display:"flex",alignItems:"center",gap:12,
                padding:"12px 16px",borderRadius:10,
                background:t.surface,border:`1px solid ${t.border}`,
              }}>
                <div style={{width:8,height:8,borderRadius:2,
                  background:colors[i%3],flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,
                    fontFamily:"monospace",color:t.accent}}>{etf.code}</div>
                  <div style={{fontSize:12,color:t.muted}}>{etf.name}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700,fontFamily:"monospace",
                    color:etf.pnl>=0?t.pos:t.neg}}>
                    {etf.pnl>=0?"+":""}¥{fmt(etf.pnl)}
                  </div>
                  <div style={{fontSize:12,fontFamily:"monospace",
                    color:etf.pct>=0?t.pos:t.neg}}>
                    {pct(etf.pct)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 月历组件 ─────────────────────────────────────────────────────
function MonthCalendar({ year, month, historyMap, showField, t, onDayClick }) {
  const WEEKDAYS = ["一","二","三","四","五","六","日"];
  const firstDay = new Date(year, month-1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0,10);
  const monthKey = `${year}-${String(month).padStart(2,"0")}`;
  const monthData = Object.entries(historyMap)
    .filter(([d])=>d.startsWith(monthKey))
    .map(([,v])=>Math.abs(showField==="pnl"?v.dailyPnl:v.dailyPct));
  const maxAbs = Math.max(...monthData, 0.01);
  const cells = [];
  for(let i=0;i<startOffset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
        {WEEKDAYS.map((w,i)=>(
          <div key={w} style={{textAlign:"center",fontSize:12,fontWeight:600,
            padding:"4px 0",color:i>=5?t.muted+"66":t.muted}}>{w}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={`e-${i}`}/>;
          const dateStr=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const data=historyMap[dateStr];
          const isWeekend=(i%7)>=5;
          const isToday=dateStr===today;

          if(!data) return (
            <div key={dateStr} style={{
              aspectRatio:"1",borderRadius:8,
              background:isWeekend?t.surface:t.border+"33",
              display:"flex",alignItems:"center",justifyContent:"center",
              border:`1px solid ${isToday?t.accent:t.border+"33"}`,
            }}>
              <span style={{fontSize:13,color:isWeekend?t.muted+"44":t.muted+"88"}}>{day}</span>
            </div>
          );

          const v=showField==="pnl"?data.dailyPnl:data.dailyPct;
          const intensity=Math.min(Math.abs(v)/maxAbs,1);
          const color=v>=0?t.pos:t.neg;
          const hexAlpha=Math.round(intensity*180+40).toString(16).padStart(2,"0");

          return (
            <div key={dateStr} onClick={()=>onDayClick(data)}
              style={{
                aspectRatio:"1",borderRadius:8,cursor:"pointer",
                background:`${color}${hexAlpha}`,
                border:`2px solid ${isToday?t.accent:color+"44"}`,
                display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",gap:2,
                transition:"transform 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.transform="scale(1.08)";
                e.currentTarget.style.boxShadow=`0 3px 12px ${color}55`;
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.transform="scale(1)";
                e.currentTarget.style.boxShadow="none";
              }}>
              <span style={{fontSize:13,fontWeight:700,lineHeight:1,
                color:intensity>0.5?"#fff":t.text}}>{day}</span>
              <span style={{fontSize:10,fontWeight:600,lineHeight:1,
                color:intensity>0.5?"#ffffffcc":color}}>
                {showField==="pnl"
                  ?(v>=0?"+":"")+"¥"+fmt(v,0)
                  :pct(v,1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 对比折线图 ───────────────────────────────────────────────────
function CompareChart({ history, t, height=400 }) {
  const canvasRef=useRef();
  const [tooltip,setTooltip]=useState(null);
  const hoverRef=useRef(-1);

  const draw=useCallback((hoverIdx=-1)=>{
    const canvas=canvasRef.current; if(!canvas||!history.length) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth, H=canvas.offsetHeight;
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    ctx.fillStyle=t.card; ctx.fillRect(0,0,W,H);
    const pad={l:56,r:16,t:16,b:32};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const p0=history[0];
    const series=[
      {key:"portfolio",color:t.accent,w:2,   dash:[]},
      {key:"shanghai", color:t.text,  w:1.5, dash:[5,4]},
      {key:"hs300",    color:t.warn,  w:1.5, dash:[5,4]},
    ];
    const allP=history.flatMap(d=>series.map(s=>((d[s.key]-p0[s.key])/p0[s.key])*100));
    const minV=Math.min(...allP), maxV=Math.max(...allP), range=maxV-minV||1;
    const toY=v=>pad.t+((maxV-v)/range)*cH;
    const toX=i=>pad.l+(i/(history.length-1||1))*cW;

    ctx.strokeStyle=t.border; ctx.lineWidth=0.5;
    for(let g=0;g<=5;g++){
      const y=pad.t+(g/5)*cH;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
      ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="right";
      ctx.fillText(pct(maxV-(g/5)*range,1),pad.l-4,y+3);
    }
    if(minV<0&&maxV>0){
      const zy=toY(0);
      ctx.save(); ctx.strokeStyle=t.muted+"88"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pad.l,zy); ctx.lineTo(pad.l+cW,zy); ctx.stroke();
      ctx.restore();
    }
    const step=Math.ceil(history.length/8);
    history.forEach((d,i)=>{
      if(i%step===0){
        ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="center";
        ctx.fillText(d.date.slice(5),toX(i),H-6);
      }
    });
    series.forEach(s=>{
      const pts=history.map((d,i)=>({x:toX(i),y:toY(((d[s.key]-p0[s.key])/p0[s.key])*100)}));
      ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.strokeStyle=s.color; ctx.lineWidth=s.w;
      ctx.setLineDash(s.dash); ctx.stroke(); ctx.setLineDash([]);
    });
    if(hoverIdx>=0&&hoverIdx<history.length){
      const x=toX(hoverIdx);
      ctx.save(); ctx.strokeStyle=t.muted+"66"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,pad.t+cH); ctx.stroke();
      ctx.restore();
      series.forEach(s=>{
        const y=toY(((history[hoverIdx][s.key]-p0[s.key])/p0[s.key])*100);
        ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
        ctx.fillStyle=s.color; ctx.fill();
        ctx.strokeStyle=t.card; ctx.lineWidth=1.5; ctx.stroke();
      });
    }
  },[history,t]);

  useEffect(()=>{draw();},[draw]);
  useEffect(()=>{
    const ro=new ResizeObserver(()=>draw(hoverRef.current));
    if(canvasRef.current) ro.observe(canvasRef.current);
    return ()=>ro.disconnect();
  },[draw]);

  const onMouseMove=useCallback(e=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left-56;
    const idx=clamp(Math.round((x/(canvas.offsetWidth-72))*(history.length-1)),0,history.length-1);
    hoverRef.current=idx; draw(idx);
    const d=history[idx],p0=history[0];
    setTooltip({
      date:d.date,
      portfolio:((d.portfolio-p0.portfolio)/p0.portfolio)*100,
      shanghai: ((d.shanghai-p0.shanghai)/p0.shanghai)*100,
      hs300:    ((d.hs300-p0.hs300)/p0.hs300)*100,
      x:e.clientX-rect.left, y:e.clientY-rect.top,
    });
  },[draw,history]);

  const onMouseLeave=useCallback(()=>{hoverRef.current=-1;draw(-1);setTooltip(null);},[draw]);

  return (
    <div style={{position:"relative",width:"100%",height}}>
      <canvas ref={canvasRef}
        style={{display:"block",width:"100%",height:"100%",cursor:"crosshair"}}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}/>
      {tooltip&&(
        <div style={{position:"absolute",
          left:clamp(tooltip.x+14,0,300),top:clamp(tooltip.y-90,0,height-130),
          background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,
          padding:"12px 16px",fontSize:13,fontFamily:"monospace",
          pointerEvents:"none",zIndex:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
          <div style={{color:t.muted,marginBottom:8,fontSize:12}}>{tooltip.date}</div>
          {[
            {label:"我的ETF", color:t.accent,val:tooltip.portfolio},
            {label:"上证指数",color:t.text,  val:tooltip.shanghai},
            {label:"沪深300", color:t.warn,  val:tooltip.hs300},
          ].map(item=>(
            <div key={item.label} style={{display:"flex",
              justifyContent:"space-between",gap:20,marginBottom:4}}>
              <span style={{color:item.color}}>{item.label}</span>
              <span style={{color:item.color,fontWeight:700}}>{pct(item.val)}</span>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${t.border}`,paddingTop:5,marginTop:4,
            display:"flex",justifyContent:"space-between",gap:20}}>
            <span style={{color:t.muted,fontSize:12}}>跑赢上证</span>
            <span style={{fontWeight:700,
              color:(tooltip.portfolio-tooltip.shanghai)>=0?t.pos:t.neg}}>
              {pct(tooltip.portfolio-tooltip.shanghai)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function AnalyticsCalendar({ t }) {
  const now = new Date();
  const [showField,setShowField] = useState("pnl");
  const [calYear,  setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth]  = useState(now.getMonth()+1);
  const [rangeIdx, setRangeIdx]  = useState(1);
  const [showMonthPicker,setShowMonthPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const ranges=[
    {label:"1月",days:30},{label:"3月",days:90},
    {label:"6月",days:180},{label:"1年",days:365},
  ];

  const visibleHistory=useMemo(()=>HISTORY.slice(-ranges[rangeIdx].days),[rangeIdx]);

  const historyMap=useMemo(()=>{
    const map={};
    HISTORY.forEach(d=>{map[d.date]=d;});
    return map;
  },[]);

  const availableMonths=useMemo(()=>{
    const months=[...new Set(HISTORY.map(d=>d.month))].sort();
    return months.map(m=>{
      const [y,mo]=m.split("-");
      return {key:m,year:parseInt(y),month:parseInt(mo)};
    });
  },[]);

  const prevMonth=()=>{
    if(calMonth===1){setCalYear(y=>y-1);setCalMonth(12);}
    else setCalMonth(m=>m-1);
  };
  const nextMonth=()=>{
    if(calMonth===12){setCalYear(y=>y+1);setCalMonth(1);}
    else setCalMonth(m=>m+1);
  };

  return (
    <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:20}}>

      {/* 顶部控制 */}
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:14,color:t.muted,letterSpacing:2}}>日历 & 同期对比</div>
        <button onClick={()=>setShowField(f=>f==="pnl"?"pct":"pnl")} style={{
          padding:"5px 14px",borderRadius:6,border:`1px solid ${t.border}`,
          background:"transparent",color:t.sub,cursor:"pointer",
          fontFamily:"monospace",fontSize:13,
        }}>{showField==="pnl"?"显示%":"显示¥"}</button>
      </div>

      {/* 左右等高布局 */}
      <div style={{display:"grid",gridTemplateColumns:"0.85fr 1.15fr",
        gap:20,alignItems:"stretch"}}>

        {/* 左：月历 */}
        <div style={{background:t.card,border:`1px solid ${t.border}`,
          borderRadius:12,padding:20,display:"flex",flexDirection:"column"}}>

          {/* 月份导航 */}
          <div style={{display:"flex",alignItems:"center",
            justifyContent:"space-between",marginBottom:20}}>
            <button onClick={prevMonth} style={{
              background:t.surface,border:`1px solid ${t.border}`,
              borderRadius:6,padding:"6px 14px",cursor:"pointer",
              color:t.sub,fontFamily:"monospace",fontSize:16,
            }}>‹</button>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowMonthPicker(v=>!v)} style={{
                background:"transparent",border:"none",cursor:"pointer",
                fontSize:15,fontWeight:700,color:t.text,fontFamily:"monospace",
                display:"flex",alignItems:"center",gap:6,
              }}>
                {calYear}年{calMonth}月
                <span style={{fontSize:11,color:t.muted}}>▼</span>
              </button>
              {showMonthPicker&&(
                <div style={{position:"absolute",top:"calc(100% + 6px)",left:"50%",
                  transform:"translateX(-50%)",zIndex:50,
                  background:t.card,border:`1px solid ${t.border}`,
                  borderRadius:10,padding:8,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
                  maxHeight:240,overflowY:"auto",minWidth:140}}>
                  {availableMonths.map(m=>(
                    <div key={m.key} onClick={()=>{
                      setCalYear(m.year);setCalMonth(m.month);
                      setShowMonthPicker(false);
                    }} style={{
                      padding:"6px 14px",borderRadius:6,cursor:"pointer",
                      fontSize:13,fontFamily:"monospace",
                      background:calYear===m.year&&calMonth===m.month
                        ?t.accent:"transparent",
                      color:calYear===m.year&&calMonth===m.month?"#fff":t.text,
                    }}
                    onMouseEnter={e=>{if(!(calYear===m.year&&calMonth===m.month))
                      e.currentTarget.style.background=t.surface;}}
                    onMouseLeave={e=>{if(!(calYear===m.year&&calMonth===m.month))
                      e.currentTarget.style.background="transparent";}}>
                      {m.year}年{m.month}月
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={nextMonth} style={{
              background:t.surface,border:`1px solid ${t.border}`,
              borderRadius:6,padding:"6px 14px",cursor:"pointer",
              color:t.sub,fontFamily:"monospace",fontSize:16,
            }}>›</button>
          </div>

          <MonthCalendar year={calYear} month={calMonth}
            historyMap={historyMap} showField={showField}
            t={t} onDayClick={setSelectedDay}/>

          {/* 图例 */}
          <div style={{display:"flex",alignItems:"center",gap:5,
            marginTop:"auto",paddingTop:16,justifyContent:"center"}}>
            <span style={{fontSize:12,color:t.muted}}>亏损</span>
            {[0.8,0.5,0.2].map(i=>(
              <div key={i} style={{width:16,height:16,borderRadius:3,
                background:`${t.neg}${Math.round(i*180+40).toString(16).padStart(2,"0")}`}}/>
            ))}
            <div style={{width:16,height:16,borderRadius:3,background:t.border}}/>
            {[0.2,0.5,0.8].map(i=>(
              <div key={i} style={{width:16,height:16,borderRadius:3,
                background:`${t.pos}${Math.round(i*180+40).toString(16).padStart(2,"0")}`}}/>
            ))}
            <span style={{fontSize:12,color:t.muted}}>盈利</span>
          </div>
        </div>

        {/* 右：对比折线图 */}
        <div style={{background:t.card,border:`1px solid ${t.border}`,
          borderRadius:12,padding:20,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:13,color:t.muted,letterSpacing:2}}>同期对比</div>
            <div style={{display:"flex",gap:3}}>
              {ranges.map((r,i)=>(
                <button key={r.label} onClick={()=>setRangeIdx(i)} style={{
                  padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",
                  fontFamily:"monospace",fontSize:12,
                  background:rangeIdx===i?t.accent:"transparent",
                  color:rangeIdx===i?"#fff":t.sub,
                }}>{r.label}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:16,marginBottom:12}}>
            {[{color:t.accent,label:"我的ETF"},
              {color:t.text,label:"上证指数",dash:true},
              {color:t.warn,label:"沪深300",dash:true}].map(l=>(
              <div key={l.label} style={{display:"flex",alignItems:"center",gap:6}}>
                <svg width={20} height={10}>
                  <line x1="0" y1="5" x2="20" y2="5" stroke={l.color}
                    strokeWidth="2" strokeDasharray={l.dash?"4,3":"none"}/>
                </svg>
                <span style={{fontSize:12,color:t.sub}}>{l.label}</span>
              </div>
            ))}
          </div>
          {/* flex:1让图表撑满剩余高度 */}
          <div style={{flex:1}}>
  <CompareChart history={visibleHistory} t={t} height={500}/>
</div>
        </div>
      </div>

      {/* 当日明细弹窗 */}
      {selectedDay&&(
        <DayDetailModal data={selectedDay} showField={showField}
          t={t} onClose={()=>setSelectedDay(null)}/>
      )}
    </div>
  );
}