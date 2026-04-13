// src/pages/ETFDetail.jsx
import { useState, useMemo, useRef, useEffect } from "react";
import * as echarts from "echarts";

const API    = "http://localhost:8000";
const NOW    = Date.now();
const BLUE   = "#1d4ed8";
const RED    = "#dc2626";
const AMBER  = "#d97706";
const MUTED  = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD   = "#ffffff";
const SURF   = "#f8fafc";
const TEXT   = "#0f172a";

function fmt(n, d=2) { return Number(n).toFixed(d); }
function pct(v, d=2) { return (v>=0?"+":"")+fmt(v,d)+"%"; }

function fullCode(code) {
  if(!code) return code;
  if(code.includes(".")) return code;
  if(code.startsWith("6")||code.startsWith("5")) return code+".SH";
  return code+".SZ";
}

const RANGES = [{label:"1月",days:30},{label:"3月",days:90},{label:"6月",days:180},{label:"1年",days:365}];

function aggregate(history, groupKey) {
  const map = {};
  history.forEach(d=>{
    const key = d[groupKey] || d.date?.slice(0,7);
    if(!map[key]) map[key]={date:key,pnl:0,dailyPnl:0,pct:0,dailyPct:0};
    map[key].pnl      += d.dailyPnl||0;
    map[key].dailyPnl += d.dailyPnl||0;
    map[key].pct      += d.dailyPct||0;
    map[key].dailyPct += d.dailyPct||0;
  });
  return Object.values(map);
}

// ─── ECharts 收益图 ───────────────────────────────────────────────
function ReturnChart({ data, mode, showField, height=300 }) {
  const ref = useRef();
  useEffect(()=>{
    if(!data.length||!ref.current) return;
    const chart = echarts.init(ref.current);
    const dates = data.map(d=>d.date);
    const vals  = data.map(d=>+(
      showField==="pnl"
        ? (d.pnl??d.dailyPnl??0)
        : (d.pct??d.dailyPct??0)
    ).toFixed(2));

    const series = mode==="bar"
      ? { data:vals,type:"bar",
          itemStyle:{color:p=>p.value>=0?BLUE:RED},
          markLine:{silent:true,lineStyle:{color:BORDER,type:"dashed"},
            data:[{yAxis:0}],label:{show:false}} }
      : { data:vals,type:"line",smooth:true,symbol:"none",
          lineStyle:{color:BLUE,width:2},
          areaStyle:{color:{type:"linear",x:0,y:0,x2:0,y2:1,
            colorStops:[{offset:0,color:BLUE+"33"},{offset:1,color:BLUE+"05"}]}},
          itemStyle:{color:BLUE},
          markLine:{silent:true,lineStyle:{color:BORDER,type:"dashed"},
            data:[{yAxis:0}],label:{show:false}} };

    chart.setOption({
      backgroundColor:CARD,
      tooltip:{
        trigger:"axis",backgroundColor:CARD,borderColor:BORDER,
        textStyle:{color:TEXT,fontSize:12,fontFamily:"monospace"},
        formatter(params){
          const p=params[0];
          const sign=p.value>=0?"+":"";
          const val=showField==="pnl"?`${sign}¥${fmt(p.value)}`:`${sign}${fmt(p.value)}%`;
          return `<div style="color:${MUTED};font-size:11px;margin-bottom:4px">${p.axisValue}</div>
                  <div style="color:${p.value>=0?BLUE:RED};font-weight:700">${val}</div>`;
        },
      },
      grid:{left:72,right:16,top:12,bottom:32},
      xAxis:{type:"category",data:dates,
        axisLine:{lineStyle:{color:BORDER}},
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",formatter:v=>v.slice(5)},
        splitLine:{show:false}},
      yAxis:{type:"value",
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",
          formatter:v=>showField==="pnl"?`¥${fmt(v,0)}`:`${v>=0?"+":""}${fmt(v,1)}%`},
        splitLine:{lineStyle:{color:BORDER,type:"dashed"}}},
      series:[series],
    });
    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ chart.dispose(); ro.disconnect(); };
  },[data,mode,showField]);
  return <div ref={ref} style={{width:"100%",height}}/>;
}

