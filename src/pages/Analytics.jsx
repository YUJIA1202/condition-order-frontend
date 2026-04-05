// src/pages/Analytics.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { getPositions } from "../api/index";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
const NOW = Date.now();

function genHistory(days=365, totalCost=10000) {
  const result = [];
  let portfolio=100, shanghai=100, hs300=100;
  for(let i=0; i<days; i++) {
    portfolio *= (1+(Math.random()-0.47)*0.015);
    shanghai  *= (1+(Math.random()-0.48)*0.010);
    hs300     *= (1+(Math.random()-0.475)*0.011);
    const d = new Date(NOW-(days-i)*86400000);
    const dailyPct = (Math.random()-0.47)*1.5;
    result.push({
      date:  d.toISOString().slice(0,10),
      month: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      week:  `${d.getFullYear()}-W${String(Math.ceil(d.getDate()/7)).padStart(2,"0")}`,
      year:  String(d.getFullYear()),
      portfolio, shanghai, hs300,
      dailyPnl: (dailyPct/100)*totalCost,
      dailyPct,
    });
  }
  return result;
}

function aggregate(history, groupKey) {
  const map = {};
  history.forEach(d => {
    const key = d[groupKey];
    if(!map[key]) map[key] = {
      date:key, pnl:0, pct:0,
      portfolioStart:d.portfolio, portfolioEnd:d.portfolio,
      shanghaiStart:d.shanghai,   shanghaiEnd:d.shanghai,
      hs300Start:d.hs300,         hs300End:d.hs300,
    };
    map[key].pnl += d.dailyPnl;
    map[key].pct += d.dailyPct;
    map[key].portfolioEnd = d.portfolio;
    map[key].shanghaiEnd  = d.shanghai;
    map[key].hs300End     = d.hs300;
  });
  return Object.values(map);
}

