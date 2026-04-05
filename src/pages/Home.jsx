// src/pages/Home.jsx
const INDEX_META = {
  "000001.SH": { name:"上证指数", short:"沪指"  },
  "399001.SZ": { name:"深证成指", short:"深指"  },
  "399006.SZ": { name:"创业板指", short:"创业板" },
  "688000.SH": { name:"科创50",  short:"科创板" },
  "899050.BJ": { name:"北证50",  short:"北交所" },
};

const WEIGHT_SECTORS = ["券商","保险","银行","石油石化","煤炭","钢铁","白酒","电力"];

// 模拟板块数据（接入QMT后替换）
const MOCK_SECTORS = [
  {name:"券商",   change:1.50},  {name:"保险",   change:-1.49},
  {name:"银行",   change:-1.05}, {name:"石油石化",change:-0.94},
  {name:"煤炭",   change:0.92},  {name:"钢铁",   change:1.76},
  {name:"白酒",   change:-2.20}, {name:"电力",   change:1.15},
  {name:"新能源", change:2.31},  {name:"半导体",  change:3.12},
  {name:"医药",   change:-0.43}, {name:"消费",    change:0.88},
  {name:"军工",   change:1.24},  {name:"房地产",  change:-1.87},
  {name:"有色金属",change:0.65}, {name:"传媒",    change:2.10},
  {name:"计算机", change:1.93},  {name:"汽车",    change:-0.32},
  {name:"化工",   change:0.47},  {name:"食品饮料",change:-1.12},
];

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

// ─── 指数卡片 ─────────────────────────────────────────────────────
function IndexCard({ data, t }) {
  const meta = INDEX_META[data.code] || { name:data.code, short:data.code };
  const up = data.change >= 0;
  return (
    <div style={{
      background:t.card, border:`1px solid ${t.border}`,
      borderRadius:10, padding:"14px 16px", cursor:"pointer",
      transition:"border-color 0.15s",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = t.accent}
    onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
      <div style={{fontSize:9,color:t.muted,letterSpacing:2,marginBottom:6}}>{meta.short}</div>
      <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",
        color: up ? t.pos : t.neg}}>
        {fmt(data.price)}
      </div>
      <div style={{fontSize:13,fontFamily:"monospace",fontWeight:700,marginTop:4,
        color: up ? t.pos : t.neg}}>
        {up ? "▲" : "▼"} {Math.abs(data.change).toFixed(2)}%
      </div>
    </div>
  );
}

