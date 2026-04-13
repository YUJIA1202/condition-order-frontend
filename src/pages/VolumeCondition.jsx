// src/pages/VolumeCondition.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import * as echarts from "echarts";

const API    = "http://localhost:8000";
const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const SURF   = "#f8fafc";
const TEXT   = "#0f172a";
const AMBER  = "#d97706";
const GREEN  = "#16a34a";

function fmt(n,d=3){ return Number(n).toFixed(d); }
function pct(v,d=2){ return (v>=0?"+":"")+Number(v).toFixed(d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

const inp = {
  padding:"9px 12px",borderRadius:8,fontSize:13,
  fontFamily:"monospace",background:SURF,
  border:`1.5px solid ${BORDER}`,color:TEXT,outline:"none",
  transition:"border-color 0.15s",
};

// ─── ECharts K线图 ────────────────────────────────────────────────
function MiniKline({ code }) {
  const ref    = useRef();
  const [period, setPeriod] = useState("1d");

  useEffect(()=>{
    if(!code||!ref.current) return;
    let cancelled=false;
    const chart=echarts.init(ref.current);
    chart.showLoading({text:"",maskColor:"rgba(255,255,255,0.6)"});

    fetch(`${API}/kline?code=${encodeURIComponent(code)}&period=${period}&count=60`)
      .then(r=>r.json())
      .then(bars=>{
        if(cancelled) return;
        chart.hideLoading();
        if(!bars?.length) return;
        const dates=bars.map(b=>{ const d=new Date(b.t*1000); return period==="1d"?`${d.getMonth()+1}/${d.getDate()}`:`${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; });
        const ohlc=bars.map(b=>[b.o,b.c,b.l,b.h]);
        const vols=bars.map(b=>b.v);
        chart.setOption({
          backgroundColor:CARD,
          tooltip:{trigger:"axis",axisPointer:{type:"cross"},
            backgroundColor:CARD,borderColor:BORDER,
            textStyle:{color:TEXT,fontSize:11,fontFamily:"monospace"},
            formatter(params){
              const k=params.find(p=>p.seriesName==="K线"); if(!k) return "";
              const [o,c,l,h]=k.value; const up=c>=o;
              return `<div style="font-size:11px;font-family:monospace">
                <div style="color:${MUTED};margin-bottom:3px">${k.axisValue}</div>
                <div>开 <b>${fmt(o,3)}</b> 高 <b style="color:${up?BLUE:RED}">${fmt(h,3)}</b></div>
                <div>低 <b style="color:${up?BLUE:RED}">${fmt(l,3)}</b> 收 <b style="color:${up?BLUE:RED}">${fmt(c,3)}</b></div>
              </div>`;
            },
          },
          grid:[{left:50,right:8,top:8,bottom:72},{left:50,right:8,top:"72%",bottom:24}],
          xAxis:[
            {type:"category",data:dates,gridIndex:0,axisLine:{lineStyle:{color:BORDER}},axisLabel:{show:false},splitLine:{show:false}},
            {type:"category",data:dates,gridIndex:1,axisLine:{lineStyle:{color:BORDER}},axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace"},splitLine:{show:false}},
          ],
          yAxis:[
            {scale:true,gridIndex:0,axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace",formatter:v=>fmt(v,3)},splitLine:{lineStyle:{color:BORDER,type:"dashed"}}},
            {scale:true,gridIndex:1,axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace"},splitLine:{show:false}},
          ],
          series:[
            {name:"K线",type:"candlestick",xAxisIndex:0,yAxisIndex:0,data:ohlc,
              itemStyle:{color:BLUE,color0:RED,borderColor:BLUE,borderColor0:RED}},
            {name:"成交量",type:"bar",xAxisIndex:1,yAxisIndex:1,data:vols,
              itemStyle:{color:params=>bars[params.dataIndex].c>=bars[params.dataIndex].o?BLUE+"99":RED+"99"}},
          ],
        });
      })
      .catch(()=>{ if(!cancelled) chart.hideLoading(); });

    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ cancelled=true; chart.dispose(); ro.disconnect(); };
  },[code,period]);

  return (
    <div style={{marginTop:12,background:SURF,borderRadius:10,overflow:"hidden",border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"6px 10px",borderBottom:`1px solid ${BORDER}`,background:CARD}}>
        <span style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:1}}>K线图</span>
        <div style={{display:"flex",gap:3}}>
          {["1m","5m","15m","30m","1d"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{
              padding:"2px 8px",borderRadius:4,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
              background:period===p?BLUE:"transparent",color:period===p?"#fff":MUTED,transition:"all 0.15s",
            }}>{p}</button>
          ))}
        </div>
      </div>
      <div ref={ref} style={{height:200,width:"100%"}}/>
    </div>
  );
}

// ─── 分时行情 ────────────────────────────────────────────────────
function MiniTick({ tick }) {
  if(!tick) return (
    <div style={{height:60,display:"flex",alignItems:"center",
      justifyContent:"center",color:MUTED,fontSize:12}}>暂无行情</div>
  );
  const dev=tick.vwap>0?((tick.price-tick.vwap)/tick.vwap*100).toFixed(2):0;
  const devNum=parseFloat(dev);
  const up=tick.change>=0;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8,padding:"10px 0"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:10}}>
        <span style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:up?BLUE:RED}}>
          {fmt(tick.price,3)}
        </span>
        <span style={{
          fontSize:13,fontFamily:"monospace",fontWeight:700,
          color:up?BLUE:RED,background:up?"#eff6ff":"#fff5f5",
          padding:"2px 8px",borderRadius:6,border:`1px solid ${up?"#bfdbfe":"#fecaca"}`,
        }}>{pct(tick.change)}</span>
      </div>
      <div style={{display:"flex",gap:14}}>
        {[
          {label:"均价线",val:fmt(tick.vwap,3),color:TEXT},
          {label:"价格偏离",val:`${devNum>=0?"+":""}${dev}%`,color:devNum>0?BLUE:devNum<0?RED:MUTED},
          {label:"量比",val:`${tick.vol_ratio}x`,color:tick.vol_ratio>=1.5?GREEN:TEXT},
        ].map(item=>(
          <div key={item.label}>
            <div style={{fontSize:10,color:MUTED,marginBottom:2,fontWeight:600}}>{item.label}</div>
            <div style={{fontSize:13,fontFamily:"monospace",fontWeight:700,color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 滑块 ────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step, unit }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:MUTED,fontWeight:600}}>{label}</span>
        <span style={{fontSize:13,fontFamily:"monospace",fontWeight:800,color:BLUE,
          background:"#eff6ff",padding:"2px 8px",borderRadius:6}}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:"100%",accentColor:BLUE,cursor:"pointer"}}/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:MUTED}}>{min}{unit}</span>
        <span style={{fontSize:10,color:MUTED}}>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── 搜索框 ───────────────────────────────────────────────────────
function StockSearch({ onSelect }) {
  const [q,   setQ]   = useState("");
  const [res, setRes] = useState([]);
  const [ld,  setLd]  = useState(false);
  const [op,  setOp]  = useState(false);
  const wrapRef  = useRef(null);
  const timerRef = useRef(null);

  useEffect(()=>{
    const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOp(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const search=useCallback((val)=>{
    if(!val.trim()){ setRes([]); setOp(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current=setTimeout(async()=>{
      setLd(true);
      try{
        const r=await fetch(`${API}/search-stock?q=${encodeURIComponent(val)}`);
        const d=await r.json();
        setRes(d); setOp(true);
      }catch(e){ console.error(e); }
      finally{ setLd(false); }
    },300);
  },[]);

  const handleSelect=item=>{
    setQ(`${item.code.split(".")[0]}  ${item.name}`);
    setOp(false); onSelect(item);
  };

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <input value={q}
        onChange={e=>{setQ(e.target.value);search(e.target.value);}}
        onFocus={()=>res.length>0&&setOp(true)}
        placeholder="搜索股票或ETF代码/名称..."
        style={{...inp,width:"100%",boxSizing:"border-box",paddingRight:32}}
        onFocusCapture={e=>e.target.style.borderColor=BLUE}
        onBlurCapture={e=>e.target.style.borderColor=BORDER}/>
      {ld&&<span style={{position:"absolute",right:10,top:"50%",
        transform:"translateY(-50%)",fontSize:12,color:MUTED}}>…</span>}
      {op&&res.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:10,zIndex:200,
          maxHeight:240,overflowY:"auto",boxShadow:"0 8px 24px rgba(29,78,216,0.12)"}}>
          {res.map(item=>(
            <div key={item.code} onClick={()=>handleSelect(item)} style={{
              padding:"8px 14px",cursor:"pointer",fontSize:13,
              fontFamily:"monospace",color:TEXT,borderBottom:`1px solid ${BORDER}`,
              transition:"background 0.1s",
            }}
              onMouseEnter={e=>e.currentTarget.style.background=SURF}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{color:BLUE,marginRight:10,fontWeight:700}}>{item.code.split(".")[0]}</span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 状态标签 ────────────────────────────────────────────────────
function StatusTag({ status }) {
  const cfg={
    active:   {label:"监控中",bg:"#eff6ff",color:BLUE,border:"#bfdbfe"},
    triggered:{label:"已触发",bg:"#f0fdf4",color:GREEN,border:"#86efac"},
    cancelled:{label:"已取消",bg:SURF,     color:MUTED,border:BORDER},
  };
  const c=cfg[status]||cfg.active;
  return (
    <span style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,
      background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>
      {c.label}
    </span>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function VolumeConditionPage({ stockTicks, volumeTriggered }) {
  const [leftPct,       setLeftPct]       = useState(38);
  const [expandedKline, setExpandedKline] = useState(null);
  const isDragging          = useRef(false);
  const containerRef        = useRef(null);
  const prevVolumeTriggered = useRef([]);
  const [previewTick,   setPreviewTick]   = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [action,        setAction]        = useState("buy");
  const [op,            setOp]            = useState("lte");
  const [triggerPrice,  setTriggerPrice]  = useState("");
  const [qty,           setQty]           = useState("");
  const [volThr,        setVolThr]        = useState(1.5);
  const [vwapThr,       setVwapThr]       = useState(1.5);
  const [conditions,    setConditions]    = useState([]);
  const [logs,          setLogs]          = useState([]);
useEffect(()=>{
  if(!selectedStock){
    const t = setTimeout(()=>setPreviewTick(null), 0);
    return ()=>clearTimeout(t);
  }
  fetch(`${API}/stock-tick?code=${encodeURIComponent(selectedStock.code)}`)
    .then(r=>r.json()).then(setPreviewTick).catch(()=>setPreviewTick(null));
},[selectedStock]);
  useEffect(()=>{
    fetch(`${API}/volume-conditions`).then(r=>r.json()).then(setConditions).catch(console.error);
  },[]);

  useEffect(()=>{
    if(!volumeTriggered?.length) return;
    const newEvents=volumeTriggered.filter(
      e=>!prevVolumeTriggered.current.find(p=>p.id===e.id&&p.trigger_time===e.trigger_time)
    );
    prevVolumeTriggered.current=volumeTriggered;
    if(!newEvents.length) return;
    setConditions(prev=>prev.map(c=>{
      const ev=newEvents.find(e=>e.id===c.id);
      return ev?{...c,status:ev.status,cancel_reason:ev.cancel_reason,
        trigger_time:ev.trigger_time,order_result:ev.order_result}:c;
    }));
    setLogs(prev=>[...newEvents,...prev].slice(0,100));
  },[volumeTriggered]);

  const currentTick=(selectedStock&&stockTicks?.[selectedStock.code])
    ?stockTicks[selectedStock.code]:previewTick;

  const onDividerMouseDown=useCallback(e=>{
    e.preventDefault(); isDragging.current=true;
    const onMove=e=>{
      if(!isDragging.current||!containerRef.current) return;
      const rect=containerRef.current.getBoundingClientRect();
      setLeftPct(clamp(((e.clientX-rect.left)/rect.width)*100,25,65));
    };
    const onUp=()=>{ isDragging.current=false; };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp,{once:true});
    return ()=>window.removeEventListener("mousemove",onMove);
  },[]);

  const handleAdd=async()=>{
    if(!selectedStock) return alert("请先搜索并选择股票");
    if(!triggerPrice||isNaN(triggerPrice)||parseFloat(triggerPrice)<=0) return alert("请输入有效的触发价格");
    if(!qty||isNaN(qty)||parseInt(qty)<=0) return alert("请输入有效的数量");
    try{
      const res=await fetch(`${API}/volume-conditions`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({stock_code:selectedStock.code,stock_name:selectedStock.name,
          action,op,trigger_price:parseFloat(triggerPrice),qty:parseInt(qty),
          vol_ratio_threshold:volThr,vwap_dev_threshold:vwapThr}),
      });
      const data=await res.json();
      setConditions(prev=>[data,...prev]);
      setTriggerPrice(""); setQty("");
    }catch(e){ alert("添加失败："+e.message); }
  };

  const handleDelete=async cid=>{
    try{
      await fetch(`${API}/volume-conditions/${cid}`,{method:"DELETE"});
      setConditions(prev=>prev.filter(c=>c.id!==cid));
    }catch(e){ console.error(e); }
  };

  const opLabel=op==="lte"?"≤":"≥";

  return (
    <div ref={containerRef} style={{
      display:"flex",height:"calc(100vh - 52px)",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
      overflow:"hidden",background:"#f0f4ff",
    }}>

      {/* ══ 左栏 ══ */}
      <div style={{width:`${leftPct}%`,minWidth:280,
        display:"flex",flexDirection:"column",
        borderRight:`1px solid ${BORDER}`,overflowY:"auto",
        background:SURF,
      }}>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>

          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:3,height:16,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>均价量能条件单</span>
          </div>

          {/* 选择标的 */}
          <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
            padding:16,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:1}}>选择标的</div>
            <StockSearch onSelect={setSelectedStock}/>
            {selectedStock&&(
              <>
                <div style={{fontSize:12,color:MUTED,padding:"5px 10px",
                  background:SURF,borderRadius:6,fontFamily:"monospace",
                  border:`1px solid ${BORDER}`}}>
                  <span style={{color:BLUE,fontWeight:700}}>{selectedStock.code}</span> · {selectedStock.name}
                </div>
                <MiniTick tick={currentTick}/>
              </>
            )}
          </div>

          {/* 操作方向 */}
          <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
            padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:1}}>操作方向</div>
            <div style={{display:"flex",gap:8}}>
              {[
                {id:"buy", label:"买入",desc:"价格到位后验证量能再买",color:BLUE},
                {id:"sell",label:"卖出",desc:"价格到位后验证量能再卖",color:RED},
              ].map(a=>(
                <button key={a.id} onClick={()=>{setAction(a.id);setOp(a.id==="buy"?"lte":"gte");}} style={{
                  flex:1,padding:"10px 8px",borderRadius:10,cursor:"pointer",
                  fontSize:13,fontWeight:700,
                  border:`2px solid ${action===a.id?a.color:BORDER}`,
                  background:action===a.id?`${a.color}12`:"transparent",
                  color:action===a.id?a.color:"#64748b",
                  transition:"all 0.15s",
                }}>
                  {a.label}
                  <div style={{fontSize:10,fontWeight:400,marginTop:3,color:action===a.id?a.color:MUTED}}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 触发条件 */}
          <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
            padding:16,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:1}}>触发条件</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select value={op} onChange={e=>setOp(e.target.value)} style={{
                ...inp,minWidth:60,cursor:"pointer",fontWeight:700,
              }}>
                <option value="lte">≤</option>
                <option value="gte">≥</option>
              </select>
              <input type="number" step="0.001" min="0" value={triggerPrice}
                onChange={e=>setTriggerPrice(e.target.value)} placeholder="触发价格"
                style={{...inp,flex:1}}
                onFocus={e=>e.target.style.borderColor=BLUE}
                onBlur={e=>e.target.style.borderColor=BORDER}/>
            </div>
            {currentTick&&(
              <div style={{fontSize:11,color:MUTED,fontFamily:"monospace"}}>
                当前价 <span style={{color:TEXT,fontWeight:700}}>{fmt(currentTick.price,3)}</span>
                {triggerPrice&&!isNaN(triggerPrice)&&(
                  <span style={{marginLeft:8,
                    color:parseFloat(triggerPrice)<currentTick.price?RED:BLUE,fontWeight:700}}>
                    距触发 {((parseFloat(triggerPrice)-currentTick.price)/currentTick.price*100).toFixed(2)}%
                  </span>
                )}
              </div>
            )}
            <input type="number" step="100" min="100" value={qty}
              onChange={e=>setQty(e.target.value)} placeholder="数量（手）"
              style={inp}
              onFocus={e=>e.target.style.borderColor=BLUE}
              onBlur={e=>e.target.style.borderColor=BORDER}/>
          </div>

          {/* 量能参数 */}
          <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
            padding:16,display:"flex",flexDirection:"column",gap:16}}>
            <div style={{fontSize:11,color:MUTED,fontWeight:700,letterSpacing:1}}>量能过滤参数</div>
            <Slider label="量比阈值" value={volThr} onChange={setVolThr} min={0.5} max={3.0} step={0.1} unit="x"/>
            <Slider label="均价线偏离阈值" value={vwapThr} onChange={setVwapThr} min={0.5} max={3.0} step={0.1} unit="%"/>
            <div style={{background:SURF,borderRadius:8,padding:12,
              fontSize:11,color:MUTED,lineHeight:1.9,
              borderLeft:`3px solid ${BLUE}`}}>
              <div style={{color:BLUE,fontWeight:700,marginBottom:4}}>当前逻辑预览</div>
              {action==="buy"?(<>
                <div>✓ 价格 {opLabel} {triggerPrice||"?"} 时触发检查</div>
                <div style={{color:RED}}>✗ 放量({volThr}x↑) + 跌破均价线({vwapThr}%↓) → 取消买入</div>
                <div style={{color:RED}}>✗ 放量({volThr}x↑) + 价格虚高({vwapThr}%↑) → 取消买入</div>
                <div style={{color:GREEN}}>✓ 其余情况 → 正常买入</div>
              </>):(<>
                <div>✓ 价格 {opLabel} {triggerPrice||"?"} 时触发检查</div>
                <div style={{color:RED}}>✗ 放量({volThr}x↑) + 均价线走高({vwapThr}%↑) → 取消卖出</div>
                <div style={{color:RED}}>✗ 缩量({volThr}x↓) → 取消卖出</div>
                <div style={{color:GREEN}}>✓ 其余情况 → 正常卖出</div>
              </>)}
            </div>
          </div>

          <button onClick={handleAdd} style={{
            width:"100%",padding:"12px 0",borderRadius:10,
            border:"none",cursor:"pointer",fontSize:14,fontWeight:700,
            background:action==="buy"?BLUE:RED,color:"#fff",
            boxShadow:`0 2px 8px ${action==="buy"?"rgba(29,78,216,0.25)":"rgba(220,38,38,0.25)"}`,
            transition:"all 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}
          >
            + 添加{action==="buy"?"买入":"卖出"}条件单
          </button>
        </div>
      </div>

      {/* ══ 分割线 ══ */}
      <div onMouseDown={onDividerMouseDown}
        style={{width:4,cursor:"col-resize",flexShrink:0,background:"transparent",transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=BLUE+"66"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}/>

      {/* ══ 右栏 ══ */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#f0f4ff"}}>
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
              <span style={{fontSize:11,color:MUTED,letterSpacing:2,fontWeight:700}}>条件单监控</span>
              <span style={{fontSize:11,color:BLUE,fontFamily:"monospace",fontWeight:700,
                background:"#eff6ff",padding:"2px 8px",borderRadius:6}}>
                {conditions.filter(c=>c.status==="active").length} 活跃
              </span>
            </div>
          </div>

          {conditions.length===0&&(
            <div style={{textAlign:"center",padding:"60px 0",color:MUTED,fontSize:13,
              background:CARD,borderRadius:14,border:`1.5px solid ${BORDER}`}}>
              暂无条件单，在左侧添加
            </div>
          )}

          {conditions.map(cond=>{
            const tick        = stockTicks?.[cond.stock_code];
            const isActive    = cond.status==="active";
            const isTriggered = cond.status==="triggered";
            const isCancelled = cond.status==="cancelled";
            const isExpanded  = expandedKline===cond.id;
            const isBuy       = cond.action==="buy";
            return (
              <div key={cond.id} style={{
                background:CARD,
                border:`1.5px solid ${isTriggered?BLUE+"44":isCancelled?BORDER:BORDER}`,
                borderRadius:14,padding:16,
                opacity:isCancelled?0.65:1,
                boxShadow:isTriggered?"0 4px 16px rgba(29,78,216,0.1)":"0 1px 4px rgba(0,0,0,0.04)",
                transition:"all 0.2s",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14,fontWeight:800,fontFamily:"monospace",
                      color:isBuy?BLUE:RED}}>
                      {isBuy?"买↑":"卖↓"}
                    </span>
                    <span style={{fontSize:13,fontWeight:700,color:TEXT}}>
                      {cond.stock_code.split(".")[0]}
                    </span>
                    <span style={{fontSize:12,color:MUTED}}>{cond.stock_name}</span>
                    <StatusTag status={cond.status}/>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setExpandedKline(isExpanded?null:cond.id)} style={{
                      background:isExpanded?"#eff6ff":"transparent",
                      border:`1px solid ${isExpanded?BLUE:BORDER}`,
                      borderRadius:6,padding:"3px 10px",cursor:"pointer",
                      color:isExpanded?BLUE:MUTED,fontSize:11,fontWeight:600,transition:"all 0.15s",
                    }}>{isExpanded?"收起":"K线 ▾"}</button>
                    {isActive&&(
                      <button onClick={()=>handleDelete(cond.id)} style={{
                        background:"transparent",border:`1px solid ${BORDER}`,
                        borderRadius:6,padding:"3px 10px",cursor:"pointer",
                        color:MUTED,fontSize:11,fontWeight:600,transition:"all 0.15s",
                      }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=RED;e.currentTarget.style.color=RED;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.color=MUTED;}}
                      >删除</button>
                    )}
                  </div>
                </div>

                <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,fontFamily:"monospace"}}>
                  {[
                    {label:"触发价",val:`${cond.op==="lte"?"≤":"≥"} ${fmt(cond.trigger_price,3)}`,color:AMBER},
                    {label:"数量",  val:`${cond.qty.toLocaleString()}手`,color:TEXT},
                    {label:"量比阈值",val:`${cond.vol_ratio_threshold}x`,color:BLUE},
                    {label:"偏离阈值",val:`${cond.vwap_dev_threshold}%`,color:BLUE},
                  ].map(item=>(
                    <span key={item.label} style={{color:MUTED}}>
                      {item.label} <span style={{color:item.color,fontWeight:700}}>{item.val}</span>
                    </span>
                  ))}
                </div>

                {isActive&&tick&&(
                  <div style={{marginTop:10,padding:"8px 12px",background:SURF,borderRadius:8,
                    display:"flex",gap:16,fontSize:12,fontFamily:"monospace",
                    border:`1px solid ${BORDER}`}}>
                    <span style={{color:tick.change>=0?BLUE:RED,fontWeight:700}}>
                      {fmt(tick.price,3)} {pct(tick.change)}
                    </span>
                    <span style={{color:MUTED}}>均价线 <span style={{color:TEXT,fontWeight:600}}>{fmt(tick.vwap,3)}</span></span>
                    <span style={{color:MUTED}}>量比 <span style={{
                      color:tick.vol_ratio>=cond.vol_ratio_threshold?GREEN:TEXT,
                      fontWeight:tick.vol_ratio>=cond.vol_ratio_threshold?700:400,
                    }}>{tick.vol_ratio}x</span></span>
                    <span style={{color:MUTED}}>距触发 <span style={{
                      color:Math.abs((tick.price-cond.trigger_price)/cond.trigger_price)<0.005?AMBER:TEXT,
                    }}>{((tick.price-cond.trigger_price)/cond.trigger_price*100).toFixed(2)}%</span></span>
                  </div>
                )}

                {isCancelled&&cond.cancel_reason&&(
                  <div style={{marginTop:10,padding:"6px 10px",background:SURF,borderRadius:6,
                    fontSize:11,color:MUTED,fontFamily:"monospace",border:`1px solid ${BORDER}`}}>
                    ✗ {cond.cancel_reason}
                  </div>
                )}
                {isTriggered&&cond.order_result&&(
                  <div style={{marginTop:10,padding:"6px 10px",background:"#f0fdf4",borderRadius:6,
                    fontSize:11,color:GREEN,fontFamily:"monospace",border:"1px solid #86efac"}}>
                    ✓ {cond.order_result.msg}
                  </div>
                )}
                {isExpanded&&<MiniKline code={cond.stock_code}/>}
              </div>
            );
          })}
        </div>

        {/* 触发日志 */}
        <div style={{height:180,borderTop:`1px solid ${BORDER}`,
          display:"flex",flexDirection:"column",background:CARD}}>
          <div style={{padding:"8px 16px",fontSize:11,color:MUTED,
            borderBottom:`1px solid ${BORDER}`,letterSpacing:1,fontWeight:700}}>
            触发日志
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"4px 0"}}>
            {logs.length===0&&(
              <div style={{padding:"20px 16px",color:MUTED,fontSize:12,textAlign:"center"}}>暂无日志</div>
            )}
            {logs.map((log,i)=>{
              const ts=log.trigger_time?new Date(log.trigger_time*1000).toLocaleTimeString("zh-CN"):"--:--:--";
              const isCancel=log.status==="cancelled";
              return (
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,
                  padding:"5px 16px",borderBottom:`1px solid ${BORDER}22`,
                  fontSize:11,fontFamily:"monospace"}}>
                  <span style={{color:MUTED,flexShrink:0}}>{ts}</span>
                  <span style={{color:isCancel?MUTED:GREEN,flexShrink:0}}>{isCancel?"✗ 取消":"✓ 触发"}</span>
                  <span style={{color:log.action==="buy"?BLUE:RED,flexShrink:0}}>
                    {log.action==="buy"?"买":"卖"} {log.stock_code?.split(".")?.[0]}
                  </span>
                  <span style={{color:MUTED,flex:1}}>{isCancel?log.cancel_reason:log.order_result?.msg}</span>
                  {!isCancel&&<span style={{color:MUTED,flexShrink:0}}>量比 {log.vol_ratio}x</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
