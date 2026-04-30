// src/pages/Position.jsx
import { useState, useEffect } from "react";
import { getPositions } from "../api/index";


function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v) { return (v>=0?"+":"")+fmt(v)+"%" ; }

const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const SURF   = "#f8fafc";
const TEXT   = "#0f172a";
const DOT_COLORS = [BLUE, "#7c3aed", "#0891b2", "#d97706", "#16a34a"];
const SectionTitle = ({text}) => (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <div style={{width:3,height:16,background:BLUE,borderRadius:2}}/>
      <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>{text}</span>
    </div>
  );
  
export default function PositionPage() {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    getPositions().then(setPositions).catch(console.error);
    const iv = setInterval(() => {
      getPositions().then(setPositions).catch(console.error);
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const total  = positions.reduce((s,p) => s + p.qty * p.price, 0);
  const cost   = positions.reduce((s,p) => s + p.qty * p.cost,  0);
  const pnl    = total - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;



  return (
    <div style={{
      padding:"24px 28px",display:"flex",flexDirection:"column",gap:18,
      background:"#f0f4ff",minHeight:"100vh",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* KPI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {label:"总市值",   val:`¥${fmt(total)}`, color:TEXT,              border:BLUE},
          {label:"总成本",   val:`¥${fmt(cost)}`,  color:MUTED,             border:"#94a3b8"},
          {label:"总盈亏",   val:`${pnl>=0?"+":""}¥${fmt(pnl)}`,   color:pnl>=0?BLUE:RED,    border:pnl>=0?BLUE:RED},
          {label:"总收益率", val:pct(pnlPct),       color:pnlPct>=0?BLUE:RED, border:pnlPct>=0?BLUE:RED},
        ].map(item=>(
          <div key={item.label} style={{
            background:CARD,border:`1.5px solid ${BORDER}`,
            borderRadius:14,padding:"18px 20px",
            borderTop:`3px solid ${item.border}`,
            boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
          }}>
            <div style={{fontSize:11,color:MUTED,letterSpacing:1.5,marginBottom:8,fontWeight:600}}>{item.label}</div>
            <div style={{fontSize:24,fontWeight:900,fontFamily:"monospace",color:item.color}}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* 持仓明细表 */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
        overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${BORDER}`,
          display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:3,height:16,background:BLUE,borderRadius:2}}/>
          <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>持仓明细</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:SURF}}>
              {["代码","名称","持仓量","成本价","现价","市值","盈亏","收益率","占比"].map(h=>(
                <th key={h} style={{
                  padding:"10px 16px",fontSize:11,color:MUTED,fontWeight:700,
                  letterSpacing:0.5,
                  textAlign:h==="代码"||h==="名称"?"left":"right",
                  borderBottom:`1px solid ${BORDER}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.length===0 ? (
              <tr><td colSpan={9} style={{padding:"40px",textAlign:"center",
                color:MUTED,fontSize:14}}>加载中...</td></tr>
            ) : positions.map((p,i)=>{
              const mv   = p.qty*p.price;
              const ppnl = (p.price-p.cost)*p.qty;
              const pp   = ((p.price-p.cost)/p.cost)*100;
              const w    = total>0?(mv/total)*100:0;
              const up   = ppnl>=0;
              return (
                <tr key={p.code} style={{borderTop:`1px solid ${BORDER}`,transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=SURF}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"13px 16px",fontFamily:"monospace",fontSize:14,
                    fontWeight:800,color:BLUE}}>{p.code}</td>
                  <td style={{padding:"13px 16px",fontSize:14,color:TEXT}}>{p.name}</td>
                  <td style={{padding:"13px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:14,color:"#475569"}}>{p.qty.toLocaleString()}</td>
                  <td style={{padding:"13px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:14,color:MUTED}}>{fmt(p.cost,3)}</td>
                  <td style={{padding:"13px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:14,fontWeight:700,color:up?BLUE:RED}}>{fmt(p.price,3)}</td>
                  <td style={{padding:"13px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:14,color:"#475569"}}>{fmt(mv)}</td>
                  <td style={{padding:"13px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:14,fontWeight:700,color:up?BLUE:RED}}>
                    {up?"+":""}{fmt(ppnl)}
                  </td>
                  <td style={{padding:"13px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:14,fontWeight:700,color:up?BLUE:RED}}>{pct(pp)}</td>
                  <td style={{padding:"13px 16px",textAlign:"right"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                      <div style={{width:48,height:5,background:BORDER,borderRadius:3}}>
                        <div style={{width:`${w}%`,height:"100%",
                          background:DOT_COLORS[i%5],borderRadius:3,transition:"width 0.5s"}}/>
                      </div>
                      <span style={{fontSize:12,color:MUTED,fontFamily:"monospace",minWidth:36}}>
                        {fmt(w)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 仓位分布 */}
      {positions.length>0&&(
        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"18px 20px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
          <SectionTitle text="仓位分布"/>
          <div style={{display:"flex",height:16,borderRadius:8,overflow:"hidden",gap:2,marginBottom:14}}>
            {positions.map((p,i)=>(
              <div key={p.code} style={{
                width:`${(p.qty*p.price/total)*100}%`,
                background:DOT_COLORS[i%5],transition:"width 0.5s",
                minWidth:2,
              }}/>
            ))}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
            {positions.map((p,i)=>{
              const w=(p.qty*p.price/total)*100;
              return (
                <div key={p.code} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:2,background:DOT_COLORS[i%5]}}/>
                  <span style={{fontSize:12,color:"#475569",fontWeight:600}}>{p.name}</span>
                  <span style={{fontSize:12,color:MUTED,fontFamily:"monospace"}}>{fmt(w)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
