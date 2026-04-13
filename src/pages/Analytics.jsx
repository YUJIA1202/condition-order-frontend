// src/pages/Analytics.jsx
import { useState, useEffect, useRef } from "react";
import * as echarts from "echarts";
import { getPositions } from "../api/index";

const API    = "http://localhost:8000";
function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }

const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const SURF   = "#f8fafc";
const TEXT   = "#0f172a";

const dotColors = [BLUE, "#7c3aed", "#0891b2", "#d97706", "#16a34a"];

function fullCode(code) {
  if(!code||code.includes(".")) return code;
  if(code.startsWith("6")||code.startsWith("5")) return code+".SH";
  return code+".SZ";
}

// ─── 迷你折线图 ──────────────────────────────────────────────────
function SparkLine({ code }) {
  const ref = useRef();
  useEffect(()=>{
    if(!code||!ref.current) return;
    fetch(`${API}/kline/${fullCode(code)}?period=1d&count=30`)
      .then(r=>r.json())
      .then(bars=>{
        if(!bars.length||!ref.current) return;
        const chart = echarts.init(ref.current);
        const vals  = bars.map(b=>b.c);
        const isUp  = vals[vals.length-1]>=vals[0];
        const c     = isUp?BLUE:RED;
        chart.setOption({
          backgroundColor:"transparent",
          grid:{left:0,right:0,top:2,bottom:2},
          xAxis:{type:"category",show:false,data:vals.map((_,i)=>i)},
          yAxis:{type:"value",show:false,scale:true},
          series:[{data:vals,type:"line",smooth:true,symbol:"none",
            lineStyle:{color:c,width:1.5},
            areaStyle:{color:{type:"linear",x:0,y:0,x2:0,y2:1,
              colorStops:[{offset:0,color:c+"44"},{offset:1,color:c+"05"}]}}}],
          tooltip:{show:false},
        });
        const ro=new ResizeObserver(()=>chart.resize());
        ro.observe(ref.current);
        return ()=>{ chart.dispose(); ro.disconnect(); };
      }).catch(()=>{});
  },[code]);
  return <div ref={ref} style={{width:"100%",height:"100%"}}/>;
}

// ─── 仓位分布饼图 ─────────────────────────────────────────────────
function PieChart({ positions, height=200 }) {
  const ref = useRef();
  useEffect(()=>{
    if(!positions.length||!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      backgroundColor:"transparent",
      tooltip:{
        trigger:"item",
        formatter:p=>`${p.name}<br/>¥${fmt(p.value,0)} (${fmt(p.percent,1)}%)`,
      },
      series:[{
        type:"pie",radius:["45%","75%"],
        center:["50%","50%"],
        data:positions.map((p,i)=>({
          name:p.name||p.code,
          value:+(p.qty*p.price).toFixed(0),
          itemStyle:{color:dotColors[i%5]},
        })),
        label:{
          show:true,fontSize:11,
          formatter:p=>`${p.name}\n${fmt(p.percent,1)}%`,
          color:TEXT,
        },
        emphasis:{
          itemStyle:{shadowBlur:8,shadowColor:"rgba(0,0,0,0.1)"},
        },
      }],
    });
    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ chart.dispose(); ro.disconnect(); };
  },[positions]);
  return <div ref={ref} style={{width:"100%",height}}/>;
}

