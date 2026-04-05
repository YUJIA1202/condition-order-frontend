// src/pages/ETFKline.jsx
import { useState, useRef, useEffect, useCallback } from "react";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

// ─── 生成模拟K线数据 ──────────────────────────────────────────────
function genKline(days=365, basePrice=4.0) {
  const bars = [];
  let price = basePrice;
  for(let i=0; i<days; i++) {
    const d = new Date(Date.now()-(days-i)*86400000);
    const isWeekend = d.getDay()===0||d.getDay()===6;
    if(isWeekend) continue;
    const open  = price;
    const range = price * 0.04;
    const high  = open + Math.random()*range;
    const low   = open - Math.random()*range;
    const close = low + Math.random()*(high-low);
    price = close;
    const vol = Math.floor(Math.random()*8000000+1000000);
    bars.push({
      date:  d.toISOString().slice(0,10),
      month: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      week:  `W${String(Math.ceil(d.getDate()/7)).padStart(2,"0")}`,
      open:  parseFloat(open.toFixed(3)),
      high:  parseFloat(high.toFixed(3)),
      low:   parseFloat(low.toFixed(3)),
      close: parseFloat(close.toFixed(3)),
      vol,
      change: ((close-open)/open)*100,
    });
  }
  return bars;
}

// ─── 聚合K线 ─────────────────────────────────────────────────────
function aggregateBars(bars, groupKey) {
  const map = {};
  bars.forEach(b => {
    const key = b[groupKey];
    if(!map[key]) map[key] = {
      date:key, open:b.open, high:b.high, low:b.low,
      close:b.close, vol:0,
    };
    map[key].high  = Math.max(map[key].high, b.high);
    map[key].low   = Math.min(map[key].low,  b.low);
    map[key].close = b.close;
    map[key].vol  += b.vol;
  });
  return Object.values(map).map(b=>({
    ...b,
    change:((b.close-b.open)/b.open)*100,
  }));
}

// ─── MA计算 ───────────────────────────────────────────────────────
function calcMA(bars, period) {
  return bars.map((b,i) => {
    if(i < period-1) return null;
    const avg = bars.slice(i-period+1,i+1).reduce((s,x)=>s+x.close,0)/period;
    return parseFloat(avg.toFixed(3));
  });
}

