// src/pages/ETFDetail.jsx
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const NOW = Date.now();
function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

function genHistory(days=365) {
  const result = [];
  let portfolio=100, shanghai=100, hs300=100;
  const totalCost = 5000*3.921 + 3000*1.842 + 2000*1.205;
  for(let i=0; i<days; i++) {
    portfolio *= (1+(Math.random()-0.47)*0.015);
    shanghai  *= (1+(Math.random()-0.48)*0.010);
    hs300     *= (1+(Math.random()-0.475)*0.011);
    const d = new Date(Date.now()-(days-i)*86400000);
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

const HISTORY = genHistory(365);

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

// ─── 收益图表 ─────────────────────────────────────────────────────
function ReturnChart({ data, mode, showField, t, height=300 }) {
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
      ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="right";
      ctx.fillText(lbl,pad.l-6,y+3);
    }
    const zy=toY(0);
    ctx.save(); ctx.strokeStyle=t.muted+"88"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,zy); ctx.lineTo(pad.l+cW,zy); ctx.stroke();
    ctx.restore();
    const step=Math.ceil(data.length/8);
    data.forEach((d,i)=>{
      if(i%step===0){
        ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="center";
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
      const lv=pts[pts.length-1]?.v??0;
      const fc=lv>=0?t.pos:t.neg;
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

// ─── 对比图 ───────────────────────────────────────────────────────
function CompareChart({ history, t, height=280 }) {
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
    const pad={l:56,r:16,t:12,b:32};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const p0=history[0];
    const series=[
      {key:"portfolio",color:t.accent,w:2,dash:[]},
      {key:"shanghai", color:t.text,  w:1.5,dash:[5,4]},
      {key:"hs300",    color:t.warn,  w:1.5,dash:[5,4]},
    ];
    const allP=history.flatMap(d=>series.map(s=>((d[s.key]-p0[s.key])/p0[s.key])*100));
    const minV=Math.min(...allP), maxV=Math.max(...allP), range=maxV-minV||1;
    const toY=v=>pad.t+((maxV-v)/range)*cH;
    const toX=i=>pad.l+(i/(history.length-1||1))*cW;

    ctx.strokeStyle=t.border; ctx.lineWidth=0.5;
    for(let g=0;g<=4;g++){
      const y=pad.t+(g/4)*cH;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
      ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="right";
      ctx.fillText(pct(maxV-(g/4)*range,1),pad.l-4,y+3);
    }
    if(minV<0&&maxV>0){
      const zy=toY(0);
      ctx.save(); ctx.strokeStyle=t.muted+"88"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pad.l,zy); ctx.lineTo(pad.l+cW,zy); ctx.stroke();
      ctx.restore();
    }
    const step=Math.ceil(history.length/7);
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
    const d=history[idx], p0=history[0];
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
          left:clamp(tooltip.x+14,0,300),top:clamp(tooltip.y-80,0,height-120),
          background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,
          padding:"12px 16px",fontSize:13,fontFamily:"monospace",
          pointerEvents:"none",zIndex:10}}>
          <div style={{color:t.muted,marginBottom:6,fontSize:12}}>{tooltip.date}</div>
          <div style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:4}}>
            <span style={{color:t.accent}}>我的ETF</span>
            <span style={{color:t.accent,fontWeight:700}}>{pct(tooltip.portfolio)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:4}}>
            <span style={{color:t.sub}}>上证指数</span>
            <span style={{color:t.text,fontWeight:700}}>{pct(tooltip.shanghai)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:4}}>
            <span style={{color:t.warn}}>沪深300</span>
            <span style={{color:t.warn,fontWeight:700}}>{pct(tooltip.hs300)}</span>
          </div>
          <div style={{borderTop:`1px solid ${t.border}`,paddingTop:6,marginTop:4,
            display:"flex",justifyContent:"space-between",gap:20}}>
            <span style={{color:t.muted,fontSize:12}}>跑赢上证</span>
            <span style={{fontWeight:700,fontSize:13,
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
export default function ETFDetail({ etf, t }) {
  const [chartMode,  setChartMode]  = useState("line");
  const [showField,  setShowField]  = useState("pct");
  const [period,     setPeriod]     = useState("day");
  const [rangeIdx,   setRangeIdx]   = useState(1);

  const ranges = [
    {label:"1月",days:30},{label:"3月",days:90},
    {label:"6月",days:180},{label:"1年",days:365},
  ];

  const visibleHistory = useMemo(()=>HISTORY.slice(-ranges[rangeIdx].days),[rangeIdx]);

  const periodData = useMemo(()=>{
    if(period==="day")   return visibleHistory;
    if(period==="week")  return aggregate(visibleHistory,"week");
    if(period==="month") return aggregate(visibleHistory,"month");
    return aggregate(HISTORY,"year");
  },[period,visibleHistory]);

  if(!etf) return (
    <div style={{padding:40,textAlign:"center",color:t.muted,fontSize:15}}>
      未选择ETF
    </div>
  );

  const totalPnl = (etf.price-etf.cost)*etf.qty;
  const totalPct = ((etf.price-etf.cost)/etf.cost)*100;
  const days = Math.max(1, Math.round((NOW - new Date(etf.buyDate)) / 86400000));
  const dayPnl   = totalPnl/days;
  const weekPnl  = totalPnl/(days/7);
  const monthPnl = totalPnl/(days/30);

  return (
    <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:20}}>

      {/* Header */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:"20px 24px"}}>
        <div style={{fontSize:13,color:t.muted,marginBottom:6,letterSpacing:1}}>
          {etf.code} · {etf.name}
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:16,marginBottom:16}}>
          <span style={{fontSize:36,fontWeight:800,fontFamily:"monospace",
            color:totalPnl>=0?t.pos:t.neg}}>
            {totalPnl>=0?"+":""}¥{fmt(totalPnl)}
          </span>
          <span style={{fontSize:20,fontFamily:"monospace",
            color:totalPnl>=0?t.pos:t.neg}}>{pct(totalPct)}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:16}}>
          {[
            {label:"持仓量",  val:`${etf.qty.toLocaleString()}股`},
            {label:"成本价",  val:`¥${fmt(etf.cost,3)}`},
            {label:"现价",    val:`¥${fmt(etf.price,3)}`},
            {label:"持有天数",val:`${days}天`},
            {label:"日均盈亏",val:`${dayPnl>=0?"+":""}¥${fmt(dayPnl)}`},
            {label:"周均盈亏",val:`${weekPnl>=0?"+":""}¥${fmt(weekPnl)}`},
            {label:"月均盈亏",val:`${monthPnl>=0?"+":""}¥${fmt(monthPnl)}`},
          ].map(item=>(
            <div key={item.label}>
              <div style={{fontSize:11,color:t.muted,marginBottom:4}}>{item.label}</div>
              <div style={{fontSize:15,fontFamily:"monospace",fontWeight:700,color:t.text}}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 收益图表 */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:"20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:13,color:t.muted,letterSpacing:2}}>收益走势</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",gap:3}}>
              {ranges.map((r,i)=>(
                <button key={r.label} onClick={()=>setRangeIdx(i)} style={{
                  padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",
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
                  padding:"5px 14px",borderRadius:6,
                  border:`1px solid ${period===p.id?t.accent:t.border}`,
                  background:"transparent",cursor:"pointer",
                  fontFamily:"monospace",fontSize:13,
                  color:period===p.id?t.accent:t.sub,
                }}>{p.label}</button>
              ))}
            </div>
            <div style={{width:1,height:16,background:t.border}}/>
            <button onClick={()=>setShowField(f=>f==="pnl"?"pct":"pnl")} style={{
              padding:"5px 14px",borderRadius:6,border:`1px solid ${t.border}`,
              background:"transparent",color:t.sub,cursor:"pointer",
              fontFamily:"monospace",fontSize:13,
            }}>{showField==="pnl"?"显示%":"显示¥"}</button>
            <button onClick={()=>setChartMode(m=>m==="line"?"bar":"line")} style={{
              padding:"5px 14px",borderRadius:6,border:`1px solid ${t.border}`,
              background:"transparent",color:t.sub,cursor:"pointer",
              fontFamily:"monospace",fontSize:13,
            }}>{chartMode==="line"?"📊 柱状图":"📈 折线图"}</button>
          </div>
        </div>
        <ReturnChart data={periodData} mode={chartMode} showField={showField} t={t} height={300}/>
      </div>

      {/* 同期对比 */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:"20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:13,color:t.muted,letterSpacing:2}}>同期与指数对比</div>
          <div style={{display:"flex",gap:20}}>
            {[{color:t.accent,label:"我的ETF"},
              {color:t.text,label:"上证指数",dash:true},
              {color:t.warn,label:"沪深300",dash:true}].map(l=>(
              <div key={l.label} style={{display:"flex",alignItems:"center",gap:6}}>
                <svg width={20} height={10}>
                  <line x1="0" y1="5" x2="20" y2="5" stroke={l.color}
                    strokeWidth="2" strokeDasharray={l.dash?"4,3":"none"}/>
                </svg>
                <span style={{fontSize:13,color:t.sub}}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <CompareChart history={visibleHistory} t={t} height={280}/>
      </div>
    </div>
  );
}