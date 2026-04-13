// src/pages/Home.jsx
import { useRef, useMemo, useState, useEffect } from "react";
import { getKline } from "../api/index";


const INDEX_META = {
  "000001.SH": { name: "上证指数", short: "上证", en: "SSE COMP" },
  "399001.SZ": { name: "深证成指", short: "深证", en: "SZSE CI"  },
  "399006.SZ": { name: "创业板指", short: "创业板", en: "ChiNext" },
  "688000.SH": { name: "科创50",   short: "科创50", en: "STAR 50" },
  "899050.BJ": { name: "北证50",   short: "北证50", en: "BSE 50"  },
};

const WEIGHT_SECTORS = ["券商","银行","白酒","煤炭","钢铁","地产"];

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function round2(v)   { return Math.round(v*100)/100; }

// ─── 迷你折线 SVG ─────────────────────────────────────────────────
function MiniLine({ values, up, width=80, height=36 }) {
  if (!values?.length) return <div style={{width,height}}/>;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v,i)=>{
    const x = (i/(values.length-1))*width;
    const y = height - ((v-min)/range)*(height-4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const color = up ? "#1d4ed8" : "#dc2626";
  const fill  = up ? "#dbeafe" : "#fee2e2";
  const lastPt  = pts.split(" ").pop();
  const [lx]  = lastPt.split(",");
  const area  = `${pts} ${lx},${height} 0,${height}`;
  return (
    <svg width={width} height={height} style={{display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id={`sg-${up?1:0}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={fill} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${up?1:0})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ─── 实时时钟 ────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(()=>{
    const t = setInterval(()=>setTime(new Date()), 1000);
    return ()=>clearInterval(t);
  },[]);
  const h = String(time.getHours()).padStart(2,"0");
  const m = String(time.getMinutes()).padStart(2,"0");
  const s = String(time.getSeconds()).padStart(2,"0");
  const isTrading = time.getHours()>=9 && time.getHours()<15;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{
        width:7,height:7,borderRadius:"50%",
        background: isTrading?"#16a34a":"#94a3b8",
        boxShadow: isTrading?"0 0 0 3px #bbf7d0":"none",
        transition:"all 0.3s",
      }}/>
      <span style={{fontFamily:"'Courier New',monospace",fontSize:13,
        color:"#475569",fontWeight:600,letterSpacing:1}}>
        {h}:{m}:{s}
      </span>
      <span style={{
        fontSize:11,fontWeight:700,letterSpacing:1,
        color: isTrading?"#16a34a":"#94a3b8",
        background: isTrading?"#f0fdf4":"#f8fafc",
        border:`1px solid ${isTrading?"#86efac":"#e2e8f0"}`,
        padding:"2px 8px",borderRadius:20,
      }}>
        {isTrading?"交易中":"已收盘"}
      </span>
    </div>
  );
}

// ─── 指数卡片 ─────────────────────────────────────────────────────
function IndexCard({ data, sparkData }) {
  const meta = INDEX_META[data.code] || { name:data.code, short:data.code, en:"" };
  const up   = data.change >= 0;
  const color     = up ? "#1d4ed8" : "#dc2626";
  const bgGrad    = up
    ? "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)"
    : "linear-gradient(135deg,#fff5f5 0%,#fee2e2 100%)";
  const borderClr = up ? "#bfdbfe" : "#fecaca";

  return (
    <div style={{
      background: bgGrad,
      border:`1.5px solid ${borderClr}`,
      borderRadius:16,
      padding:"18px 20px",
      position:"relative",
      overflow:"hidden",
      cursor:"default",
      transition:"all 0.2s",
      boxShadow: up
        ? "0 4px 20px rgba(29,78,216,0.08)"
        : "0 4px 20px rgba(220,38,38,0.08)",
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=up?"0 8px 30px rgba(29,78,216,0.15)":"0 8px 30px rgba(220,38,38,0.15)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=up?"0 4px 20px rgba(29,78,216,0.08)":"0 4px 20px rgba(220,38,38,0.08)";}}
    >
      <div style={{
        position:"absolute",top:-24,right:-24,
        width:80,height:80,borderRadius:"50%",
        background:`${color}10`,pointerEvents:"none",
      }}/>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:11,color:"#64748b",fontWeight:700,letterSpacing:1.5,marginBottom:3}}>
            {meta.short}
          </div>
          <div style={{fontSize:10,color:"#94a3b8",letterSpacing:1}}>{meta.en}</div>
        </div>
        <div style={{
          fontSize:11,fontWeight:800,
          color,
          background: up?"#dbeafe":"#fee2e2",
          padding:"3px 8px",borderRadius:6,
          display:"flex",alignItems:"center",gap:3,
        }}>
          <span style={{fontSize:9}}>{up?"▲":"▼"}</span>
          {Math.abs(data.change).toFixed(2)}%
        </div>
      </div>

      <div style={{
        fontSize:28,fontWeight:900,
        fontFamily:"'Courier New',monospace",
        color:"#0f172a",letterSpacing:-1,lineHeight:1,
        marginBottom:12,
      }}>
        {fmt(data.price)}
      </div>

      {sparkData && (
        <MiniLine values={sparkData} up={up} width={140} height={32}/>
      )}
    </div>
  );
}

// ─── 半圆仪表 ────────────────────────────────────────────────────
function ArcGauge({ value, label, sub }) {
  const c = Math.max(0,Math.min(100,value));
  const color = c>60?"#16a34a":c<40?"#dc2626":"#d97706";
  const r=34,cx=44,cy=44;
  const circ=Math.PI*r;
  return (
    <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={88} height={54} viewBox="0 0 88 54">
        <path d={`M${cx-r},${cy} A${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round"/>
        <path d={`M${cx-r},${cy} A${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(c/100)*circ} ${circ}`}
          style={{transition:"stroke-dasharray 1s ease"}}/>
        <text x={cx} y={cy+2} textAnchor="middle" fill={color}
          fontSize="13" fontFamily="'Courier New',monospace" fontWeight="800">
          {Math.round(c)}
        </text>
      </svg>
      <div style={{fontSize:11,color:"#64748b",fontWeight:700,letterSpacing:0.5}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:"#94a3b8"}}>{sub}</div>}
    </div>
  );
}

// ─── 黄白线面板 ───────────────────────────────────────────────────
function YWPanel({ shanghaiChange, sectors }) {
  const equalWeight = useMemo(()=>{
    if(sectors.length===0) return round2(shanghaiChange-0.35);
    return round2(sectors.reduce((s,x)=>s+x.change,0)/sectors.length);
  },[sectors,shanghaiChange]);

  const diff    = round2(shanghaiChange-equalWeight);
  const absDiff = Math.abs(diff);

  const { signal, sigColor, sigBg, sigDesc, sigIcon } = useMemo(()=>{
    if(diff>0.8)  return {signal:"权重护盘",sigColor:"#d97706",sigBg:"#fef9c3",sigDesc:"大市值拉指数，个股普跌",sigIcon:"⚡"};
    if(diff<-0.8) return {signal:"小票行情",sigColor:"#16a34a",sigBg:"#f0fdf4",sigDesc:"个股普涨，指数被权重拖累",sigIcon:"🚀"};
    if(shanghaiChange>0&&equalWeight>0) return {signal:"普涨格局",sigColor:"#1d4ed8",sigBg:"#eff6ff",sigDesc:"指数与个股同步上涨",sigIcon:"▲"};
    if(shanghaiChange<0&&equalWeight<0) return {signal:"普跌格局",sigColor:"#dc2626",sigBg:"#fff5f5",sigDesc:"指数与个股同步下跌",sigIcon:"▼"};
    return {signal:"分化震荡",sigColor:"#64748b",sigBg:"#f8fafc",sigDesc:"指数与个股方向分歧",sigIcon:"◈"};
  },[diff,shanghaiChange,equalWeight]);

  return (
    <div style={{
      background:"#fff",border:"1.5px solid #e2e8f0",
      borderRadius:16,padding:"20px 22px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.04)",
      display:"flex",flexDirection:"column",gap:16,
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{
          fontSize:11,color:"#94a3b8",letterSpacing:3,
          fontWeight:700,display:"flex",alignItems:"center",gap:8,
        }}>
          <div style={{width:3,height:14,background:"#1d4ed8",borderRadius:2}}/>
          黄白线背离
        </div>
        <div style={{
          fontSize:12,fontWeight:800,color:sigColor,
          background:sigBg,padding:"3px 12px",borderRadius:20,
          border:`1px solid ${sigColor}44`,
          display:"flex",alignItems:"center",gap:5,
        }}>
          <span>{sigIcon}</span>{signal}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[
          {label:"白线 · 沪指加权",val:shanghaiChange,dot:"#334155",dash:false},
          {label:"黄线 · 全市等权",val:equalWeight,   dot:"#d97706",dash:true},
        ].map(row=>(
          <div key={row.label} style={{
            display:"flex",alignItems:"center",gap:10,
            background:"#f8fafc",borderRadius:10,padding:"10px 14px",
          }}>
            <svg width={28} height={12} style={{flexShrink:0}}>
              <line x1="0" y1="6" x2="28" y2="6" stroke={row.dot}
                strokeWidth="2.5" strokeDasharray={row.dash?"5,3":"none"}/>
            </svg>
            <span style={{fontSize:12,color:"#64748b",flex:1}}>{row.label}</span>
            <span style={{
              fontSize:15,fontFamily:"'Courier New',monospace",fontWeight:800,
              color:row.val>=0?"#1d4ed8":"#dc2626",
              minWidth:64,textAlign:"right",
            }}>{pct(row.val)}</span>
          </div>
        ))}

        <div style={{
          display:"flex",alignItems:"center",gap:10,
          paddingTop:10,borderTop:"1px dashed #e2e8f0",
        }}>
          <span style={{fontSize:12,color:"#94a3b8",flex:1}}>背离幅度</span>
          <span style={{
            fontSize:15,fontFamily:"'Courier New',monospace",fontWeight:800,
            color:absDiff>0.8?"#d97706":"#94a3b8",
            background:absDiff>0.8?"#fef9c3":"#f8fafc",
            padding:"3px 10px",borderRadius:6,
            border:`1px solid ${absDiff>0.8?"#fde68a":"#e2e8f0"}`,
          }}>
            {diff>=0?"+":""}{fmt(diff)}%
          </span>
        </div>
      </div>

      <div style={{
        background:sigBg,border:`1px solid ${sigColor}33`,
        borderLeft:`4px solid ${sigColor}`,borderRadius:8,
        padding:"10px 14px",fontSize:12,color:"#64748b",lineHeight:1.6,
      }}>
        {sigDesc}
      </div>
    </div>
  );
}

// ─── 板块徽章 ─────────────────────────────────────────────────────
function SectorBadge({ sector, shanghaiChange }) {
  const up      = sector.change>=0;
  const sameDir = sector.change*shanghaiChange>=0;
  const color   = up?"#1d4ed8":"#dc2626";
  const bg      = up?"#eff6ff":"#fff5f5";
  const border  = up?"#bfdbfe":"#fecaca";
  return (
    <div style={{
      background:bg,border:`1.5px solid ${border}`,
      borderRadius:12,padding:"12px 16px",
      display:"flex",alignItems:"center",gap:10,
      transition:"all 0.15s",cursor:"default",
      boxShadow:`0 2px 8px ${color}10`,
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${color}20`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 2px 8px ${color}10`;}}
    >
      <div>
        <div style={{fontSize:12,color:"#475569",fontWeight:700}}>{sector.name}</div>
        <div style={{fontSize:16,fontFamily:"'Courier New',monospace",fontWeight:900,color,marginTop:2}}>
          {pct(sector.change)}
        </div>
      </div>
      <div style={{
        marginLeft:"auto",fontSize:10,fontWeight:700,letterSpacing:0.5,
        color:sameDir?"#d97706":"#94a3b8",
        background:sameDir?"#fef9c3":"#f1f5f9",
        border:`1px solid ${sameDir?"#fde68a":"#e2e8f0"}`,
        padding:"3px 8px",borderRadius:6,
      }}>
        {sameDir?"联动":"背离"}
      </div>
    </div>
  );
}

// ─── 板块排行 ─────────────────────────────────────────────────────
function SectorRank({ sectors }) {
  const sorted = [...sectors].sort((a,b)=>b.change-a.change);
  const maxAbs = Math.max(...sectors.map(s=>Math.abs(s.change)),1);
  return (
    <div style={{
      background:"#fff",border:"1.5px solid #e2e8f0",
      borderRadius:16,padding:"24px 28px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:20,paddingBottom:14,borderBottom:"1.5px solid #f1f5f9",
      }}>
        <div style={{
          fontSize:13,color:"#0f172a",fontWeight:800,
          display:"flex",alignItems:"center",gap:8,
        }}>
          <div style={{width:3,height:16,background:"#1d4ed8",borderRadius:2}}/>
          板块 ETF 涨跌排行
        </div>
        <div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>共 {sectors.length} 个板块</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {sorted.map((s,i)=>{
          const up    = s.change>=0;
          const color = up?"#1d4ed8":"#dc2626";
          const barW  = Math.abs(s.change)/maxAbs*100;
          const isTop = i<3;
          return (
            <div key={s.code} style={{
              display:"flex",alignItems:"center",gap:14,
              padding:"10px 14px",borderRadius:10,
              background: isTop?(up?"#eff6ff":"#fff5f5"):"#f8fafc",
              border:`1px solid ${isTop?(up?"#bfdbfe":"#fecaca"):"transparent"}`,
              transition:"all 0.15s",cursor:"default",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=up?"#dbeafe":"#fee2e2";}}
              onMouseLeave={e=>{e.currentTarget.style.background=isTop?(up?"#eff6ff":"#fff5f5"):"#f8fafc";}}
            >
              <div style={{
                width:24,height:24,borderRadius:6,flexShrink:0,
                background: isTop?color:"#e2e8f0",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <span style={{fontSize:11,fontWeight:900,
                  color:isTop?"#fff":"#94a3b8",fontFamily:"monospace"}}>
                  {i+1}
                </span>
              </div>
              <span style={{fontSize:13,width:40,color:"#334155",fontWeight:700}}>{s.name}</span>
              <div style={{flex:1,height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}>
                <div style={{
                  width:`${barW}%`,height:"100%",borderRadius:3,
                  background: up
                    ? "linear-gradient(90deg,#93c5fd,#1d4ed8)"
                    : "linear-gradient(90deg,#fca5a5,#dc2626)",
                  transition:"width 0.6s ease",
                }}/>
              </div>
              <span style={{
                fontSize:14,fontFamily:"'Courier New',monospace",fontWeight:800,
                color,width:68,textAlign:"right",
              }}>{pct(s.change)}</span>
              <span style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",width:52,textAlign:"right"}}>
                {fmt(s.price,3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 统计数字卡 ───────────────────────────────────────────────────
function StatCard({ label, value, color, bg, border, icon }) {
  return (
    <div style={{
      background:bg,border:`1.5px solid ${border}`,
      borderRadius:12,padding:"14px 16px",textAlign:"center",
      boxShadow:`0 2px 10px ${color}10`,
    }}>
      <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:22,fontWeight:900,color,fontFamily:"'Courier New',monospace"}}>{value}</div>
      <div style={{fontSize:11,color:"#94a3b8",marginTop:4,fontWeight:600,letterSpacing:0.5}}>{label}</div>
    </div>
  );
}

// ─── 主页 ─────────────────────────────────────────────────────────
export default function HomePage({ indices, sectors }) {
  const sectorRankRef  = useRef(null);
  const shanghaiChange = indices.find(i=>i.code==="000001.SH")?.change??0;
  const upCount        = sectors.filter(s=>s.change>0).length;
  const downCount      = sectors.length-upCount;
  const sentimentScore = sectors.length>0?(upCount/sectors.length)*100:50;
  const weightSectors  = sectors.filter(s=>WEIGHT_SECTORS.includes(s.name));

  const [sparkMap, setSparkMap] = useState({});
  useEffect(()=>{
    if(!indices.length) return;
    let cancelled = false;
    indices.forEach(idx=>{
      getKline(idx.code,"1d",20)
        .then(bars=>{
          if(cancelled||!bars?.length) return;
          setSparkMap(prev=>({...prev,[idx.code]:bars.map(b=>b.c)}));
        })
        .catch(()=>{});
    });
    return ()=>{ cancelled=true; };
  },[indices]);

  return (
    <div style={{
      fontFamily:"'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif",
      background:"#f0f4ff",
      minHeight:"100vh",
    }}>

      {/* ══ Top bar ══ */}
      <div style={{
        padding:"12px 36px",
        background:"#fff",
        borderBottom:"1.5px solid #e2e8f0",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        boxShadow:"0 2px 12px rgba(29,78,216,0.06)",
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{
            fontSize:16,fontWeight:900,letterSpacing:2,color:"#1d4ed8",
            fontFamily:"'Courier New',monospace",
          }}>ETF·DESK</div>
          <div style={{width:1,height:16,background:"#e2e8f0"}}/>
          <div style={{fontSize:11,color:"#94a3b8",letterSpacing:2,fontWeight:600}}>市场总览</div>
        </div>
        <LiveClock/>
      </div>

      {/* ══ 内容区 ══ */}
      <div style={{padding:"24px 36px 40px",display:"flex",flexDirection:"column",gap:22}}>

        {/* 五大指数 */}
        <div>
          <div style={{
            fontSize:11,color:"#94a3b8",letterSpacing:3,marginBottom:12,
            fontWeight:700,display:"flex",alignItems:"center",gap:8,
          }}>
            <div style={{width:3,height:14,background:"#1d4ed8",borderRadius:2}}/>
            五大指数
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
            {indices.length===0
              ? Array(5).fill(0).map((_,i)=>(
                <div key={i} style={{
                  background:"#fff",border:"1.5px solid #e2e8f0",
                  borderRadius:16,padding:"18px 20px",height:120,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <span style={{color:"#94a3b8",fontSize:12}}>连接中...</span>
                </div>
              ))
              : indices.map(idx=>(
                <IndexCard key={idx.code} data={idx} sparkData={sparkMap[idx.code]}/>
              ))
            }
          </div>
        </div>

        {/* 情绪 + 黄白线 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
          <div style={{
            background:"#fff",border:"1.5px solid #e2e8f0",
            borderRadius:16,padding:"20px 22px",
            boxShadow:"0 4px 20px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontSize:11,color:"#94a3b8",letterSpacing:3,marginBottom:18,
              fontWeight:700,display:"flex",alignItems:"center",gap:8,
            }}>
              <div style={{width:3,height:14,background:"#1d4ed8",borderRadius:2}}/>
              市场情绪仪表盘
            </div>
            <div style={{display:"flex",justifyContent:"space-around",marginBottom:20}}>
              <ArcGauge label="赚钱效应" value={sentimentScore} sub={`${upCount}↑ ${downCount}↓`}/>
              <ArcGauge label="涨跌比"   value={sentimentScore}/>
              <ArcGauge label="量　比"   value={60}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              <StatCard label="上涨" value={upCount*10}   color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" icon="📈"/>
              <StatCard label="下跌" value={downCount*10} color="#dc2626" bg="#fff5f5" border="#fecaca" icon="📉"/>
              <StatCard label="涨停" value={Math.max(0,Math.floor(sentimentScore/5+2))}   color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" icon="🔒"/>
              <StatCard label="跌停" value={Math.max(0,Math.floor((100-sentimentScore)/14+1))} color="#dc2626" bg="#fff5f5" border="#fecaca" icon="🔓"/>
            </div>
          </div>
          <YWPanel shanghaiChange={shanghaiChange} sectors={sectors}/>
        </div>

        {/* 权重板块 */}
        <div style={{
          background:"#fff",border:"1.5px solid #e2e8f0",
          borderRadius:16,padding:"20px 22px",
          boxShadow:"0 4px 20px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            fontSize:11,color:"#94a3b8",letterSpacing:3,marginBottom:16,
            fontWeight:700,display:"flex",alignItems:"center",gap:8,
          }}>
            <div style={{width:3,height:14,background:"#1d4ed8",borderRadius:2}}/>
            指数权重板块
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
            {weightSectors.length>0
              ? weightSectors.map(s=>(
                <SectorBadge key={s.code} sector={s} shanghaiChange={shanghaiChange}/>
              ))
              : <span style={{color:"#94a3b8",fontSize:13}}>连接中...</span>
            }
          </div>
        </div>

        {/* Scroll CTA */}
        <div style={{textAlign:"center"}}>
          <button
            onClick={()=>sectorRankRef.current?.scrollIntoView({behavior:"smooth"})}
            style={{
              background:"#fff",border:"1.5px solid #bfdbfe",
              borderRadius:24,padding:"10px 28px",cursor:"pointer",
              color:"#1d4ed8",fontSize:12,fontWeight:700,letterSpacing:1,
              display:"inline-flex",alignItems:"center",gap:8,
              boxShadow:"0 2px 12px rgba(29,78,216,0.1)",
              transition:"all 0.2s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";e.currentTarget.style.boxShadow="0 4px 20px rgba(29,78,216,0.2)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.boxShadow="0 2px 12px rgba(29,78,216,0.1)";}}
          >
            查看板块排行 ↓
          </button>
        </div>
      </div>

      {/* ══ 板块排行 ══ */}
      <div ref={sectorRankRef} style={{
        padding:"36px 36px 60px",
        borderTop:"1.5px solid #e2e8f0",
        background:"#fff",
      }}>
        {sectors.length>0
          ? <SectorRank sectors={sectors}/>
          : <div style={{textAlign:"center",color:"#94a3b8",padding:60,fontSize:14}}>
              板块数据加载中...
            </div>
        }
      </div>
    </div>
  );
}