// ─── K线画布 ─────────────────────────────────────────────────────
function KlineCanvas({ bars, t, height=480 }) {
  const canvasRef = useRef();
  const [tooltip, setTooltip] = useState(null);
  const [viewRange, setViewRange] = useState({ start:0, count:80 });
  const viewRef = useRef({ start:0, count:80 });
  const isDragging = useRef(false);
  const dragStart  = useRef(0);
  const dragViewStart = useRef(0);

  const getView = useCallback(()=>{
    const { start, count } = viewRef.current;
    const s = clamp(start, 0, Math.max(0, bars.length-count));
    const c = clamp(count, 10, bars.length);
    return { start:s, count:c, bars: bars.slice(s, s+c) };
  },[bars]);

  const draw = useCallback((hoverIdx=-1)=>{
    const canvas=canvasRef.current; if(!canvas||!bars.length) return;
    const dpr=window.devicePixelRatio||1;
    const W=canvas.offsetWidth, H=canvas.offsetHeight;
    canvas.width=W*dpr; canvas.height=H*dpr;
    const ctx=canvas.getContext("2d"); ctx.scale(dpr,dpr);
    ctx.fillStyle=t.card; ctx.fillRect(0,0,W,H);

    const { bars:vBars, start } = getView();
    if(!vBars.length) return;

    const kPad={l:64,r:16,t:16,b:120}; // bottom留给成交量
    const vPad={l:64,r:16,t:H-100,b:16};
    const kH=H-kPad.t-kPad.b;
    const vH=80;
    const cW=W-kPad.l-kPad.r;

    // MA
    const slicedBars = bars.slice(start, start+vBars.length);
    const allBars    = bars;
    const ma5  = calcMA(allBars,5).slice(start,  start+vBars.length);
    const ma10 = calcMA(allBars,10).slice(start, start+vBars.length);
    const ma20 = calcMA(allBars,20).slice(start, start+vBars.length);

    const highs  = vBars.map(b=>b.high);
    const lows   = vBars.map(b=>b.low);
    const maxP   = Math.max(...highs)*1.002;
    const minP   = Math.min(...lows)*0.998;
    const pRange = maxP-minP||0.01;
    const maxVol = Math.max(...vBars.map(b=>b.vol))||1;

    const toY  = p => kPad.t + ((maxP-p)/pRange)*kH;
    const toVY = v => vPad.t + (1-v/maxVol)*vH;
    const toX  = i => kPad.l + (i+0.5)*(cW/vBars.length);
    const bw   = Math.max(1, cW/vBars.length*0.6);

    // Grid
    ctx.strokeStyle=t.border; ctx.lineWidth=0.5;
    for(let g=0;g<=5;g++){
      const p=minP+(g/5)*pRange;
      const y=toY(p);
      ctx.beginPath(); ctx.moveTo(kPad.l,y); ctx.lineTo(kPad.l+cW,y); ctx.stroke();
      ctx.fillStyle=t.muted; ctx.font="14px monospace"; ctx.textAlign="right";
      ctx.fillText(fmt(p,3),kPad.l-4,y+3);
    }
    // Volume area separator
    ctx.strokeStyle=t.border; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(kPad.l,vPad.t); ctx.lineTo(kPad.l+cW,vPad.t); ctx.stroke();

    // Date labels
    const step=Math.ceil(vBars.length/8);
    vBars.forEach((b,i)=>{
      if(i%step===0){
        ctx.fillStyle=t.muted; ctx.font="9px monospace"; ctx.textAlign="center";
        ctx.fillText(b.date.slice(5),toX(i),H-4);
      }
    });

    // MA lines
    const maLines=[
      {data:ma5,  color:"#f0a500",label:"MA5"},
      {data:ma10, color:"#9b59b6",label:"MA10"},
      {data:ma20, color:"#2ecc71",label:"MA20"},
    ];
    maLines.forEach(ml=>{
      ctx.beginPath(); let started=false;
      ml.data.forEach((v,i)=>{
        if(v===null) return;
        const x=toX(i), y=toY(v);
        if(!started){ ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
      });
      ctx.strokeStyle=ml.color; ctx.lineWidth=1; ctx.stroke();
    });

    // K线
    vBars.forEach((b,i)=>{
      const up = b.close >= b.open;
      const color = up ? t.pos : t.neg;
      const x=toX(i);
      const openY =toY(b.open);
      const closeY=toY(b.close);
      const highY =toY(b.high);
      const lowY  =toY(b.low);
      // Wick
      ctx.strokeStyle=color; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,highY); ctx.lineTo(x,lowY); ctx.stroke();
      // Body
      const bodyTop=Math.min(openY,closeY);
      const bodyH=Math.max(Math.abs(closeY-openY),1);
      if(i===hoverIdx){
        ctx.fillStyle=color;
      } else {
        ctx.fillStyle=up?color:color;
      }
      ctx.fillStyle=i===hoverIdx?color:color+"cc";
      ctx.fillRect(x-bw/2, bodyTop, bw, bodyH);
      // Volume bar
      const vy=toVY(b.vol);
      ctx.fillStyle=color+"99";
      ctx.fillRect(x-bw/2, vy, bw, vPad.t-vy);
    });

    // Crosshair
    if(hoverIdx>=0&&hoverIdx<vBars.length){
      const x=toX(hoverIdx);
      ctx.save(); ctx.strokeStyle=t.muted+"77"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(x,kPad.t); ctx.lineTo(x,vPad.t+vH); ctx.stroke();
      ctx.restore();
      // Price label on y axis
      const b=vBars[hoverIdx];
      const cy=toY(b.close);
      ctx.fillStyle=b.close>=b.open?t.pos:t.neg;
      ctx.fillRect(0,cy-9,kPad.l-2,18);
      ctx.fillStyle="#fff"; ctx.font="14px monospace"; ctx.textAlign="right";
      ctx.fillText(fmt(b.close,3),kPad.l-6,cy+3);
    }

    // MA legend
    const legendX=kPad.l+8;
    maLines.forEach((ml,i)=>{
      ctx.fillStyle=ml.color;
      ctx.fillRect(legendX+i*70,kPad.t+4,12,2);
      const hv=hoverIdx>=0&&ml.data[hoverIdx]!==null?fmt(ml.data[hoverIdx],3):"--";
      ctx.fillStyle=ml.color; ctx.font="14px monospace"; ctx.textAlign="left";
      ctx.fillText(`${ml.label}:${hv}`,legendX+i*70+16,kPad.t+10);
    });

  },[bars,t,getView]);

  useEffect(()=>{
    viewRef.current={start:Math.max(0,bars.length-80),count:80};
    setViewRange({start:Math.max(0,bars.length-80),count:80});
    draw();
  },[bars,draw]);

  useEffect(()=>{
    const ro=new ResizeObserver(()=>draw());
    if(canvasRef.current) ro.observe(canvasRef.current);
    return ()=>ro.disconnect();
  },[draw]);

  const onWheel=useCallback(e=>{
    e.preventDefault();
    const { start, count } = viewRef.current;
    const delta = e.deltaY>0 ? 5 : -5;
    const newCount = clamp(count+delta, 10, bars.length);
    const newStart = clamp(start, 0, Math.max(0,bars.length-newCount));
    viewRef.current={start:newStart,count:newCount};
    setViewRange({start:newStart,count:newCount});
    draw();
  },[bars,draw]);

  const onMouseDown=useCallback(e=>{
    isDragging.current=true;
    dragStart.current=e.clientX;
    dragViewStart.current=viewRef.current.start;
  },[]);

  const onMouseMove=useCallback(e=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const { bars:vBars, count } = getView();
    const cW=canvas.offsetWidth-80;
    const barW=cW/count;

    if(isDragging.current){
      const dx=e.clientX-dragStart.current;
      const shift=Math.round(-dx/barW);
      const newStart=clamp(dragViewStart.current+shift,0,Math.max(0,bars.length-count));
      viewRef.current={...viewRef.current,start:newStart};
      setViewRange(v=>({...v,start:newStart}));
      draw(-1);
      return;
    }

    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left-64;
    const idx=clamp(Math.floor(x/barW),0,vBars.length-1);
    draw(idx);
    const b=vBars[idx];
    if(b) setTooltip({
      ...b,
      x:e.clientX-rect.left,
      y:e.clientY-rect.top,
    });
  },[draw,bars,getView]);

  const onMouseUp=useCallback(()=>{ isDragging.current=false; },[]);
  const onMouseLeave=useCallback(()=>{ isDragging.current=false; draw(-1); setTooltip(null); },[draw]);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    canvas.addEventListener("wheel",onWheel,{passive:false});
    return ()=>canvas.removeEventListener("wheel",onWheel);
  },[onWheel]);

  return (
    <div style={{position:"relative",width:"100%",height}}>
      <canvas ref={canvasRef}
        style={{display:"block",width:"100%",height:"100%",cursor:isDragging.current?"grabbing":"crosshair"}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}/>
      {tooltip&&(
        <div style={{position:"absolute",
          left:clamp(tooltip.x+14,0,300),top:clamp(tooltip.y-120,0,height-160),
          background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,
          padding:"12px 16px",fontSize:13,fontFamily:"monospace",
          pointerEvents:"none",zIndex:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
          <div style={{color:t.muted,marginBottom:8,fontSize:12}}>{tooltip.date}</div>
          <div style={{display:"grid",gridTemplateColumns:"auto auto",gap:"3px 16px"}}>
            {[
              {label:"开盘",val:fmt(tooltip.open,3)},
              {label:"收盘",val:fmt(tooltip.close,3),color:tooltip.change>=0?t.pos:t.neg},
              {label:"最高",val:fmt(tooltip.high,3),color:t.pos},
              {label:"最低",val:fmt(tooltip.low,3), color:t.neg},
              {label:"涨跌",val:pct(tooltip.change),color:tooltip.change>=0?t.pos:t.neg},
              {label:"成交量",val:(tooltip.vol/10000).toFixed(0)+"万"},
            ].map(item=>(
              <div key={item.label} style={{display:"contents"}}>
                <span style={{color:t.muted}}>{item.label}</span>
                <span style={{fontWeight:700,color:item.color||t.text}}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{position:"absolute",bottom:90,right:20,fontSize:11,
        color:t.muted,fontFamily:"monospace"}}>
        滚轮缩放 · 拖拽平移
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function ETFKline({ etf, t }) {
  const [period, setPeriod] = useState("day");

  const allBars = etf
    ? genKline(365, etf.price)
    : genKline(365, 4.0);

  const bars = period==="day"   ? allBars
             : period==="week"  ? aggregateBars(allBars,"week")
             : period==="month" ? aggregateBars(allBars,"month")
             : allBars;

  if(!etf) return (
    <div style={{padding:40,textAlign:"center",color:t.muted,fontSize:15}}>
      未选择ETF
    </div>
  );

  const todayBar = bars[bars.length-1];
  const up = todayBar?.change>=0;

  return (
    <div style={{padding:"24px",display:"flex",flexDirection:"column",gap:20}}>

      {/* Header */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:"20px 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontSize:13,color:t.muted,marginBottom:6}}>{etf.code} · {etf.name}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:14}}>
            <span style={{fontSize:32,fontWeight:800,fontFamily:"monospace",
              color:up?t.pos:t.neg}}>{fmt(todayBar?.close??etf.price,3)}</span>
            <span style={{fontSize:18,fontFamily:"monospace",
              color:up?t.pos:t.neg}}>{pct(todayBar?.change??0)}</span>
          </div>
          <div style={{display:"flex",gap:20,marginTop:10}}>
            {[
              {label:"开盘",val:fmt(todayBar?.open??0,3)},
              {label:"最高",val:fmt(todayBar?.high??0,3),color:t.pos},
              {label:"最低",val:fmt(todayBar?.low??0,3), color:t.neg},
              {label:"成交量",val:`${((todayBar?.vol??0)/10000).toFixed(0)}万`},
            ].map(item=>(
              <div key={item.label}>
                <div style={{fontSize:11,color:t.muted,marginBottom:2}}>{item.label}</div>
                <div style={{fontSize:15,fontFamily:"monospace",fontWeight:700,
                  color:item.color||t.text}}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
        {/* 周期切换 */}
        <div style={{display:"flex",gap:4}}>
          {[{id:"day",label:"日K"},{id:"week",label:"周K"},{id:"month",label:"月K"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
              padding:"8px 18px",borderRadius:8,cursor:"pointer",
              fontFamily:"monospace",fontSize:14,fontWeight:600,
              background:period===p.id?t.accent:"transparent",
              border:`1px solid ${period===p.id?t.accent:t.border}`,
              color:period===p.id?"#fff":t.sub,
              transition:"all 0.15s",
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* K线图 */}
      <div style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:12,padding:"16px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,color:t.muted,letterSpacing:2}}>K线图</div>
          <div style={{display:"flex",gap:16,fontSize:12,fontFamily:"monospace"}}>
            {[
              {color:"#f0a500",label:"MA5"},
              {color:"#9b59b6",label:"MA10"},
              {color:"#2ecc71",label:"MA20"},
            ].map(l=>(
              <div key={l.label} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:16,height:2,background:l.color}}/>
                <span style={{color:t.muted}}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <KlineCanvas bars={bars} t={t} height={520}/>
      </div>
    </div>
  );
}