// ─── 持仓卡片 ────────────────────────────────────────────────────
function PositionCard({ pos, idx, totalVal, onKline, onPnl }) {
  const pnl   = (pos.price-pos.cost)*pos.qty;
  const pp    = ((pos.price-pos.cost)/pos.cost)*100;
  const mv    = pos.qty*pos.price;
  const w     = totalVal>0?(mv/totalVal)*100:0;
  const up    = pnl>=0;
  const color = dotColors[idx%5];

  return (
    <div style={{
      background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
      overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
      borderLeft:`4px solid ${color}`,
      transition:"box-shadow 0.2s",
    }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 24px rgba(29,78,216,0.12)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.04)"}
    >
      <div style={{padding:"16px 20px 12px",display:"flex",
        justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:16,fontWeight:900,fontFamily:"monospace",color:BLUE}}>
              {pos.code}
            </span>
            <span style={{fontSize:12,color:MUTED}}>{pos.name}</span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontSize:24,fontWeight:900,fontFamily:"monospace",
              color:up?BLUE:RED}}>{up?"+":""}¥{fmt(pnl)}</span>
            <span style={{fontSize:13,fontFamily:"monospace",fontWeight:700,
              color:up?BLUE:RED,background:up?"#eff6ff":"#fff5f5",
              padding:"2px 8px",borderRadius:6}}>{pct(pp)}</span>
          </div>
        </div>
        <div style={{width:120,height:50}}><SparkLine code={pos.code}/></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",
        gap:0,borderTop:`1px solid ${BORDER}`}}>
        {[
          {label:"持仓量",val:`${pos.qty.toLocaleString()}股`},
          {label:"成本价",val:`¥${fmt(pos.cost,3)}`},
          {label:"现价",  val:`¥${fmt(pos.price,3)}`,color:up?BLUE:RED},
          {label:"市值",  val:`¥${fmt(mv,0)}`},
        ].map((item,i)=>(
          <div key={item.label} style={{padding:"10px 16px",
            borderRight:i<3?`1px solid ${BORDER}`:"none",background:SURF}}>
            <div style={{fontSize:10,color:MUTED,marginBottom:3,fontWeight:600,letterSpacing:0.5}}>
              {item.label}
            </div>
            <div style={{fontSize:13,fontFamily:"monospace",fontWeight:700,
              color:item.color||TEXT}}>{item.val}</div>
          </div>
        ))}
      </div>

      <div style={{padding:"10px 20px",display:"flex",
        alignItems:"center",gap:12,borderTop:`1px solid ${BORDER}`}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",
            marginBottom:4,fontSize:11,color:MUTED}}>
            <span>仓位占比</span>
            <span style={{fontFamily:"monospace",fontWeight:700,color}}>{fmt(w)}%</span>
          </div>
          <div style={{height:5,background:BORDER,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${w}%`,background:color,
              borderRadius:3,transition:"width 0.6s"}}/>
          </div>
        </div>
        <button onClick={()=>onPnl(pos)} style={{
          padding:"7px 14px",borderRadius:8,cursor:"pointer",
          fontFamily:"monospace",fontSize:12,fontWeight:700,
          background:"transparent",border:`1.5px solid ${BORDER}`,color:"#64748b",
          transition:"all 0.15s",flexShrink:0,
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=BLUE;e.currentTarget.style.color=BLUE;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.color="#64748b";}}
        >盈亏分析</button>
        <button onClick={()=>onKline(pos)} style={{
          padding:"7px 18px",borderRadius:8,cursor:"pointer",
          fontFamily:"monospace",fontSize:12,fontWeight:700,
          background:BLUE,border:"none",color:"#fff",
          boxShadow:"0 2px 8px rgba(29,78,216,0.25)",
          transition:"all 0.15s",flexShrink:0,
        }}
          onMouseEnter={e=>e.currentTarget.style.background="#1e40af"}
          onMouseLeave={e=>e.currentTarget.style.background=BLUE}
        >K线图 →</button>
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function AnalyticsPage({ onETFKline, onETFPnl }) {
  const [positions, setPositions] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(()=>{
    getPositions()
      .then(data=>{ setPositions(data.filter(p=>p.qty>0)); setLoading(false); })
      .catch(()=>setLoading(false));
  },[]);

  const totalCost = positions.reduce((s,p)=>s+p.qty*p.cost, 0);
  const totalVal  = positions.reduce((s,p)=>s+p.qty*p.price, 0);
  const totalPnl  = totalVal-totalCost;
  const totalPct  = totalCost>0?(totalPnl/totalCost)*100:0;
  const up        = totalPnl>=0;

  if(loading) return (
    <div style={{padding:60,textAlign:"center",color:MUTED,fontSize:14}}>加载持仓数据...</div>
  );

  return (
    <div style={{
      padding:"24px 28px",display:"flex",flexDirection:"column",gap:20,
      background:"#f0f4ff",minHeight:"100vh",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* ── 总览横幅 ── */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
        padding:"20px 28px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
        borderTop:`3px solid ${up?BLUE:RED}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        flexWrap:"wrap",gap:20}}>
        <div>
          <div style={{fontSize:11,color:MUTED,letterSpacing:1.5,marginBottom:6,fontWeight:600}}>
            投资组合总览
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:14}}>
            <span style={{fontSize:32,fontWeight:900,fontFamily:"monospace",color:up?BLUE:RED}}>
              {up?"+":""}¥{fmt(totalPnl)}
            </span>
            <span style={{fontSize:18,fontFamily:"monospace",fontWeight:700,
              color:up?BLUE:RED,background:up?"#eff6ff":"#fff5f5",
              padding:"3px 12px",borderRadius:8}}>
              {pct(totalPct)}
            </span>
          </div>
          <div style={{display:"flex",gap:24,marginTop:10}}>
            {[
              {label:"总成本",val:`¥${fmt(totalCost,0)}`},
              {label:"总市值",val:`¥${fmt(totalVal,0)}`},
              {label:"持仓数",val:`${positions.length}只`},
            ].map(item=>(
              <div key={item.label}>
                <div style={{fontSize:10,color:MUTED,marginBottom:2,fontWeight:600}}>{item.label}</div>
                <div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,color:TEXT}}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 饼图 */}
        {positions.length>0&&(
          <div style={{width:260,height:180}}>
            <PieChart positions={positions} height={180}/>
          </div>
        )}
      </div>

      {/* ── 持仓明细 ── */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:3,height:16,background:BLUE,borderRadius:2}}/>
        <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>
          持仓明细 · 共{positions.length}只
        </span>
      </div>

      {positions.length===0 ? (
        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:60,textAlign:"center",color:MUTED,fontSize:14}}>暂无持仓数据</div>
      ) : (
        <div style={{display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(460px,1fr))",gap:16}}>
          {positions.map((pos,i)=>(
            <PositionCard key={pos.code} pos={pos} idx={i}
              totalVal={totalVal} onKline={onETFKline} onPnl={onETFPnl}/>
          ))}
        </div>
      )}
    </div>
  );
}
