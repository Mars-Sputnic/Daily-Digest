import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Config ─── */
const CAT = [
  { id: "work", l: "工作", c: "#8BC6A4" },
  { id: "ux_design", l: "体验设计", c: "#C4A4D4" },
  { id: "ai_learn", l: "AI学习", c: "#E8B87A" },
  { id: "invest_news", l: "投资资讯", c: "#89C4CB" },
  { id: "invest_learn", l: "投资知识", c: "#92B4DC" },
  { id: "entertainment", l: "娱乐", c: "#E8A0A0" },
];
const TYP = [{ id: "browse", l: "浏览" }, { id: "produce", l: "生产" }, { id: "chat", l: "聊天" }];
const TODAY = new Date().toISOString().split("T")[0];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ─── Storage ─── */
async function ld() { try { const r = await window.storage.get("dd7"); return r ? JSON.parse(r.value) : {}; } catch { return {}; } }
async function sv(d) { try { await window.storage.set("dd7", JSON.stringify(d)); } catch {} }
async function ldCfg() { try { const r = await window.storage.get("dd7-cfg"); return r ? JSON.parse(r.value) : {}; } catch { return {}; } }
async function svCfg(c) { try { await window.storage.set("dd7-cfg", JSON.stringify(c)); } catch {} }

/* ─── Helpers ─── */
function Lnk({ text }) {
  const re = /(https?:\/\/[^\s]+|(?:[\w-]+\.)+(?:com|cn|org|net|io|ai|pe|dev)(?:\/[^\s]*)?)/g;
  const parts = []; let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const u = m[0], h = u.startsWith("http") ? u : `https://${u}`;
    parts.push(<a key={m.index} href={h} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#5B8FB9", textDecoration: "none", borderBottom: "1px solid #B8D4E3" }}>{u}</a>);
    last = m.index + u.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function fmtDur(min) {
  if (!min && min !== 0) return "";
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), rm = min % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

/* ─── AI Generate Logic ─── */
async function fetchScreenpipe(dateStr, spUrl) {
  const url = `${spUrl}/search?q=&limit=200&start_time=${dateStr}T00:00:00Z&end_time=${dateStr}T23:59:59Z&content_type=ocr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Screenpipe returned ${res.status}`);
  const json = await res.json();
  return json;
}

function buildPrompt(spData, cats) {
  // Deduplicate and summarize by app+window
  const seen = new Map();
  (spData.data || []).forEach(d => {
    if (d.type !== "OCR" || !d.content) return;
    const { app_name, window_name, text, timestamp } = d.content;
    if (!app_name || !text || text.trim().length < 10) return;
    const key = `${app_name}||${window_name || ""}`;
    if (!seen.has(key)) seen.set(key, { app: app_name, win: window_name || "", texts: [], times: [] });
    const entry = seen.get(key);
    if (entry.texts.join("").length < 2000) entry.texts.push(text.slice(0, 500));
    entry.times.push(timestamp);
  });

  const summary = [...seen.values()].map(e => {
    const tStart = e.times[0], tEnd = e.times[e.times.length - 1];
    return `[${e.app}] ${e.win}\nTime: ${tStart} ~ ${tEnd} (${e.times.length} frames)\nContent: ${e.texts.slice(0, 3).join(" | ").slice(0, 600)}`;
  }).join("\n---\n");

  const catList = cats.map(c => c.id + "=" + c.l).join(", ");

  return `You are a personal knowledge distillation assistant. Analyze the following screen recording data from today and produce a structured JSON array of activity entries.

Categories: ${catList}
Types: browse, produce, chat

For each distinct activity, output:
{
  "title": "short title",
  "cat": "category_id",
  "typ": "browse|produce|chat",
  "dur": estimated_minutes_number,
  "sum": "1-2 sentence summary",
  "take": "core takeaway / conclusion",
  "res": "important URLs or resources, one per line",
  "todo": "follow-up items, one per line",
  "time": "approximate time like 下午/17:30/凌晨"
}

Rules:
- Merge related frames into single activities (e.g. multiple Chrome frames on same site = one activity)
- Estimate duration from frame count and time range
- Skip system UI noise (control center, dock, menu bar, empty frames)
- Write all text fields in Chinese
- Return ONLY a JSON array, no markdown fences, no explanation

Screen data (${spData.pagination?.total || 0} total frames, showing ${seen.size} unique windows):

${summary}`;
}

async function callClaudeAPI(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "";
  // Parse JSON from response
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

/* ─── 24h Timeline ─── */
function TimelineBar({ entries }) {
  const totalMin = 24 * 60;
  const byCat = {};
  CAT.forEach(c => { byCat[c.id] = 0; });
  entries.forEach(e => { if (e.dur && byCat[e.cat] !== undefined) byCat[e.cat] += e.dur; });
  const tracked = Object.values(byCat).reduce((a, b) => a + b, 0);
  const segments = CAT.filter(c => byCat[c.id] > 0);
  return (
    <div style={{ marginTop: 14, marginBottom: 2 }}>
      <div style={{ display: "flex", height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
        {segments.map(c => <div key={c.id} style={{ width: `${(byCat[c.id] / totalMin) * 100}%`, background: c.c, transition: "width .3s" }} title={`${c.l} ${fmtDur(byCat[c.id])}`} />)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
        {segments.map(c => (
          <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#666" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.c, display: "inline-block" }} />{c.l} {fmtDur(byCat[c.id])}
          </span>
        ))}
        {tracked < totalMin && <span style={{ fontSize: 11, color: "#ccc" }}>空闲 {fmtDur(totalMin - tracked)}</span>}
      </div>
    </div>
  );
}

/* ─── Date Picker ─── */
function DatePicker({ value, onChange, onClose }) {
  const [vy, setVy] = useState(() => +value.slice(0, 4));
  const [vm, setVm] = useState(() => +value.slice(5, 7) - 1);
  const ref = useRef();
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [onClose]);
  const dim = new Date(vy, vm + 1, 0).getDate(), fd = new Date(vy, vm, 1).getDay();
  const days = []; for (let i = 0; i < fd; i++) days.push(null); for (let i = 1; i <= dim; i++) days.push(i);
  const pick = d => { onChange(`${vy}-${String(vm+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`); onClose(); };
  const sd = +value.slice(8,10), smn = +value.slice(5,7)-1, sy = +value.slice(0,4);
  const td = +TODAY.slice(8,10), tmn = +TODAY.slice(5,7)-1, ty = +TODAY.slice(0,4);
  return (
    <div ref={ref} style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 200, background: "#fff", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.05)", padding: 12, width: 252, userSelect: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => { if (vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#999", padding: "2px 6px" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{vy}年{vm+1}月</span>
        <button onClick={() => { if (vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#999", padding: "2px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, textAlign: "center" }}>
        {["日","一","二","三","四","五","六"].map(d => <div key={d} style={{ fontSize: 10, color: "#bbb", padding: "4px 0" }}>{d}</div>)}
        {days.map((d,i) => { if (!d) return <div key={`e${i}`}/>; const iS=d===sd&&vm===smn&&vy===sy, iT=d===td&&vm===tmn&&vy===ty;
          return <div key={i} onClick={()=>pick(d)} style={{ fontSize:12,padding:"5px 0",borderRadius:6,cursor:"pointer",fontWeight:iS||iT?700:400,color:iS?"#fff":iT?"#5B8FB9":"#333",background:iS?"#1a1a1a":"transparent" }}
            onMouseEnter={e=>{if(!iS)e.currentTarget.style.background="#f5f5f5"}} onMouseLeave={e=>{if(!iS)e.currentTarget.style.background="transparent"}}>{d}</div>; })}
      </div>
    </div>
  );
}

/* ─── Row ─── */
function Row({ e, onDel, onEdit }) {
  const c = CAT.find(x => x.id === e.cat) || CAT[0];
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid #f5f5f5" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.c, minWidth: 52, flexShrink: 0 }}>{c.l}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", flex: 1, lineHeight: 1.35 }}>{e.title}</span>
        {e.dur > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: "#999", background: "#f5f5f5", padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>{fmtDur(e.dur)}</span>}
        <span style={{ fontSize: 11, color: "#ccc", flexShrink: 0 }}>{e.time}</span>
        <span onClick={ev => { ev.stopPropagation(); onEdit(e); }} style={{ fontSize: 11, color: "#ddd", cursor: "pointer", flexShrink: 0 }}>编辑</span>
      </div>
      <div style={{ paddingLeft: 60, marginTop: 2 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "#999", lineHeight: 1.5 }}>{e.sum}</p>
      </div>
      {e.take && <div style={{ paddingLeft: 60, marginTop: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#bbb" }}>结论 </span>
        <span style={{ fontSize: 12.5, color: "#1a1a1a", lineHeight: 1.5 }}>{e.take}</span>
      </div>}
      {open && <div style={{ paddingLeft: 60, marginTop: 5, display: "flex", flexDirection: "column", gap: 3 }}>
        {e.res && <div><span style={{ fontSize: 11, fontWeight: 700, color: "#89C4CB" }}>资料 </span><span style={{ fontSize: 12, color: "#666" }}>{e.res.split("\n").map((l,i) => <span key={i}>{i > 0 && " · "}<Lnk text={l} /></span>)}</span></div>}
        {e.todo && <div><span style={{ fontSize: 11, fontWeight: 700, color: "#8BC6A4" }}>TODO </span><span style={{ fontSize: 12, color: "#666" }}>{e.todo.split("\n").join(" · ")}</span></div>}
        <span onClick={() => onDel(e.id)} style={{ fontSize: 11, color: "#e0e0e0", cursor: "pointer", marginTop: 2 }}>删除</span>
      </div>}
    </div>
  );
}

/* ─── Form ─── */
function Form({ init, onSave, onCancel }) {
  const [f, setF] = useState(init
    ? { title:init.title||"",sum:init.sum||"",take:init.take||"",res:init.res||"",todo:init.todo||"",cat:init.cat||"work",typ:init.typ||"browse",dur:init.dur??"" }
    : { title:"",sum:"",take:"",res:"",todo:"",cat:"work",typ:"browse",dur:"" });
  const s = k => v => setF(p => ({ ...p, [k]: typeof v==="string"?v:v.target.value }));
  const inp = { width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #e8e8e8",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" };
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.25)",backdropFilter:"blur(4px)" }} onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:12,padding:"24px 28px",width:"min(440px,90vw)",maxHeight:"85vh",overflowY:"auto" }}>
        <h3 style={{ margin:"0 0 16px",fontSize:16,fontWeight:700 }}>{init?"编辑":"新增"}</h3>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:10 }}>
          {CAT.map(c => <span key={c.id} onClick={()=>s("cat")(c.id)} style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,cursor:"pointer",color:f.cat===c.id?"#fff":c.c,background:f.cat===c.id?c.c:"transparent",border:`1px solid ${f.cat===c.id?c.c:"#e8e8e8"}`,transition:"all .12s" }}>{c.l}</span>)}
        </div>
        <div style={{ display:"flex",gap:6,marginBottom:14 }}>
          {TYP.map(t => <span key={t.id} onClick={()=>s("typ")(t.id)} style={{ fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:4,cursor:"pointer",color:f.typ===t.id?"#fff":"#aaa",background:f.typ===t.id?"#bbb":"transparent",border:`1px solid ${f.typ===t.id?"#bbb":"#e8e8e8"}`,transition:"all .12s" }}>{t.l}</span>)}
        </div>
        {[{k:"title",l:"标题",p:"简要描述",t:"input"},{k:"sum",l:"摘要",p:"核心信息",r:2},{k:"take",l:"结论",p:"最重要的收获",r:2},{k:"res",l:"资料",p:"链接",r:1},{k:"todo",l:"TODO",p:"每行一条",r:2}].map(x=>(
          <div key={x.k} style={{marginBottom:10}}>
            <div style={{fontSize:11,color:"#bbb",fontWeight:600,marginBottom:2}}>{x.l}</div>
            {x.t==="input"?<input style={inp} placeholder={x.p} value={f[x.k]} onChange={s(x.k)}/>:<textarea style={{...inp,minHeight:x.r*24,resize:"vertical"}} placeholder={x.p} value={f[x.k]} onChange={s(x.k)}/>}
          </div>
        ))}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:"#bbb",fontWeight:600,marginBottom:2}}>耗时（分钟）</div>
          <input style={{...inp,width:100}} type="number" placeholder="30" value={f.dur} onChange={e=>setF(p=>({...p,dur:e.target.value===""?"":parseInt(e.target.value)||0}))}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
          <button onClick={onCancel} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #e8e8e8",background:"#fff",fontSize:13,cursor:"pointer",color:"#aaa",fontFamily:"inherit"}}>取消</button>
          <button onClick={()=>{if(f.title.trim())onSave(f)}} style={{padding:"8px 20px",borderRadius:6,border:"none",background:f.title.trim()?"#1a1a1a":"#e0e0e0",color:"#fff",fontSize:13,fontWeight:600,cursor:f.title.trim()?"pointer":"default",fontFamily:"inherit"}}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Panel ─── */
function Settings({ cfg, onSave, onClose }) {
  const [spUrl, setSpUrl] = useState(cfg.screenpipeUrl || "http://localhost:3030");
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.25)",backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:12,padding:"24px 28px",width:"min(400px,90vw)" }}>
        <h3 style={{ margin:"0 0 16px",fontSize:16,fontWeight:700 }}>设置</h3>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#bbb",fontWeight:600,marginBottom:4}}>Screenpipe 地址</div>
          <input value={spUrl} onChange={e=>setSpUrl(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #e8e8e8",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}} placeholder="http://localhost:3030"/>
          <div style={{fontSize:11,color:"#ccc",marginTop:4}}>确保 Screenpipe 正在运行（终端执行 screenpipe）</div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onClose} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #e8e8e8",background:"#fff",fontSize:13,cursor:"pointer",color:"#aaa",fontFamily:"inherit"}}>取消</button>
          <button onClick={()=>{onSave({screenpipeUrl:spUrl});onClose()}} style={{padding:"8px 20px",borderRadius:6,border:"none",background:"#1a1a1a",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>保存</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function App() {
  const [data, setData] = useState({});
  const [cfg, setCfg] = useState({});
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(TODAY);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [fc, setFc] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [genState, setGenState] = useState("idle"); // idle | fetching | analyzing | done | error
  const [genMsg, setGenMsg] = useState("");

  useEffect(() => {
    Promise.all([ld(), ldCfg()]).then(([d, c]) => { setData(d); setCfg(c); setLoading(false); });
  }, []);

  const persist = useCallback(async nd => { setData(nd); await sv(nd); }, []);
  const saveCfg = useCallback(async nc => { setCfg(nc); await svCfg(nc); }, []);

  const all = data[date] || [];
  const entries = all.filter(e => !fc || e.cat === fc).sort((a, b) => (b.ts||0) - (a.ts||0));
  const byCat = {}; CAT.forEach(c => { byCat[c.id] = 0; }); all.forEach(e => { if (byCat[e.cat] !== undefined) byCat[e.cat]++; });

  function handleSave(f) { const nd = {...data}; if(!nd[date]) nd[date]=[]; if(edit){nd[date]=nd[date].map(e=>e.id===edit.id?{...e,...f}:e)}else{nd[date]=[{...f,id:uid(),ts:Date.now(),time:new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})},...nd[date]]} persist(nd); setShowForm(false); setEdit(null); }
  function handleDel(id) { const nd={...data}; nd[date]=(nd[date]||[]).filter(e=>e.id!==id); persist(nd); }

  /* ─── Auto Generate ─── */
  async function handleGenerate() {
    const spUrl = cfg.screenpipeUrl || "http://localhost:3030";
    try {
      setGenState("fetching");
      setGenMsg("正在从 Screenpipe 拉取屏幕数据...");

      let spData;
      try {
        spData = await fetchScreenpipe(date, spUrl);
      } catch (err) {
        setGenState("error");
        setGenMsg(`无法连接 Screenpipe (${spUrl})。请确保 Screenpipe 正在运行，或在设置中修改地址。`);
        return;
      }

      const totalFrames = spData.pagination?.total || 0;
      if (totalFrames === 0) {
        setGenState("error");
        setGenMsg("Screenpipe 没有找到当天的屏幕数据。确保 Screenpipe 正在运行且有录制记录。");
        return;
      }

      setGenState("analyzing");
      setGenMsg(`已获取 ${totalFrames} 条数据，AI 分析中...`);

      const prompt = buildPrompt(spData, CAT);
      let results;
      try {
        results = await callClaudeAPI(prompt);
      } catch (err) {
        setGenState("error");
        setGenMsg(`AI 分析失败: ${err.message}`);
        return;
      }

      if (!Array.isArray(results) || results.length === 0) {
        setGenState("error");
        setGenMsg("AI 未返回有效结果，请重试。");
        return;
      }

      // Save results
      const nd = { ...data };
      if (!nd[date]) nd[date] = [];
      const existing = nd[date].filter(e => !e.id?.startsWith("ai_"));
      const newEntries = results.map((r, i) => ({
        id: `ai_${Date.now()}_${i}`,
        title: r.title || "未命名",
        cat: CAT.find(c => c.id === r.cat) ? r.cat : "work",
        typ: r.typ || "browse",
        dur: typeof r.dur === "number" ? r.dur : 0,
        sum: r.sum || "",
        take: r.take || "",
        res: r.res || "",
        todo: r.todo || "",
        time: r.time || "",
        ts: Date.now() + i,
      }));
      nd[date] = [...newEntries, ...existing];
      await persist(nd);

      setGenState("done");
      setGenMsg(`已生成 ${newEntries.length} 条记录（基于 ${totalFrames} 条屏幕数据）`);
      setTimeout(() => setGenState("idle"), 4000);

    } catch (err) {
      setGenState("error");
      setGenMsg(`生成失败: ${err.message}`);
    }
  }

  const dStr = new Date(date+"T00:00:00").toLocaleDateString("zh-CN",{month:"numeric",day:"numeric",weekday:"short"});
  const isToday = date === TODAY;

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><span style={{color:"#ccc"}}>加载中</span></div>;

  return (
    <div style={{ minHeight:"100vh",background:"#fff",fontFamily:"-apple-system,'PingFang SC','Helvetica Neue',sans-serif",color:"#1a1a1a" }}>
      <div style={{ maxWidth:640,margin:"0 auto",padding:"20px 20px 100px" }}>

        {/* Row 1: Date + settings + today */}
        <div style={{ display:"flex",alignItems:"center",gap:6,position:"relative" }}>
          <button onClick={()=>setDate(p=>{const d=new Date(p);d.setDate(d.getDate()-1);return d.toISOString().split("T")[0]})} style={{border:"none",background:"none",fontSize:14,cursor:"pointer",color:"#ddd",padding:0}}>‹</button>
          <span onClick={()=>setShowPicker(p=>!p)} style={{fontSize:15,fontWeight:700,cursor:"pointer",borderBottom:"1.5px dashed #e0e0e0",paddingBottom:1}}>{dStr}</span>
          <button onClick={()=>setDate(p=>{const d=new Date(p);d.setDate(d.getDate()+1);return d.toISOString().split("T")[0]})} style={{border:"none",background:"none",fontSize:14,cursor:"pointer",color:"#ddd",padding:0}}>›</button>
          {showPicker && <DatePicker value={date} onChange={setDate} onClose={()=>setShowPicker(false)}/>}
          <div style={{flex:1}}/>
          <span onClick={()=>setShowSettings(true)} style={{fontSize:11,color:"#ddd",cursor:"pointer"}}>设置</span>
          {!isToday && <span onClick={()=>setDate(TODAY)} style={{fontSize:11,color:"#5B8FB9",cursor:"pointer",fontWeight:500}}>今天</span>}
        </div>

        {/* Generate Button / Status */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleGenerate}
            disabled={genState === "fetching" || genState === "analyzing"}
            style={{
              padding: "6px 16px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", cursor: genState === "fetching" || genState === "analyzing" ? "wait" : "pointer",
              color: "#fff",
              background: genState === "fetching" || genState === "analyzing" ? "#ccc"
                : genState === "error" ? "#E8A0A0"
                : genState === "done" ? "#8BC6A4"
                : "#1a1a1a",
              transition: "background .2s",
            }}
          >
            {genState === "fetching" ? "拉取数据中..." : genState === "analyzing" ? "AI 分析中..." : genState === "done" ? "✓ 生成完成" : genState === "error" ? "重试" : "⚡ 生成今日记录"}
          </button>
          {genMsg && genState !== "idle" && (
            <span style={{ fontSize: 11, color: genState === "error" ? "#dc2626" : genState === "done" ? "#16a34a" : "#999", flex: 1 }}>{genMsg}</span>
          )}
        </div>

        {/* 24h Timeline */}
        <TimelineBar entries={all} />

        {/* Row 2: Filters + stats */}
        <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:14,flexWrap:"wrap" }}>
          <span onClick={()=>setFc(null)} style={{fontSize:11,fontWeight:600,padding:"1px 7px",borderRadius:3,cursor:"pointer",color:!fc?"#fff":"#bbb",background:!fc?"#ccc":"transparent",transition:"all .12s"}}>全部</span>
          {CAT.map(c => byCat[c.id]>0 && <span key={c.id} onClick={()=>setFc(fc===c.id?null:c.id)} style={{fontSize:11,fontWeight:600,padding:"1px 7px",borderRadius:3,cursor:"pointer",color:fc===c.id?"#fff":c.c,background:fc===c.id?c.c:"transparent",transition:"all .12s"}}>{c.l} {byCat[c.id]}</span>)}
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:"#ccc"}}>{all.length}条</span>
          <span style={{fontSize:11,color:"#ddd"}}>·</span>
          <span style={{fontSize:11,color:"#bbb"}}>{all.filter(e=>e.take).length}结论</span>
          <span style={{fontSize:11,color:"#ddd"}}>·</span>
          <span style={{fontSize:11,color:"#8BC6A4"}}>{all.filter(e=>e.todo).length}待办</span>
        </div>

        <div style={{borderBottom:"1px solid #f5f5f5",marginTop:10}}/>

        {entries.length === 0
          ? <div style={{textAlign:"center",padding:"40px 0",color:"#e0e0e0"}}>
              <p style={{fontSize:13,margin:"0 0 8px"}}>{fc ? "该分类下没有记录" : "没有记录"}</p>
              {!fc && <p style={{fontSize:12,color:"#ccc",margin:0}}>点击上方「⚡ 生成今日记录」自动从 Screenpipe 生成</p>}
            </div>
          : entries.map(e => <Row key={e.id} e={e} onDel={handleDel} onEdit={x=>{setEdit(x);setShowForm(true)}} />)
        }
      </div>

      <button onClick={()=>{setEdit(null);setShowForm(true)}} style={{position:"fixed",bottom:24,right:24,width:44,height:44,borderRadius:10,background:"#1a1a1a",color:"#fff",border:"none",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 10px rgba(0,0,0,.1)",zIndex:99}}>+</button>
      {showForm && <Form init={edit} onSave={handleSave} onCancel={()=>{setShowForm(false);setEdit(null)}}/>}
      {showSettings && <Settings cfg={cfg} onSave={saveCfg} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}
