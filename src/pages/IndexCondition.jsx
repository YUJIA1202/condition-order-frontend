// src/pages/IndexCondition.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import * as echarts from "echarts";
import { getConditions, addCondition, deleteCondition } from "../api/index";

const API    = "http://localhost:8000";
const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const SURF   = "#f8fafc";
const TEXT   = "#0f172a";
const AMBER  = "#d97706";

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function fmt(n,d=2){ return Number(n).toFixed(d); }

const INDEX_OPTIONS = [
  {code:"000001.SH",name:"上证指数"},
  {code:"399001.SZ",name:"深证成指"},
  {code:"399006.SZ",name:"创业板指"},
  {code:"688000.SH",name:"科创50"},
  {code:"899050.BJ",name:"北证50"},
];

// ─── ECharts K线图 ────────────────────────────────────────────────
function MiniKline({ code }) {
  const ref    = useRef();
  const [period, setPeriod] = useState("1d");

  useEffect(()=>{
    if(!code||!ref.current) return;
    let cancelled=false;
    const chart = echarts.init(ref.current);
    chart.showLoading({text:"",maskColor:"rgba(255,255,255,0.6)"});

    fetch(`${API}/kline?code=${encodeURIComponent(code)}&period=${period}&count=60`)
      .then(r=>r.json())
      .then(bars=>{
        if(cancelled) return;
        chart.hideLoading();
        if(!bars?.length) return;
        const dates  = bars.map(b=>{ const d=new Date(b.t*1000); return period==="1d"?`${d.getMonth()+1}/${d.getDate()}`:`${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`; });
        const ohlc   = bars.map(b=>[b.o,b.c,b.l,b.h]);
        const vols   = bars.map(b=>b.v);
        const upColor  = BLUE;
        const dnColor  = RED;

        chart.setOption({
          backgroundColor:CARD,
          tooltip:{trigger:"axis",axisPointer:{type:"cross"},
            backgroundColor:CARD,borderColor:BORDER,
            textStyle:{color:TEXT,fontSize:11,fontFamily:"monospace"},
            formatter(params){
              const k=params.find(p=>p.seriesName==="K线");
              if(!k) return "";
              const [o,c,l,h]=k.value;
              const up=c>=o;
              return `<div style="font-family:monospace;font-size:11px">
                <div style="color:${MUTED};margin-bottom:3px">${k.axisValue}</div>
                <div>开 <b style="color:${TEXT}">${fmt(o,3)}</b></div>
                <div>高 <b style="color:${up?upColor:dnColor}">${fmt(h,3)}</b></div>
                <div>低 <b style="color:${up?upColor:dnColor}">${fmt(l,3)}</b></div>
                <div>收 <b style="color:${up?upColor:dnColor}">${fmt(c,3)}</b></div>
              </div>`;
            },
          },
          grid:[
            {left:50,right:8,top:8,bottom:80},
            {left:50,right:8,top:"72%",bottom:24},
          ],
          xAxis:[
            {type:"category",data:dates,gridIndex:0,
              axisLine:{lineStyle:{color:BORDER}},
              axisLabel:{show:false},splitLine:{show:false}},
            {type:"category",data:dates,gridIndex:1,
              axisLine:{lineStyle:{color:BORDER}},
              axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace"},splitLine:{show:false}},
          ],
          yAxis:[
            {scale:true,gridIndex:0,
              axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace",formatter:v=>fmt(v,3)},
              splitLine:{lineStyle:{color:BORDER,type:"dashed"}}},
            {scale:true,gridIndex:1,
              axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace",formatter:v=>v>=1000?`${(v/1000).toFixed(0)}k`:v},
              splitLine:{show:false}},
          ],
          series:[
            {name:"K线",type:"candlestick",xAxisIndex:0,yAxisIndex:0,data:ohlc,
              itemStyle:{
                color:upColor,color0:dnColor,
                borderColor:upColor,borderColor0:dnColor,
              }},
            {name:"成交量",type:"bar",xAxisIndex:1,yAxisIndex:1,data:vols,
              itemStyle:{color:params=>bars[params.dataIndex].c>=bars[params.dataIndex].o?upColor+"99":dnColor+"99"}},
          ],
        });
      })
      .catch(()=>{ if(!cancelled) chart.hideLoading(); });

    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ cancelled=true; chart.dispose(); ro.disconnect(); };
  },[code,period]);

  return (
    <div style={{marginTop:12,background:SURF,borderRadius:10,overflow:"hidden",
      border:`1px solid ${BORDER}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"6px 10px",borderBottom:`1px solid ${BORDER}`,background:CARD}}>
        <span style={{fontSize:11,color:MUTED,fontWeight:600,letterSpacing:1}}>K线图</span>
        <div style={{display:"flex",gap:3}}>
          {["1m","5m","15m","30m","1d"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{
              padding:"2px 8px",borderRadius:4,border:"none",cursor:"pointer",
              fontSize:11,fontWeight:600,
              background:period===p?BLUE:"transparent",
              color:period===p?"#fff":MUTED,
              transition:"all 0.15s",
            }}>{p}</button>
          ))}
        </div>
      </div>
      <div ref={ref} style={{height:200,width:"100%"}}/>
    </div>
  );
}

// ─── 搜索框 ───────────────────────────────────────────────────────
function StockSearch({ onSelect, placeholder }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(()=>{
    const h=e=>{ if(wrapRef.current&&!wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const search=useCallback((q)=>{
    if(!q.trim()){ setResults([]); setOpen(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current=setTimeout(async()=>{
      setLoading(true);
      try{
        const res=await fetch(`${API}/search-stock?q=${encodeURIComponent(q)}`);
        const data=await res.json();
        setResults(data); setOpen(true);
      }catch(e){ console.error(e); }
      finally{ setLoading(false); }
    },300);
  },[]);

  const handleSelect=item=>{
    setQuery(`${item.code.split(".")[0]}  ${item.name}`);
    setOpen(false); onSelect(item);
  };

  const inp={
    width:"100%",padding:"9px 32px 9px 12px",boxSizing:"border-box",
    background:SURF,border:`1.5px solid ${BORDER}`,borderRadius:8,
    color:TEXT,fontSize:13,fontFamily:"monospace",outline:"none",
    transition:"border-color 0.15s",
  };

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <input value={query}
        onChange={e=>{setQuery(e.target.value);search(e.target.value);}}
        onFocus={()=>results.length>0&&setOpen(true)}
        onFocusCapture={e=>e.target.style.borderColor=BLUE}
        onBlurCapture={e=>e.target.style.borderColor=BORDER}
        placeholder={placeholder||"搜索代码或名称…"}
        style={inp}/>
      {loading&&<span style={{position:"absolute",right:10,top:"50%",
        transform:"translateY(-50%)",fontSize:12,color:MUTED}}>…</span>}
      {open&&results.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:CARD,border:`1.5px solid ${BORDER}`,
          borderRadius:10,zIndex:300,maxHeight:240,overflowY:"auto",
          boxShadow:"0 8px 24px rgba(29,78,216,0.12)"}}>
          {results.map(item=>(
            <div key={item.code} onClick={()=>handleSelect(item)} style={{
              padding:"8px 14px",cursor:"pointer",fontSize:13,
              fontFamily:"monospace",color:TEXT,
              borderBottom:`1px solid ${BORDER}`,transition:"background 0.1s",
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

// ─── 条件单卡片 ───────────────────────────────────────────────────
function ConditionCard({ c, expandedKline, setExpandedKline, onDelete }) {
  const isExpanded = expandedKline===c.id;
  const idxName    = INDEX_OPTIONS.find(i=>i.code===c.index_code)?.name??c.index_code;
  const etfCode    = c.etf_code??"";
  const etfName    = c.etf_name??etfCode;
  const triggered  = c.triggered;

  return (
    <div style={{
      background:CARD,
      border:`1.5px solid ${triggered?BLUE+"66":BORDER}`,
      borderRadius:12,padding:"14px 16px",
      boxShadow: triggered?"0 4px 16px rgba(29,78,216,0.1)":"0 1px 4px rgba(0,0,0,0.04)",
      transition:"all 0.2s",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <span style={{
          fontSize:12,fontWeight:700,letterSpacing:0.5,
          color:triggered?BLUE:MUTED,
          background:triggered?"#eff6ff":SURF,
          padding:"3px 10px",borderRadius:6,
          border:`1px solid ${triggered?"#bfdbfe":BORDER}`,
        }}>
          {triggered?"✓ 已触发":"● 监控中"}
        </span>
        <div style={{display:"flex",gap:6}}>
          {etfCode&&(
            <button onClick={()=>setExpandedKline(isExpanded?null:c.id)} style={{
              background:isExpanded?"#eff6ff":"transparent",
              border:`1px solid ${isExpanded?BLUE:BORDER}`,
              borderRadius:6,padding:"3px 10px",cursor:"pointer",
              color:isExpanded?BLUE:MUTED,fontSize:11,fontWeight:600,
              transition:"all 0.15s",
            }}>
              {isExpanded?"收起":"K线 ▾"}
            </button>
          )}
          <button onClick={()=>onDelete(c.id)} style={{
            background:"transparent",border:`1px solid ${BORDER}`,
            borderRadius:6,padding:"3px 10px",
            color:MUTED,cursor:"pointer",fontSize:11,fontWeight:600,
            transition:"all 0.15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=RED;e.currentTarget.style.color=RED;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.color=MUTED;}}
          >删除</button>
        </div>
      </div>

      <div style={{fontSize:15,color:TEXT,fontFamily:"monospace",fontWeight:600,marginBottom:4}}>
        {idxName}
        <span style={{color:AMBER,marginLeft:8}}>{c.op==="lte"?"≤":"≥"} {c.price}</span>
      </div>
      <div style={{fontSize:13,color:"#64748b",fontFamily:"monospace"}}>
        →{" "}
        <span style={{fontWeight:700,color:c.action==="buy"?BLUE:RED}}>
          {c.action==="buy"?"买入":"卖出"}
        </span>
        {" "}{etfName}{etfName!==etfCode&&etfCode?` (${etfCode})`:""} · {c.qty}手
      </div>
      {isExpanded&&etfCode&&<MiniKline code={etfCode}/>}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function IndexConditionPage({ indices, triggered }) {
  const [conditions,    setConditions]    = useState([]);
  const [selectedETF,   setSelectedETF]   = useState(null);
  const [expandedKline, setExpandedKline] = useState(null);
  const [form, setForm] = useState({index_code:"000001.SH",op:"lte",price:"",action:"buy",qty:""});
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef();
  const isDragging   = useRef(false);

  const inp={
    background:SURF,border:`1.5px solid ${BORDER}`,borderRadius:8,
    color:TEXT,padding:"9px 12px",fontSize:13,outline:"none",
    fontFamily:"monospace",width:"100%",boxSizing:"border-box",
    transition:"border-color 0.15s",
  };

  const onDividerMouseDown=useCallback(e=>{
    e.preventDefault(); isDragging.current=true;
  },[]);

  useEffect(()=>{
    const onMove=e=>{
      if(!isDragging.current||!containerRef.current) return;
      const rect=containerRef.current.getBoundingClientRect();
      setLeftPct(clamp((e.clientX-rect.left)/rect.width*100,25,75));
    };
    const onUp=()=>{ isDragging.current=false; };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return ()=>{ window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
  },[]);

  useEffect(()=>{ getConditions().then(setConditions).catch(console.error); },[]);
  useEffect(()=>{ if(triggered.length>0) getConditions().then(setConditions).catch(console.error); },[triggered]);

  const handleAdd=async()=>{
    if(!form.price||!form.qty) return alert("请填写触发点位和数量");
    if(!selectedETF)           return alert("请搜索并选择标的ETF/股票");
    try{
      await addCondition({...form,price:parseFloat(form.price),qty:parseInt(form.qty),
        etf_code:selectedETF.code,etf_name:selectedETF.name});
      setForm({index_code:"000001.SH",op:"lte",price:"",action:"buy",qty:""});
      setSelectedETF(null);
      getConditions().then(setConditions);
    }catch(e){ console.error(e); }
  };

  const handleDelete=async cid=>{
    await deleteCondition(cid);
    setConditions(prev=>prev.filter(c=>c.id!==cid));
  };

  const priceMap=Object.fromEntries(indices.map(i=>[i.code,i.price]));

  return (
    <div ref={containerRef} style={{
      display:"flex",padding:"20px 24px",gap:0,
      position:"relative",alignItems:"flex-start",
      background:"#f0f4ff",minHeight:"calc(100vh - 52px)",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* ══ 左栏 ══ */}
      <div style={{width:`${leftPct}%`,paddingRight:8,flexShrink:0,
        display:"flex",flexDirection:"column",gap:14}}>

        {/* 当前指数 */}
        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"14px 18px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:11,color:MUTED,letterSpacing:2,fontWeight:700}}>当前指数</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {INDEX_OPTIONS.map(idx=>(
              <div key={idx.code} style={{
                background:SURF,borderRadius:8,padding:"6px 12px",
                border:`1px solid ${BORDER}`,
              }}>
                <span style={{fontSize:11,color:MUTED,marginRight:6}}>{idx.name}</span>
                <span style={{fontSize:14,fontFamily:"monospace",fontWeight:800,color:TEXT}}>
                  {priceMap[idx.code]?Number(priceMap[idx.code]).toFixed(2):"--"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 新建条件单 */}
        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"16px 18px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:11,color:MUTED,letterSpacing:2,fontWeight:700}}>新建条件单</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:8}}>
              <div>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>触发指数</div>
                <select style={inp} value={form.index_code}
                  onChange={e=>setForm(p=>({...p,index_code:e.target.value}))}>
                  {INDEX_OPTIONS.map(i=><option key={i.code} value={i.code}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>条件</div>
                <select style={inp} value={form.op}
                  onChange={e=>setForm(p=>({...p,op:e.target.value}))}>
                  <option value="lte">≤</option>
                  <option value="gte">≥</option>
                </select>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>触发点位</div>
              <input style={inp} type="number" placeholder="输入点位..."
                value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}
                onFocus={e=>e.target.style.borderColor=BLUE}
                onBlur={e=>e.target.style.borderColor=BORDER}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>操作</div>
                <select style={inp} value={form.action}
                  onChange={e=>setForm(p=>({...p,action:e.target.value}))}>
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>数量（手）</div>
                <input style={inp} type="number" placeholder="1000"
                  value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))}
                  onFocus={e=>e.target.style.borderColor=BLUE}
                  onBlur={e=>e.target.style.borderColor=BORDER}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:MUTED,marginBottom:4,fontWeight:600}}>标的 ETF / 股票</div>
              <StockSearch placeholder="搜索代码或名称（如 510300、沪深300）"
                onSelect={item=>setSelectedETF(item)}/>
              {selectedETF&&(
                <div style={{marginTop:6,fontSize:12,color:MUTED,
                  padding:"5px 10px",background:SURF,borderRadius:6,
                  fontFamily:"monospace",display:"flex",justifyContent:"space-between",alignItems:"center",
                  border:`1px solid ${BORDER}`}}>
                  <span>
                    <span style={{color:BLUE,fontWeight:700}}>{selectedETF.code.split(".")[0]}</span>
                    {"  "}{selectedETF.name}
                  </span>
                  <span style={{cursor:"pointer",color:MUTED}}
                    onClick={()=>setSelectedETF(null)}>✕</span>
                </div>
              )}
            </div>
            <button onClick={handleAdd} style={{
              marginTop:4,padding:"10px",background:BLUE,
              border:"none",borderRadius:8,color:"#fff",
              fontSize:13,cursor:"pointer",fontWeight:700,
              boxShadow:"0 2px 8px rgba(29,78,216,0.25)",
              transition:"all 0.15s",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="#1e40af"}
              onMouseLeave={e=>e.currentTarget.style.background=BLUE}
            >＋ 添加条件单</button>
          </div>
        </div>

        {/* 条件单列表 */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {conditions.length===0
            ? <div style={{color:MUTED,fontSize:13,textAlign:"center",padding:24,
                background:CARD,borderRadius:12,border:`1.5px solid ${BORDER}`}}>暂无条件单</div>
            : conditions.map(c=>(
              <ConditionCard key={c.id} c={c}
                expandedKline={expandedKline}
                setExpandedKline={setExpandedKline}
                onDelete={handleDelete}/>
            ))
          }
        </div>
      </div>

      {/* ══ 分割线 ══ */}
      <div onMouseDown={onDividerMouseDown} style={{
        width:14,flexShrink:0,cursor:"col-resize",
        display:"flex",alignItems:"stretch",
        justifyContent:"center",alignSelf:"stretch",minHeight:400,padding:"0 4px",
      }}>
        <div style={{width:3,borderRadius:3,background:BORDER,transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=BLUE}
          onMouseLeave={e=>e.currentTarget.style.background=BORDER}/>
      </div>

      {/* ══ 右栏：触发日志 ══ */}
      <div style={{flex:1,paddingLeft:8}}>
        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"16px 18px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:11,color:MUTED,letterSpacing:2,fontWeight:700}}>触发日志</span>
          </div>
          {triggered.length===0
            ? <div style={{color:MUTED,fontSize:13,textAlign:"center",padding:"30px 0"}}>
                等待条件触发...
              </div>
            : triggered.map((item,i)=>(
              <div key={i} style={{
                fontSize:13,color:BLUE,fontFamily:"monospace",
                padding:"10px 14px",background:"#eff6ff",borderRadius:8,
                borderLeft:`3px solid ${BLUE}`,marginBottom:8,
              }}>
                {item.action==="buy"?"买入":"卖出"} {item.etf_code} {item.qty}手
                · {INDEX_OPTIONS.find(x=>x.code===item.index_code)?.name} 触及 {item.price}
                · 成交价 {Number(item.current_price).toFixed(2)}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