// ─── ECharts 对比图 ───────────────────────────────────────────────
function CompareChart({ pnlHistory, indexHistory, height=280 }) {
  const ref = useRef();
  useEffect(()=>{
    if(!pnlHistory.length||!ref.current) return;
    const chart = echarts.init(ref.current);

    const indexMap = {};
    indexHistory.forEach(d=>{ indexMap[d.date]=d; });

    // 累计盈亏转百分比
    let cumPnl = 0;
    const portfolioPoints = pnlHistory.map(d=>{
      cumPnl += d.dailyPnl||0;
      return {date:d.date, cumPnl};
    });
    const maxPnl = Math.max(...portfolioPoints.map(p=>Math.abs(p.cumPnl)));
    const base   = maxPnl>0 ? maxPnl*10 : 10000;

    const shFirst = indexHistory[0]?.shanghai;
    const hsFirst = indexHistory[0]?.hs300;
    const dates   = pnlHistory.map(d=>d.date);
    const portfolioPct = portfolioPoints.map(p=>+((p.cumPnl/base)*100).toFixed(3));
    const shanghaiPct  = dates.map(d=>{
      const idx=indexMap[d];
      if(!idx||!shFirst) return null;
      return +((idx.shanghai-shFirst)/shFirst*100).toFixed(3);
    });
    const hs300Pct = dates.map(d=>{
      const idx=indexMap[d];
      if(!idx||!hsFirst) return null;
      return +((idx.hs300-hsFirst)/hsFirst*100).toFixed(3);
    });

    chart.setOption({
      backgroundColor:CARD,
      tooltip:{
        trigger:"axis",backgroundColor:CARD,borderColor:BORDER,
        textStyle:{color:TEXT,fontSize:12,fontFamily:"monospace"},
        formatter(params){
          const d=params[0]?.axisValue;
          const pv=params[0]?.value, sv=params[1]?.value, hv=params[2]?.value;
          if(pv==null) return "";
          const diff=sv!=null?pv-sv:null;
          return `<div style="color:${MUTED};font-size:11px;margin-bottom:5px">${d}</div>
            <div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:3px">
              <span style="color:${BLUE}">我的ETF</span>
              <span style="color:${BLUE};font-weight:700">${pv>=0?"+":""}${fmt(pv)}%</span>
            </div>
            ${sv!=null?`<div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:3px">
              <span style="color:${MUTED}">上证指数</span>
              <span style="font-weight:700">${sv>=0?"+":""}${fmt(sv)}%</span>
            </div>`:""}
            ${hv!=null?`<div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:5px">
              <span style="color:${AMBER}">沪深300</span>
              <span style="color:${AMBER};font-weight:700">${hv>=0?"+":""}${fmt(hv)}%</span>
            </div>`:""}
            ${diff!=null?`<div style="border-top:1px solid ${BORDER};padding-top:5px;display:flex;justify-content:space-between;gap:18px">
              <span style="color:${MUTED};font-size:11px">跑赢上证</span>
              <span style="font-weight:700;color:${diff>=0?BLUE:RED}">${diff>=0?"+":""}${fmt(diff)}%</span>
            </div>`:""}`;
        },
      },
      legend:{data:["我的ETF","上证指数","沪深300"],textStyle:{color:"#64748b",fontSize:12},top:4},
      grid:{left:56,right:16,top:36,bottom:32},
      xAxis:{type:"category",data:dates,
        axisLine:{lineStyle:{color:BORDER}},
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",formatter:v=>v.slice(5)},
        splitLine:{show:false}},
      yAxis:{type:"value",
        axisLabel:{color:MUTED,fontSize:11,fontFamily:"monospace",
          formatter:v=>(v>=0?"+":"")+v.toFixed(1)+"%"},
        splitLine:{lineStyle:{color:BORDER,type:"dashed"}}},
      series:[
        {name:"我的ETF",data:portfolioPct,type:"line",smooth:true,symbol:"none",
          lineStyle:{color:BLUE,width:2.5},
          areaStyle:{color:{type:"linear",x:0,y:0,x2:0,y2:1,
            colorStops:[{offset:0,color:BLUE+"22"},{offset:1,color:BLUE+"05"}]}},
          itemStyle:{color:BLUE}},
        {name:"上证指数",data:shanghaiPct,type:"line",smooth:true,symbol:"none",
          connectNulls:true,
          lineStyle:{color:"#64748b",width:1.5,type:"dashed"},itemStyle:{color:"#64748b"}},
        {name:"沪深300",data:hs300Pct,type:"line",smooth:true,symbol:"none",
          connectNulls:true,
          lineStyle:{color:AMBER,width:1.5,type:"dashed"},itemStyle:{color:AMBER}},
      ],
    });
    const ro=new ResizeObserver(()=>chart.resize());
    ro.observe(ref.current);
    return ()=>{ chart.dispose(); ro.disconnect(); };
  },[pnlHistory,indexHistory]);
  return <div ref={ref} style={{width:"100%",height}}/>;
}