// ─── 市场情绪仪表盘 ───────────────────────────────────────────────
function Gauge({ label, value, t }) {
  const c = clamp(value, 0, 100);
  const color = c > 65 ? t.pos : c < 35 ? t.neg : t.warn;
  const r=28, cx=40, cy=38;
  const circ = Math.PI * r;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={80} height={52} viewBox="0 0 80 52">
        <path d={`M${cx-r},${cy} A${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke={t.border} strokeWidth="6" strokeLinecap="round"/>
        <path d={`M${cx-r},${cy} A${r},${r} 0 0,1 ${cx+r},${cy}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(c/100)*circ} ${circ}`}
          style={{transition:"stroke-dasharray 0.5s"}}/>
        <text x={cx} y={cy+2} textAnchor="middle" fill={color}
          fontSize="11" fontFamily="monospace" fontWeight="700">{Math.round(c)}</text>
      </svg>
      <div style={{fontSize:9,color:t.muted,marginTop:-4,letterSpacing:1}}>{label}</div>
    </div>
  );
}

// ─── 黄白线面板 ───────────────────────────────────────────────────
function YWPanel({ shanghaiChange, t }) {
  // 模拟等权均值（接入QMT后替换）
  const equalWeight = shanghaiChange - 0.35 + (Math.random()-0.5)*0.1;
  const diff = shanghaiChange - equalWeight;
  const absDiff = Math.abs(diff);

  let signal, sigColor, sigDesc;
  if      (diff > 0.8)  { signal="权重护盘"; sigColor=t.warn; sigDesc="大市值拉指数，个股普跌，赚钱效应差"; }
  else if (diff < -0.8) { signal="小票行情"; sigColor=t.pos;  sigDesc="个股普涨，指数被权重拖累，赚钱效应强"; }
  else if (shanghaiChange>0 && equalWeight>0) { signal="普涨格局"; sigColor=t.pos; sigDesc="指数与个股同步上涨"; }
  else if (shanghaiChange<0 && equalWeight<0) { signal="普跌格局"; sigColor=t.neg; sigDesc="指数与个股同步下跌"; }
  else    { signal="分化震荡"; sigColor=t.muted; sigDesc="指数与个股方向分歧，观望为主"; }

  return (
    <div style={{background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"14px 16px"}}>
      <div style={{fontSize:12,color:t.muted,letterSpacing:3,marginBottom:12}}>黄白线背离</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
        {[
          {label:"白线（沪指·加权）", val:shanghaiChange, dash:false, color:t.text},
          {label:"黄线（全市·等权）", val:equalWeight,    dash:true,  color:t.warn},
        ].map(row => (
          <div key={row.label} style={{display:"flex",alignItems:"center",gap:8}}>
            <svg width={20} height={10}>
              <line x1="0" y1="5" x2="20" y2="5" stroke={row.color}
                strokeWidth="2" strokeDasharray={row.dash?"4,3":"none"}/>
            </svg>
            <span style={{fontSize:12,color:t.muted,flex:1}}>{row.label}</span>
            <span style={{fontSize:14,fontFamily:"monospace",fontWeight:700,
              color:row.val>=0?t.pos:t.neg}}>{pct(row.val)}</span>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:8,
          paddingTop:8,borderTop:`1px solid ${t.border}`}}>
          <span style={{fontSize:12,color:t.muted,flex:1}}>背离值</span>
          <span style={{fontSize:14,fontFamily:"monospace",fontWeight:700,
            color:absDiff>0.8?t.warn:t.muted}}>
            {diff>=0?"+":""}{fmt(diff)}%
          </span>
        </div>
      </div>
      <div style={{background:t.surface, borderRadius:7, padding:"8px 12px",
        borderLeft:`3px solid ${sigColor}`, display:"flex", alignItems:"center", gap:10}}>
        <span style={{fontSize:14,fontWeight:700,color:sigColor,whiteSpace:"nowrap"}}>{signal}</span>
        <span style={{fontSize:12,color:t.sub}}>{sigDesc}</span>
      </div>
    </div>
  );
}

// ─── 权重压盘板块 ─────────────────────────────────────────────────
function WeightSectors({ sectors, shanghaiChange, t }) {
  const weightSectors = sectors.filter(s => WEIGHT_SECTORS.includes(s.name));
  return (
    <div style={{background:t.card, border:`1px solid ${t.border}`,
      borderRadius:10, padding:"14px 16px"}}>
      <div style={{fontSize:12,color:t.warn,letterSpacing:3,marginBottom:10}}>
        指数权重压盘板块
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {weightSectors.map(s => {
          const sameDir = s.change * shanghaiChange >= 0;
          const up = s.change >= 0;
          return (
            <div key={s.name} style={{
              background:t.surface,
              border:`1px solid ${sameDir ? t.warn+"55" : t.border}`,
              borderRadius:7, padding:"6px 12px",
              display:"flex", alignItems:"center", gap:8,
            }}>
              <span style={{fontSize:14,color:sameDir?t.warn:t.muted}}>{s.name}</span>
              <span style={{fontSize:14,fontFamily:"monospace",fontWeight:700,
                color:up?t.pos:t.neg}}>{pct(s.change)}</span>
              <span style={{fontSize:12,
                color:sameDir?t.warn:t.muted}}>
                {sameDir?"↑联动":"↓背离"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 板块排行 ─────────────────────────────────────────────────────
function SectorRank({ sectors, t }) {
  const sorted = [...sectors].sort((a,b) => b.change - a.change);
  return (
    <div style={{background:t.card, border:`1px solid ${t.border}`,
      borderRadius:10, padding:"14px 16px"}}>
      <div style={{fontSize:12,color:t.muted,letterSpacing:3,marginBottom:10}}>板块排行</div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:4}}>
        {sorted.map((s,i) => {
          const up = s.change >= 0;
          const isWeight = WEIGHT_SECTORS.includes(s.name);
          const barW = Math.min(Math.abs(s.change)/4*100, 100);
          return (
            <div key={s.name} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"4px 8px", borderRadius:6,
              background: isWeight ? t.surface : "transparent",
              border:`1px solid ${isWeight ? t.warn+"33":"transparent"}`,
            }}>
              <span style={{fontSize:9,color:t.muted,width:14,textAlign:"right"}}>{i+1}</span>
              <span style={{fontSize:13,width:56,color:isWeight?t.warn:t.text}}>{s.name}</span>
              <div style={{flex:1,height:3,background:t.border,borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${barW}%`,height:"100%",
                  background:up?t.pos:t.neg,transition:"width 0.5s"}}/>
              </div>
              <span style={{fontSize:13,fontFamily:"monospace",fontWeight:700,
                color:up?t.pos:t.neg,width:52,textAlign:"right"}}>
                {pct(s.change)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 主页 ─────────────────────────────────────────────────────────
export default function HomePage({ indices, t }) {
  const shanghaiChange = indices.find(i=>i.code==="000001.SH")?.change ?? 0;
  const upCount = MOCK_SECTORS.filter(s=>s.change>0).length;
  const sentimentScore = (upCount / MOCK_SECTORS.length) * 100;

  return (
    <div style={{padding:"20px 24px", display:"flex", flexDirection:"column", gap:14}}>

      {/* 五大指数 */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10}}>
        {indices.length === 0
          ? Array(5).fill(0).map((_,i) => (
              <div key={i} style={{background:t.card,border:`1px solid ${t.border}`,
                borderRadius:10,padding:"14px 16px",height:90,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:t.muted,fontSize:13}}>连接中...</span>
              </div>
            ))
          : indices.map(idx => <IndexCard key={idx.code} data={idx} t={t}/>)
        }
      </div>

      {/* 情绪 + 黄白线 */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div style={{background:t.card, border:`1px solid ${t.border}`, borderRadius:10, padding:"14px 16px"}}>
          <div style={{fontSize:12,color:t.muted,letterSpacing:3,marginBottom:12}}>市场情绪</div>
          <div style={{display:"flex", justifyContent:"space-around", marginBottom:12}}>
            <Gauge label="赚钱效应" value={sentimentScore} t={t}/>
            <Gauge label="涨跌比"   value={(upCount/MOCK_SECTORS.length)*100} t={t}/>
            <Gauge label="量比"     value={45+Math.random()*30} t={t}/>
          </div>
          <div style={{display:"flex", gap:8}}>
            {[
              {label:"涨停", val:Math.floor(sentimentScore/5+8),  color:t.pos},
              {label:"跌停", val:Math.floor((100-sentimentScore)/10+2), color:t.neg},
              {label:"上涨", val:Math.floor(upCount*195),  color:t.pos},
              {label:"下跌", val:Math.floor((MOCK_SECTORS.length-upCount)*195), color:t.neg},
            ].map(item => (
              <div key={item.label} style={{flex:1,background:t.surface,
                borderRadius:6,padding:"7px 6px",textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:700,color:item.color,fontFamily:"monospace"}}>
                  {item.val}
                </div>
                <div style={{fontSize:9,color:t.muted,marginTop:2}}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
        <YWPanel shanghaiChange={shanghaiChange} t={t}/>
      </div>

      {/* 权重压盘 */}
      <WeightSectors sectors={MOCK_SECTORS} shanghaiChange={shanghaiChange} t={t}/>

      {/* 板块排行 */}
      <SectorRank sectors={MOCK_SECTORS} t={t}/>
    </div>
  );
}