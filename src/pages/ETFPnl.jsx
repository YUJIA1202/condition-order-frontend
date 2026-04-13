// src/pages/ETFPnl.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import * as echarts from "echarts";

const API   = "http://localhost:8000";
const BLUE  = "#1d4ed8";
const RED   = "#dc2626";
const GREEN = "#16a34a";
const MUTED = "#94a3b8";
const BORDER= "#e2e8f0";
const CARD  = "#ffffff";
const SURF  = "#f8fafc";
const TEXT  = "#0f172a";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }

function fullCode(code) {
  if(!code||code.includes(".")) return code;
  if(code.startsWith("6")||code.startsWith("5")) return code+".SH";
  return code+".SZ";
}

function DailyPnlChart({ data, height=280 }) {
  const ref = useRef();
  useEffect(()=>{
    if(!data.length||!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      backgroundColor:CARD,
      tooltip:{
        trigger:"axis",backgroundColor:CARD,borderColor:BORDER,
        textStyle:{color:TEXT,fontSize:12,fontFamily:"monospace"},
        formatter(params){
          const p=params[0];
          return `<div style="color:${MUTED};font-size:11px;margin-bottom:4px">${p.axisValue}</div>
            <div style="color:${p.value>=0?BLUE:RED};font-weight:700;font-size:14px">
              ${p.value>=0?"+":""}¥${fmt(p.value)}
            </div>`;
        },
      },
      grid:{left:72,right:16,top:16,bottom:36},
      xAxis:{
        type:"category",data:data.map(d=>d.date),
        axisLine:{lineStyle:{color:BORDER}},
        axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace",formatter:v=>v.slice(5)},
        splitLine:{show:false},
      },
      yAxis:{
        type:"value",
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",
          formatter:v=>`¥${v>=0?"+":""}${fmt(v,0)}`},
        splitLine:{lineStyle:{color:BORDER,type:"dashed"}},
      },
      series:[{
        data:data.map(d=>d.pnl),type:"bar",
        itemStyle:{color:p=>p.value>=0?BLUE:RED,borderRadius:2},
        markLine:{silent:true,lineStyle:{color:BORDER,type:"dashed"},
          data:[{yAxis:0}],label:{show:false}},
      }],
    });
    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ chart.dispose(); ro.disconnect(); };
  },[data]);
  return <div ref={ref} style={{width:"100%",height}}/>;
}

function CumPnlChart({ data, height=220 }) {
  const ref = useRef();
  useEffect(()=>{
    if(!data.length||!ref.current) return;
    let cum=0;
    const cumData = data.map(d=>{ cum+=d.pnl; return +cum.toFixed(2); });
    const lastVal = cumData[cumData.length-1]??0;
    const color   = lastVal>=0?BLUE:RED;
    const chart   = echarts.init(ref.current);
    chart.setOption({
      backgroundColor:CARD,
      tooltip:{
        trigger:"axis",backgroundColor:CARD,borderColor:BORDER,
        textStyle:{color:TEXT,fontSize:12,fontFamily:"monospace"},
        formatter(params){
          const p=params[0];
          return `<div style="color:${MUTED};font-size:11px;margin-bottom:4px">${p.axisValue}</div>
            <div style="color:${p.value>=0?BLUE:RED};font-weight:700;font-size:14px">
              累计 ${p.value>=0?"+":""}¥${fmt(p.value)}
            </div>`;
        },
      },
      grid:{left:72,right:16,top:16,bottom:36},
      xAxis:{
        type:"category",data:data.map(d=>d.date),
        axisLine:{lineStyle:{color:BORDER}},
        axisLabel:{color:MUTED,fontSize:10,fontFamily:"monospace",formatter:v=>v.slice(5)},
        splitLine:{show:false},
      },
      yAxis:{
        type:"value",
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",
          formatter:v=>`¥${v>=0?"+":""}${fmt(v,0)}`},
        splitLine:{lineStyle:{color:BORDER,type:"dashed"}},
      },
      series:[{
        data:cumData,type:"line",smooth:true,symbol:"none",
        lineStyle:{color,width:2.5},
        areaStyle:{color:{type:"linear",x:0,y:0,x2:0,y2:1,
          colorStops:[{offset:0,color:color+"44"},{offset:1,color:color+"05"}]}},
        itemStyle:{color},
        markLine:{silent:true,lineStyle:{color:BORDER,type:"dashed"},
          data:[{yAxis:0}],label:{show:false}},
      }],
    });
    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ chart.dispose(); ro.disconnect(); };
  },[data]);
  return <div ref={ref} style={{width:"100%",height}}/>;
}

