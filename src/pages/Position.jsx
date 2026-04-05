// src/pages/Position.jsx
import { useState, useEffect } from "react";
import { getPositions } from "../api/index";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v) { return (v>=0?"+":"")+fmt(v)+"%" ; }

export default function PositionPage({ t }) {
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
  const colors = [t.pos, t.accent, t.warn, "#a78bfa", "#34d399"];

  return (
    <div style={{padding:"20px 24px", display:"flex", flexDirection:"column", gap:14}}>

      {/* KPI 卡片 */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12}}>
        {[
          { label:"总市值",   val:`¥${fmt(total)}`, color:t.text },
          { label:"总成本",   val:`¥${fmt(cost)}`,  color:t.muted },
          { label:"总盈亏",   val:`¥${fmt(pnl)}`,   color:pnl>=0?t.pos:t.neg },
          { label:"总收益率", val:pct(pnlPct),       color:pnlPct>=0?t.pos:t.neg },
        ].map(item => (
          <div key={item.label} style={{background:t.card,
            border:`1px solid ${t.border}`, borderRadius:10, padding:16}}>
            <div style={{fontSize:13,color:t.muted,letterSpacing:2,marginBottom:8}}>
              {item.label}
            </div>
            <div style={{fontSize:24,fontWeight:800,fontFamily:"monospace",color:item.color}}>
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {/* 持仓明细 */}
      <div style={{background:t.card, border:`1px solid ${t.border}`,
        borderRadius:10, overflow:"hidden"}}>
        <div style={{padding:"14px 20px", borderBottom:`1px solid ${t.border}`,
          fontSize:13, color:t.muted, letterSpacing:3}}>持仓明细</div>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:t.surface}}>
              {["代码","名称","持仓量","成本价","现价","市值","盈亏","收益率","占比"].map(h => (
                <th key={h} style={{
                  padding:"10px 16px", fontSize:13, color:t.muted, fontWeight:500,
                  textAlign: h==="代码"||h==="名称" ? "left" : "right",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr><td colSpan={9} style={{padding:"32px",textAlign:"center",
                color:t.muted,fontSize:15}}>加载中...</td></tr>
            ) : positions.map((p,i) => {
              const mv   = p.qty * p.price;
              const ppnl = (p.price - p.cost) * p.qty;
              const pp   = ((p.price - p.cost) / p.cost) * 100;
              const w    = total > 0 ? (mv / total) * 100 : 0;
              return (
                <tr key={p.code}
                  style={{borderTop:`1px solid ${t.border}`, transition:"background 0.15s"}}
                  onMouseEnter={e => e.currentTarget.style.background = t.surface}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{padding:"14px 16px",fontFamily:"monospace",
                    fontSize:15,color:t.accent}}>{p.code}</td>
                  <td style={{padding:"14px 16px",fontSize:15,color:t.text}}>{p.name}</td>
                  <td style={{padding:"14px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:15}}>{p.qty.toLocaleString()}</td>
                  <td style={{padding:"14px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:15,color:t.muted}}>{fmt(p.cost,3)}</td>
                  <td style={{padding:"14px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:15,fontWeight:700,color:p.price>=p.cost?t.pos:t.neg}}>
                    {fmt(p.price,3)}
                  </td>
                  <td style={{padding:"14px 16px",textAlign:"right",
                    fontFamily:"monospace",fontSize:15}}>{fmt(mv)}</td>
                  <td style={{padding:"14px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:15,color:ppnl>=0?t.pos:t.neg}}>
                    {ppnl>=0?"+":""}{fmt(ppnl)}
                  </td>
                  <td style={{padding:"14px 16px",textAlign:"right",fontFamily:"monospace",
                    fontSize:15,fontWeight:700,color:pp>=0?t.pos:t.neg}}>
                    {pct(pp)}
                  </td>
                  <td style={{padding:"14px 16px",textAlign:"right"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
                      <div style={{width:50,height:4,background:t.border,borderRadius:2}}>
                        <div style={{width:`${w}%`,height:"100%",
                          background:colors[i%5],borderRadius:2}}/>
                      </div>
                      <span style={{fontSize:13,color:t.muted,fontFamily:"monospace"}}>
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
      {positions.length > 0 && (
        <div style={{background:t.card, border:`1px solid ${t.border}`,
          borderRadius:10, padding:"16px 20px"}}>
          <div style={{fontSize:13,color:t.muted,letterSpacing:2,marginBottom:12}}>仓位分布</div>
          <div style={{display:"flex",height:14,borderRadius:6,overflow:"hidden",gap:2}}>
            {positions.map((p,i) => (
              <div key={p.code} style={{
                width:`${(p.qty*p.price/total)*100}%`,
                background:colors[i%5], transition:"width 0.5s",
              }}/>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            {positions.map((p,i) => (
              <div key={p.code} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:2,background:colors[i%5]}}/>
                <span style={{fontSize:13,color:t.sub}}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}