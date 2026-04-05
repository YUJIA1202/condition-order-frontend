// src/pages/Condition.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { getConditions, addCondition, deleteCondition } from "../api/index";

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

const INDEX_OPTIONS = [
  { code:"000001.SH", name:"上证指数" },
  { code:"399001.SZ", name:"深证成指" },
  { code:"399006.SZ", name:"创业板指" },
  { code:"688000.SH", name:"科创50"  },
  { code:"899050.BJ", name:"北证50"  },
];

const ETF_OPTIONS = [
  { code:"510300", name:"沪深300ETF" },
  { code:"510500", name:"中证500ETF" },
  { code:"159915", name:"创业板ETF"  },
  { code:"588000", name:"科创50ETF"  },
  { code:"512000", name:"券商ETF"    },
  { code:"512800", name:"银行ETF"    },
];

export default function ConditionPage({ indices, triggered, t }) {
  const [conditions, setConditions] = useState([]);
  const [form, setForm] = useState({
    index_code:"000001.SH", op:"lte", price:"", action:"buy", etf_code:"510300", qty:"",
  });
  const [leftPct, setLeftPct] = useState(50);
  const containerRef = useRef();
  const isDragging = useRef(false);

  const inp = {
    background:t.surface, border:`1px solid ${t.border}`, borderRadius:6,
    color:t.text, padding:"8px 12px", fontSize:15, outline:"none",
    fontFamily:"monospace", width:"100%", boxSizing:"border-box",
  };

  const onDividerMouseDown = useCallback(e => {
    e.preventDefault();
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const onMove = e => {
      if(!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = clamp((e.clientX - rect.left) / rect.width * 100, 25, 75);
      setLeftPct(pct);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    getConditions().then(setConditions).catch(console.error);
  }, []);

  useEffect(() => {
    if(triggered.length > 0) {
      getConditions().then(setConditions).catch(console.error);
    }
  }, [triggered]);

  const handleAdd = async () => {
    if(!form.price || !form.qty) return;
    try {
      await addCondition({
        ...form,
        price: parseFloat(form.price),
        qty:   parseInt(form.qty),
      });
      setForm({ index_code:"000001.SH", op:"lte", price:"", action:"buy", etf_code:"510300", qty:"" });
      getConditions().then(setConditions);
    } catch(e) { console.error(e); }
  };

  const handleDelete = async (cid) => {
    await deleteCondition(cid);
    setConditions(prev => prev.filter(c => c.id !== cid));
  };

  const priceMap = Object.fromEntries(indices.map(i => [i.code, i.price]));

  return (
    <div ref={containerRef} style={{
      padding:"20px 24px", display:"flex",
      gap:0, position:"relative", alignItems:"flex-start",
    }}>

      {/* ── 左栏 ── */}
      <div style={{width:`${leftPct}%`, paddingRight:8, flexShrink:0,
        display:"flex", flexDirection:"column", gap:12}}>

        {/* 当前指数参考 */}
        <div style={{background:t.card, border:`1px solid ${t.border}`,
          borderRadius:10, padding:"12px 16px"}}>
          <div style={{fontSize:12,color:t.muted,letterSpacing:2,marginBottom:8}}>当前指数</div>
          <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
            {INDEX_OPTIONS.map(idx => (
              <div key={idx.code} style={{background:t.surface,
                borderRadius:6, padding:"4px 10px"}}>
                <span style={{fontSize:13,color:t.muted}}>{idx.name} </span>
                <span style={{fontSize:15,fontFamily:"monospace",
                  fontWeight:700,color:t.text}}>
                  {priceMap[idx.code] ? Number(priceMap[idx.code]).toFixed(2) : "--"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 新建条件单 */}
        <div style={{background:t.card, border:`1px solid ${t.border}`,
          borderRadius:10, padding:16}}>
          <div style={{fontSize:12,color:t.muted,letterSpacing:2,marginBottom:14}}>
            新建条件单
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 90px", gap:8}}>
              <div>
                <div style={{fontSize:13,color:t.muted,marginBottom:4}}>触发指数</div>
                <select style={inp} value={form.index_code}
                  onChange={e=>setForm(p=>({...p,index_code:e.target.value}))}>
                  {INDEX_OPTIONS.map(i=>(
                    <option key={i.code} value={i.code}>{i.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{fontSize:13,color:t.muted,marginBottom:4}}>条件</div>
                <select style={inp} value={form.op}
                  onChange={e=>setForm(p=>({...p,op:e.target.value}))}>
                  <option value="lte">≤</option>
                  <option value="gte">≥</option>
                </select>
              </div>
            </div>
            <div>
              <div style={{fontSize:13,color:t.muted,marginBottom:4}}>触发点位</div>
              <input style={inp} type="number" placeholder="输入点位..."
                value={form.price}
                onChange={e=>setForm(p=>({...p,price:e.target.value}))}/>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <div>
                <div style={{fontSize:13,color:t.muted,marginBottom:4}}>操作</div>
                <select style={inp} value={form.action}
                  onChange={e=>setForm(p=>({...p,action:e.target.value}))}>
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:13,color:t.muted,marginBottom:4}}>数量（手）</div>
                <input style={inp} type="number" placeholder="1000"
                  value={form.qty}
                  onChange={e=>setForm(p=>({...p,qty:e.target.value}))}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:13,color:t.muted,marginBottom:4}}>标的ETF</div>
              <select style={inp} value={form.etf_code}
                onChange={e=>setForm(p=>({...p,etf_code:e.target.value}))}>
                {ETF_OPTIONS.map(e=>(
                  <option key={e.code} value={e.code}>
                    {e.name}（{e.code}）
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleAdd} style={{
              marginTop:4, padding:"10px", background:t.accent, border:"none",
              borderRadius:7, color:"#fff", fontSize:15, cursor:"pointer",
              fontFamily:"monospace", fontWeight:700,
            }}>＋ 添加条件单</button>
          </div>
        </div>

        {/* 条件单列表 */}
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {conditions.length === 0
            ? <div style={{color:t.muted,fontSize:15,textAlign:"center",padding:20}}>
                暂无条件单
              </div>
            : conditions.map(c => (
              <div key={c.id} style={{
                background:t.card,
                border:`1px solid ${c.triggered?t.pos+"66":t.border}`,
                borderRadius:10, padding:"12px 14px",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,color:c.triggered?t.pos:t.accent}}>
                    {c.triggered ? "✓ 已触发" : "● 监控中"}
                  </span>
                  <button onClick={()=>handleDelete(c.id)} style={{
                    background:"none", border:"none", color:t.muted,
                    cursor:"pointer", fontSize:13, fontFamily:"monospace",
                  }}>删除</button>
                </div>
                <div style={{fontSize:15,color:t.text,fontFamily:"monospace"}}>
                  {INDEX_OPTIONS.find(i=>i.code===c.index_code)?.name}
                  <span style={{color:t.warn}}>
                    {" "}{c.op==="lte"?"≤":"≥"} {c.price}
                  </span>
                </div>
                <div style={{fontSize:14,color:t.sub,marginTop:4}}>
                  → <span style={{color:c.action==="buy"?t.pos:t.neg}}>
                    {c.action==="buy"?"买入":"卖出"}
                  </span> {c.etf_code} · {c.qty}手
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── 拖拽分割线 ── */}
      <div onMouseDown={onDividerMouseDown} style={{
        width:14, flexShrink:0, cursor:"col-resize",
        display:"flex", alignItems:"stretch",
        justifyContent:"center", alignSelf:"stretch",
        minHeight:400, padding:"0 4px",
      }}>
        <div style={{
          width:3, borderRadius:3,
          background:t.border, transition:"background 0.15s",
        }}
        onMouseEnter={e=>e.currentTarget.style.background=t.accent}
        onMouseLeave={e=>e.currentTarget.style.background=t.border}/>
      </div>

      {/* ── 右栏 ── */}
      <div style={{flex:1, paddingLeft:8}}>
        <div style={{background:t.card, border:`1px solid ${t.border}`,
          borderRadius:10, padding:16}}>
          <div style={{fontSize:12,color:t.muted,letterSpacing:3,marginBottom:14}}>
            触发日志
          </div>
          {triggered.length === 0
            ? <div style={{color:t.muted,fontSize:15,textAlign:"center",marginTop:20}}>
                等待条件触发...
              </div>
            : triggered.map((item,i) => (
              <div key={i} style={{
                fontSize:14, color:t.pos, fontFamily:"monospace",
                padding:"10px 14px", background:t.surface, borderRadius:6,
                borderLeft:`3px solid ${t.pos}`, marginBottom:8,
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