function StatCard({ label, val, sub, color }) {
  return (
    <div style={{background:SURF,border:`1px solid ${BORDER}`,borderRadius:10,padding:"14px 16px"}}>
      <div style={{fontSize:10,color:MUTED,marginBottom:6,fontWeight:600,letterSpacing:0.5}}>{label}</div>
      <div style={{fontSize:18,fontWeight:900,fontFamily:"monospace",color:color||TEXT,marginBottom:3}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:MUTED}}>{sub}</div>}
    </div>
  );
}

export default function ETFPnl({ etf }) {
  const [bars,      setBars]      = useState([]);
  const [buyDate,   setBuyDate]   = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(()=>{
    if(!etf) return;
    const code = etf.code.split(".")[0];
    // 拉配置文件获取买入日期
    fetch(`${API}/positions-config`)
      .then(r=>r.json())
      .then(cfg=>{
        const bd = cfg[code]?.buy_date || null;
        setBuyDate(bd);
        return fetch(`${API}/kline/${fullCode(etf.code)}?period=1d&count=365`);
      })
      .then(r=>r.json())
      .then(raw=>{
        setBars(raw.map((b,i,arr)=>{
          const prevClose = i>0 ? arr[i-1].c : b.o;
          const pnl = +((b.c - prevClose) * etf.qty).toFixed(2);
          const d   = new Date(b.t*1000);
          return {
            date:  d.toISOString().slice(0,10),
            open:  b.o, close:b.c,
            pnl,
            pct:   prevClose>0?(b.c-prevClose)/prevClose*100:0,
          };
        }));
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[etf]);

  // 只显示买入日期之后的数据
  const visibleBars = useMemo(()=>{
    if(!buyDate) return bars;
    return bars.filter(d=>d.date>=buyDate);
  },[bars, buyDate]);

  const stats = useMemo(()=>{
    if(!visibleBars.length) return null;
    const pnls    = visibleBars.map(d=>d.pnl);
    const cumPnl  = pnls.reduce((s,v)=>s+v,0);
    const winDays = pnls.filter(v=>v>0).length;
    const losDays = pnls.filter(v=>v<0).length;
    const maxWin  = Math.max(...pnls);
    const maxLos  = Math.min(...pnls);
    const winRate = visibleBars.length>0?(winDays/visibleBars.length*100):0;
    const avgWin  = winDays>0?pnls.filter(v=>v>0).reduce((s,v)=>s+v,0)/winDays:0;
    const avgLos  = losDays>0?pnls.filter(v=>v<0).reduce((s,v)=>s+v,0)/losDays:0;
    return {cumPnl,winDays,losDays,maxWin,maxLos,winRate,avgWin,avgLos};
  },[visibleBars]);

  if(!etf) return <div style={{padding:60,textAlign:"center",color:MUTED}}>未选择持仓</div>;

  const totalPnl = (etf.price-etf.cost)*etf.qty;
  const totalPct = ((etf.price-etf.cost)/etf.cost)*100;
  const up       = totalPnl>=0;

  return (
    <div style={{
      padding:"24px 28px",display:"flex",flexDirection:"column",gap:18,
      background:"#f0f4ff",minHeight:"100vh",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* 头部 */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
        padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
        borderLeft:`4px solid ${up?BLUE:RED}`}}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{fontSize:12,color:MUTED,marginBottom:6,letterSpacing:1}}>
              {fullCode(etf.code)} · {etf.name} · 每日盈亏分析
              {buyDate&&<span style={{marginLeft:8,fontSize:11,
                background:"#eff6ff",color:BLUE,padding:"1px 8px",borderRadius:4}}>
                从 {buyDate} 开始
              </span>}
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:12}}>
              <span style={{fontSize:32,fontWeight:900,fontFamily:"monospace",color:up?BLUE:RED}}>
                {up?"+":""}¥{fmt(totalPnl)}
              </span>
              <span style={{fontSize:16,fontFamily:"monospace",fontWeight:700,color:up?BLUE:RED,
                background:up?"#eff6ff":"#fff5f5",padding:"3px 10px",borderRadius:6}}>
                {pct(totalPct)}
              </span>
            </div>
            <div style={{display:"flex",gap:24}}>
              {[
                {label:"持仓量",val:`${etf.qty.toLocaleString()}股`},
                {label:"成本价",val:`¥${fmt(etf.cost,3)}`},
                {label:"现价",  val:`¥${fmt(etf.price,3)}`,color:up?BLUE:RED},
                {label:"市值",  val:`¥${fmt(etf.qty*etf.price,0)}`},
              ].map(item=>(
                <div key={item.label}>
                  <div style={{fontSize:10,color:MUTED,marginBottom:3,fontWeight:600}}>{item.label}</div>
                  <div style={{fontSize:14,fontFamily:"monospace",fontWeight:700,
                    color:item.color||TEXT}}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading?(
        <div style={{padding:60,textAlign:"center",color:MUTED,fontSize:14}}>加载K线数据...</div>
      ):(<>
        {stats&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            <StatCard label="持仓期间累计盈亏"
              val={`${stats.cumPnl>=0?"+":""}¥${fmt(stats.cumPnl)}`}
              sub={`共${visibleBars.length}个交易日`}
              color={stats.cumPnl>=0?BLUE:RED}/>
            <StatCard label="胜率"
              val={`${fmt(stats.winRate,1)}%`}
              sub={`盈利${stats.winDays}天 / 亏损${stats.losDays}天`}
              color={stats.winRate>=50?GREEN:RED}/>
            <StatCard label="最大单日盈利"
              val={`+¥${fmt(stats.maxWin)}`}
              sub={`日均盈利 +¥${fmt(stats.avgWin)}`}
              color={BLUE}/>
            <StatCard label="最大单日亏损"
              val={`¥${fmt(stats.maxLos)}`}
              sub={`日均亏损 ¥${fmt(stats.avgLos)}`}
              color={RED}/>
          </div>
        )}

        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>每日盈亏</span>
            <span style={{fontSize:11,color:MUTED,marginLeft:4}}>
              （当日收盘 − 前日收盘）× 持仓量
            </span>
          </div>
          <DailyPnlChart data={visibleBars} height={280}/>
        </div>

        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>累计盈亏走势</span>
          </div>
          <CumPnlChart data={visibleBars} height={220}/>
        </div>

        <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:14,
          overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"14px 20px",borderBottom:`1px solid ${BORDER}`,
            display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
            <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>每日明细</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}>
              <thead>
                <tr style={{background:SURF}}>
                  {["日期","收盘价","涨跌幅","当日盈亏","累计盈亏"].map(h=>(
                    <th key={h} style={{padding:"10px 16px",textAlign:"left",
                      color:MUTED,fontWeight:600,borderBottom:`1px solid ${BORDER}`,
                      fontSize:11,letterSpacing:0.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...visibleBars].reverse().slice(0,30).map((d,i)=>{
                  const cumPnl = visibleBars
                    .slice(0, visibleBars.length-i)
                    .reduce((s,v)=>s+v.pnl,0);
                  return (
                    <tr key={d.date} style={{
                      borderBottom:`1px solid ${BORDER}`,
                      background:i%2===0?CARD:SURF,
                    }}>
                      <td style={{padding:"10px 16px",color:MUTED}}>{d.date}</td>
                      <td style={{padding:"10px 16px",color:TEXT,fontWeight:600}}>
                        ¥{fmt(d.close,3)}
                      </td>
                      <td style={{padding:"10px 16px",
                        color:d.pct>=0?BLUE:RED,fontWeight:700}}>{pct(d.pct)}</td>
                      <td style={{padding:"10px 16px",
                        color:d.pnl>=0?BLUE:RED,fontWeight:700}}>
                        {d.pnl>=0?"+":""}¥{fmt(d.pnl)}
                      </td>
                      <td style={{padding:"10px 16px",
                        color:cumPnl>=0?BLUE:RED,fontWeight:700}}>
                        {cumPnl>=0?"+":""}¥{fmt(cumPnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  );
}