// ─── 按钮组 ───────────────────────────────────────────────────────
function BtnGroup({ items, active, onSelect, keyField="id", labelField="label" }) {
  return (
    <div style={{display:"flex",gap:3}}>
      {items.map(item=>{
        const k=item[keyField]??item, l=item[labelField]??item, on=active===k;
        return (
          <button key={k} onClick={()=>onSelect(k)} style={{
            padding:"4px 12px",borderRadius:6,cursor:"pointer",
            fontSize:12,fontWeight:600,fontFamily:"monospace",
            background:on?BLUE:"transparent",
            border:`1px solid ${on?BLUE:BORDER}`,
            color:on?"#fff":"#64748b",transition:"all 0.15s",
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ─── Section 标题 ─────────────────────────────────────────────────
function SectionTitle({ text }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <div style={{width:3,height:14,background:BLUE,borderRadius:2}}/>
      <span style={{fontSize:12,color:MUTED,letterSpacing:2,fontWeight:700}}>{text}</span>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function ETFDetail({ etf }) {
  const [chartMode,   setChartMode]   = useState("line");
  const [showField,   setShowField]   = useState("pct");
  const [period,      setPeriod]      = useState("day");
  const [rangeIdx,    setRangeIdx]    = useState(1);
  const [pnlData,     setPnlData]     = useState([]);
  const [indexData,   setIndexData]   = useState([]);
  const [loading,     setLoading]     = useState(true);
useEffect(()=>{
  if(!etf) return;
  Promise.resolve().then(()=>setLoading(true));
  Promise.all([
      fetch(`${API}/history-pnl?days=365`).then(r=>r.json()),
      fetch(`${API}/history-index?days=365`).then(r=>r.json()),
    ]).then(([pnl, idx])=>{
      setPnlData(pnl);
      setIndexData(idx);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[etf]);

  const visiblePnl = useMemo(()=>
    pnlData.slice(-RANGES[rangeIdx].days)
  ,[pnlData, rangeIdx]);

  const visibleIndex = useMemo(()=>{
    if(!visiblePnl.length) return [];
    const startDate = visiblePnl[0].date;
    return indexData.filter(d=>d.date>=startDate);
  },[indexData, visiblePnl]);

  const periodData = useMemo(()=>{
    if(period==="day")   return visiblePnl;
    if(period==="week")  return aggregate(visiblePnl,"week");
    if(period==="month") return aggregate(visiblePnl,"month");
    return aggregate(pnlData,"year");
  },[period, visiblePnl, pnlData]);

  if(!etf) return (
    <div style={{padding:60,textAlign:"center",color:MUTED,fontSize:14}}>未选择ETF</div>
  );

  const totalPnl = (etf.price-etf.cost)*etf.qty;
  const totalPct = ((etf.price-etf.cost)/etf.cost)*100;
  const days     = Math.max(1,Math.round((NOW-new Date(etf.buyDate||"2024-01-01"))/86400000));
  const up       = totalPnl>=0;

  return (
    <div style={{
      padding:"24px 28px",display:"flex",flexDirection:"column",gap:18,
      background:"#f0f4ff",minHeight:"100vh",
      fontFamily:"'Segoe UI','PingFang SC',sans-serif",
    }}>

      {/* Header */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:16,
        padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
        borderTop:`3px solid ${up?BLUE:RED}`}}>
        <div style={{fontSize:12,color:MUTED,marginBottom:8,letterSpacing:1,fontWeight:600}}>
          {fullCode(etf.code)} · {etf.name}
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:16,marginBottom:18}}>
          <span style={{fontSize:36,fontWeight:900,fontFamily:"monospace",color:up?BLUE:RED}}>
            {up?"+":""}¥{fmt(totalPnl)}
          </span>
          <span style={{
            fontSize:18,fontFamily:"monospace",fontWeight:700,color:up?BLUE:RED,
            background:up?"#eff6ff":"#fff5f5",padding:"3px 12px",borderRadius:8,
            border:`1px solid ${up?"#bfdbfe":"#fecaca"}`,
          }}>{pct(totalPct)}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:14}}>
          {[
            {label:"持仓量",  val:`${etf.qty.toLocaleString()}股`},
            {label:"成本价",  val:`¥${fmt(etf.cost,3)}`},
            {label:"现价",    val:`¥${fmt(etf.price,3)}`},
            {label:"持有天数",val:`${days}天`},
            {label:"日均盈亏",val:`${totalPnl/days>=0?"+":""}¥${fmt(totalPnl/days)}`},
            {label:"周均盈亏",val:`${totalPnl/(days/7)>=0?"+":""}¥${fmt(totalPnl/(days/7))}`},
            {label:"月均盈亏",val:`${totalPnl/(days/30)>=0?"+":""}¥${fmt(totalPnl/(days/30))}`},
          ].map(item=>(
            <div key={item.label} style={{
              background:SURF,borderRadius:10,padding:"10px 12px",border:`1px solid ${BORDER}`,
            }}>
              <div style={{fontSize:10,color:MUTED,marginBottom:4,fontWeight:600}}>{item.label}</div>
              <div style={{fontSize:14,fontFamily:"monospace",fontWeight:800,color:TEXT}}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 收益走势 */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:16,
        padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <SectionTitle text="收益走势"/>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <span style={{fontSize:11,color:MUTED+"99"}}>
            {loading?"加载中...":"基于真实K线计算"}
          </span>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <BtnGroup items={RANGES.map((r,i)=>({id:i,label:r.label}))}
              active={rangeIdx} onSelect={setRangeIdx}/>
            <div style={{width:1,height:16,background:BORDER}}/>
            <BtnGroup items={[{id:"day",label:"日"},{id:"week",label:"周"},
              {id:"month",label:"月"},{id:"year",label:"年"}]}
              active={period} onSelect={setPeriod}/>
            <div style={{width:1,height:16,background:BORDER}}/>
            <button onClick={()=>setShowField(f=>f==="pnl"?"pct":"pnl")} style={{
              padding:"4px 12px",borderRadius:6,border:`1px solid ${BORDER}`,
              background:"transparent",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,
            }}>{showField==="pnl"?"显示%":"显示¥"}</button>
            <button onClick={()=>setChartMode(m=>m==="line"?"bar":"line")} style={{
              padding:"4px 12px",borderRadius:6,border:`1px solid ${BORDER}`,
              background:"transparent",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600,
            }}>{chartMode==="line"?"📊 柱状":"📈 折线"}</button>
          </div>
        </div>
        {loading ? (
          <div style={{height:300,display:"flex",alignItems:"center",
            justifyContent:"center",color:MUTED,fontSize:13}}>加载数据...</div>
        ) : periodData.length===0 ? (
          <div style={{height:300,display:"flex",alignItems:"center",
            justifyContent:"center",color:MUTED,fontSize:13}}>暂无数据</div>
        ) : (
          <ReturnChart key={`${chartMode}-${showField}-${period}-${rangeIdx}`}
            data={periodData} mode={chartMode} showField={showField} height={300}/>
        )}
      </div>

      {/* 同期对比 */}
      <div style={{background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:16,
        padding:"20px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <SectionTitle text="同期与指数对比"/>
        {loading ? (
          <div style={{height:280,display:"flex",alignItems:"center",
            justifyContent:"center",color:MUTED,fontSize:13}}>加载数据...</div>
        ) : (
          <CompareChart pnlHistory={visiblePnl} indexHistory={visibleIndex} height={280}/>
        )}
      </div>
    </div>
  );
}