function ReturnChart({ data, mode, showField, t, height=260 }) {
  const canvasRef = useRef();
  const [tooltip, setTooltip] = useState(null);

  const draw = useCallback((hoverIdx=-1) => {
    const canvas=canvasRef.current; if(!canvas||!data.length) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth, H=canvas.offsetHeight;
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    ctx.fillStyle=t.card; ctx.fillRect(0,0,W,H);
    const pad={l:68,r:16,t:16,b:32};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const vals=data.map(d=>showField==="pnl"?(d.pnl||d.dailyPnl):(d.pct||d.dailyPct));
    const maxV=Math.max(...vals.map(Math.abs))*1.2||1;
    const minV=-maxV, range=maxV-minV;
    const toY=v=>pad.t+((maxV-v)/range)*cH;
    const toX=i=>pad.l+(i/(data.length-1||1))*cW;

    ctx.strokeStyle=t.border; ctx.lineWidth=0.5;
    for(let g=0;g<=4;g++){
      const y=pad.t+(g/4)*cH;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
      const lbl=showField==="pnl"?`¥${fmt(maxV-(g/4)*range,0)}`:pct(maxV-(g/4)*range,1);
      ctx.fillStyle=t.muted; ctx.font="12px monospace"; ctx.textAlign="right";
      ctx.fillText(lbl,pad.l-6,y+3);
    }
    const zy=toY(0);
    ctx.save(); ctx.strokeStyle=t.muted+"88"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,zy); ctx.lineTo(pad.l+cW,zy); ctx.stroke();
    ctx.restore();
    const step=Math.ceil(data.length/8);
    data.forEach((d,i)=>{
      if(i%step===0){
        ctx.fillStyle=t.muted; ctx.font="12px monospace"; ctx.textAlign="center";
        ctx.fillText(d.date.slice(5),toX(i),H-6);
      }
    });
    if(mode==="bar"){
      const bw=Math.max(2,cW/data.length*0.7);
      data.forEach((d,i)=>{
        const v=showField==="pnl"?(d.pnl||d.dailyPnl):(d.pct||d.dailyPct);
        const color=v>=0?t.pos:t.neg;
        ctx.fillStyle=i===hoverIdx?color:color+"bb";
        ctx.fillRect(toX(i)-bw/2,Math.min(zy,toY(v)),bw,Math.abs(toY(v)-zy)||1);
      });
    } else {
      const pts=data.map((d,i)=>({
        x:toX(i),
        y:toY(showField==="pnl"?(d.pnl||d.dailyPnl):(d.pct||d.dailyPct)),
        v:showField==="pnl"?(d.pnl||d.dailyPnl):(d.pct||d.dailyPct),
      }));
      const fc=t.accent;
      const grd=ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
      grd.addColorStop(0,fc+"44"); grd.addColorStop(1,fc+"04");
      ctx.beginPath();
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.lineTo(pts[pts.length-1].x,zy); ctx.lineTo(pts[0].x,zy); ctx.closePath();
      ctx.fillStyle=grd; ctx.fill();
      ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.strokeStyle=fc; ctx.lineWidth=2; ctx.stroke();
      if(hoverIdx>=0&&hoverIdx<pts.length){
        const p=pts[hoverIdx];
        ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2);
        ctx.fillStyle=fc; ctx.fill();
        ctx.strokeStyle=t.card; ctx.lineWidth=2; ctx.stroke();
      }
    }
    if(hoverIdx>=0){
      const x=toX(hoverIdx);
      ctx.save(); ctx.strokeStyle=t.muted+"66"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x,pad.t); ctx.lineTo(x,pad.t+cH); ctx.stroke();
      ctx.restore();
    }
  },[data,mode,showField,t]);

  useEffect(()=>{draw();},[draw]);
  useEffect(()=>{
    const ro=new ResizeObserver(()=>draw());
    if(canvasRef.current) ro.observe(canvasRef.current);
    return ()=>ro.disconnect();
  },[draw]);

  const onMouseMove=useCallback(e=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left-68;
    const idx=clamp(Math.round((x/(canvas.offsetWidth-84))*(data.length-1)),0,data.length-1);
    draw(idx);
    const d=data[idx];
    const v=showField==="pnl"?(d.pnl||d.dailyPnl):(d.pct||d.dailyPct);
    setTooltip({date:d.date,v,x:e.clientX-rect.left,y:e.clientY-rect.top});
  },[draw,data,showField]);

  const onMouseLeave=useCallback(()=>{draw(-1);setTooltip(null);},[draw]);

  return (
    <div style={{position:"relative",width:"100%",height}}>
      <canvas ref={canvasRef}
        style={{display:"block",width:"100%",height:"100%",cursor:"crosshair"}}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}/>
      {tooltip&&(
        <div style={{position:"absolute",
          left:clamp(tooltip.x+14,0,260),top:clamp(tooltip.y-50,0,height-70),
          background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,
          padding:"8px 12px",fontSize:13,fontFamily:"monospace",
          pointerEvents:"none",zIndex:10}}>
          <div style={{color:t.muted,marginBottom:3}}>{tooltip.date}</div>
          <div style={{color:tooltip.v>=0?t.pos:t.neg,fontWeight:700}}>
            {showField==="pnl"?`${tooltip.v>=0?"+":""}¥${fmt(tooltip.v)}`:pct(tooltip.v)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage({ t, onETFDetail, onETFKline }) {
  const [positions, setPositions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState("day");
  const [chartMode, setChartMode] = useState("line");
  const [showField, setShowField] = useState("pnl");
  const [rangeIdx,  setRangeIdx]  = useState(1);

  useEffect(()=>{
    getPositions().then(data=>{
      // 直接用全部持仓，不过滤，个股ETF都显示
      setPositions(data.map(p=>({ ...p, buyDate: p.buyDate || "2024-01-01" })));
      setLoading(false);
    }).catch(e=>{
      console.error(e);
      setLoading(false);
    });
  },[]);

  const ranges=[
    {label:"1月",days:30},{label:"3月",days:90},
    {label:"6月",days:180},{label:"1年",days:365},
  ];

  const totalCost = positions.reduce((s,p)=>s+p.qty*p.cost, 0);
  const totalVal  = positions.reduce((s,p)=>s+p.qty*p.price, 0);
  const totalPnl  = totalVal - totalCost;
  const totalPct  = totalCost > 0 ? (totalPnl/totalCost)*100 : 0;

  // 收益走势用真实持仓总成本生成（走势本身仍是模拟，因为没有历史成交数据）
  const HISTORY = useMemo(()=>genHistory(365, totalCost||10000),[totalCost]);
  const visibleHistory = useMemo(()=>HISTORY.slice(-ranges[rangeIdx].days),[rangeIdx,HISTORY]);
  const periodData = useMemo(()=>{
    if(period==="day")   return visibleHistory;
    if(period==="week")  return aggregate(visibleHistory,"week");
    if(period==="month") return aggregate(visibleHistory,"month");
    return aggregate(visibleHistory,"year");
  },[period,visibleHistory]);

  const lastH  = visibleHistory[visibleHistory.length-1];
  const firstH = visibleHistory[0];
  const portfolioPct = firstH ? ((lastH.portfolio-firstH.portfolio)/firstH.portfolio)*100 : 0;
  const shanghaiPct  = firstH ? ((lastH.shanghai-firstH.shanghai)/firstH.shanghai)*100 : 0;
  const hs300Pct     = firstH ? ((lastH.hs300-firstH.hs300)/firstH.hs300)*100 : 0;
  const colors = [t.pos, t.accent, t.warn, "#a78bfa", "#34d399"];

  if(loading) return (
    <div style={{padding:40,textAlign:"center",color:t.muted,fontSize:15}}>
      加载持仓数据...
    </div>
  );

  return (
    <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:20}}>

      {/* KPI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        {[
          {label:"总盈亏",     val:`¥${fmt(totalPnl)}`,            color:totalPnl>=0?t.pos:t.neg},
          {label:"总收益率",   val:pct(totalPct),                   color:totalPct>=0?t.pos:t.neg},
          {label:"跑赢上证",   val:pct(portfolioPct-shanghaiPct),   color:(portfolioPct-shanghaiPct)>=0?t.pos:t.neg},
          {label:"跑赢沪深300",val:pct(portfolioPct-hs300Pct),     color:(portfolioPct-hs300Pct)>=0?t.pos:t.neg},
          {label:"持仓数量",   val:`${positions.length}只`,         color:t.accent},
        ].map(item=>(
          <div key={item.label} style={{background:t.card,border:`1px solid ${t.border}`,
            borderRadius:12,padding:"18px 20px"}}>
            <div style={{fontSize:12,color:t.muted,letterSpacing:1,marginBottom:8}}>{item.label}</div>
            <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:item.color}}>
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {/* 持仓列表 */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${t.border}`,
          fontSize:13,color:t.muted,letterSpacing:2}}>
          持仓明细 · 共{positions.length}只
        </div>
        {positions.length===0 ? (
          <div style={{padding:32,textAlign:"center",color:t.muted,fontSize:14}}>
            暂无持仓数据
          </div>
        ) : positions.map((pos, i) => {
          const pnl  = (pos.price - pos.cost) * pos.qty;
          const pp   = ((pos.price - pos.cost) / pos.cost) * 100;
          const mv   = pos.qty * pos.price;
          const w    = totalVal > 0 ? (mv/totalVal)*100 : 0;
          const days = Math.max(1, Math.round((NOW - new Date(pos.buyDate)) / 86400000));
          return (
            <div key={pos.code} style={{
              padding:"16px 20px", borderBottom:`1px solid ${t.border}`,
              display:"flex", alignItems:"center", gap:16,
            }}>
              <div style={{width:10,height:10,borderRadius:2,
                background:colors[i%5],flexShrink:0}}/>
              <div style={{width:110}}>
                <div style={{fontSize:15,fontWeight:700,
                  fontFamily:"monospace",color:t.accent}}>{pos.code}</div>
                <div style={{fontSize:13,color:t.muted,marginTop:2}}>{pos.name}</div>
              </div>
              <div style={{flex:1,display:"grid",
                gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {[
                  {label:"总盈亏",  val:`${pnl>=0?"+":""}¥${fmt(pnl)}`,        color:pnl>=0?t.pos:t.neg},
                  {label:"收益率",  val:pct(pp),                                color:pp>=0?t.pos:t.neg},
                  {label:"日均盈亏",val:`${pnl/days>=0?"+":""}¥${fmt(pnl/days)}`,color:pnl>=0?t.pos:t.neg},
                  {label:"仓位占比",val:`${fmt(w)}%`,                           color:t.muted},
                ].map(item=>(
                  <div key={item.label}>
                    <div style={{fontSize:12,color:t.muted,marginBottom:4}}>{item.label}</div>
                    <div style={{fontSize:15,fontFamily:"monospace",
                      fontWeight:700,color:item.color}}>{item.val}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>onETFDetail(pos)} style={{
                  padding:"7px 16px",borderRadius:7,cursor:"pointer",
                  fontFamily:"monospace",fontSize:13,fontWeight:600,
                  background:t.accent,border:"none",color:"#fff",
                }}>收益详情</button>
                <button onClick={()=>onETFKline(pos)} style={{
                  padding:"7px 16px",borderRadius:7,cursor:"pointer",
                  fontFamily:"monospace",fontSize:13,fontWeight:600,
                  background:"transparent",
                  border:`1px solid ${t.border}`,color:t.sub,
                }}>K线图</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 组合收益图表 */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:13,color:t.muted,letterSpacing:2}}>
            组合收益走势
            <span style={{fontSize:11,color:t.muted+"66",marginLeft:8}}>
              （历史走势为模拟，盈亏数据为真实）
            </span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:3}}>
              {ranges.map((r,i)=>(
                <button key={r.label} onClick={()=>setRangeIdx(i)} style={{
                  padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",
                  fontFamily:"monospace",fontSize:13,
                  background:rangeIdx===i?t.accent:"transparent",
                  color:rangeIdx===i?"#fff":t.sub,
                }}>{r.label}</button>
              ))}
            </div>
            <div style={{width:1,height:16,background:t.border}}/>
            <div style={{display:"flex",gap:3}}>
              {[{id:"day",label:"日"},{id:"week",label:"周"},
                {id:"month",label:"月"},{id:"year",label:"年"}].map(p=>(
                <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
                  padding:"4px 12px",borderRadius:6,
                  border:`1px solid ${period===p.id?t.accent:t.border}`,
                  background:"transparent",cursor:"pointer",
                  fontFamily:"monospace",fontSize:13,
                  color:period===p.id?t.accent:t.sub,
                }}>{p.label}</button>
              ))}
            </div>
            <div style={{width:1,height:16,background:t.border}}/>
            <button onClick={()=>setShowField(f=>f==="pnl"?"pct":"pnl")} style={{
              padding:"4px 12px",borderRadius:6,border:`1px solid ${t.border}`,
              background:"transparent",color:t.sub,cursor:"pointer",
              fontFamily:"monospace",fontSize:13,
            }}>{showField==="pnl"?"显示%":"显示¥"}</button>
            <button onClick={()=>setChartMode(m=>m==="line"?"bar":"line")} style={{
              padding:"4px 12px",borderRadius:6,border:`1px solid ${t.border}`,
              background:"transparent",color:t.sub,cursor:"pointer",
              fontFamily:"monospace",fontSize:13,
            }}>{chartMode==="line"?"📊 柱状图":"📈 折线图"}</button>
          </div>
        </div>
        <ReturnChart data={periodData} mode={chartMode}
          showField={showField} t={t} height={320}/>
      </div>
    </div>
  );
}