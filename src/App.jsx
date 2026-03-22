import { useState, useEffect, useCallback } from "react";
import { Undo2, Edit3, Check } from "lucide-react";
import { sSet, sGet, sList } from "./firebase.js";

const DEFAULT_ROSTER = [
  { id:"p1",name:"Garland",number:0,position:"Goalie",active:true },
  { id:"p2",name:"Rewkowski",number:2,position:"Midfield",active:true },
  { id:"p3",name:"Hammond",number:3,position:"Attack/Midfield",active:true },
  { id:"p4",name:"Sunderland",number:5,position:"Defense",active:true },
  { id:"p5",name:"Oliver",number:6,position:"Attack/Midfield",active:true },
  { id:"p6",name:"Jenkins",number:7,position:"Defense",active:true },
  { id:"p7",name:"Warfield",number:8,position:"Attack",active:true },
  { id:"p8",name:"Bissel",number:9,position:"Goalie",active:true },
  { id:"p9",name:"Trader",number:12,position:"Defense",active:true },
  { id:"p10",name:"Markwort",number:13,position:"Midfield",active:true },
  { id:"p11",name:"Stadler",number:16,position:"Midfield",active:true },
  { id:"p12",name:"Archfield",number:17,position:"Midfield",active:true },
  { id:"p13",name:"Merchlinski",number:24,position:"Midfield",active:true },
  { id:"p14",name:"Calabrese",number:29,position:"Midfield",active:true },
  { id:"p15",name:"Hogg",number:32,position:"LSM",active:true },
  { id:"p16",name:"Schlegal",number:37,position:"Attack/Midfield",active:true },
  { id:"p17",name:"Miles",number:52,position:"LSM",active:true },
  { id:"p18",name:"Meehan",number:64,position:"Defense",active:true },
  { id:"p19",name:"Stallings",number:88,position:"Attack/Midfield",active:true },
  { id:"p20",name:"Severn",number:88,position:"Midfield",active:true },
  { id:"p21",name:"Frounfelker",number:93,position:"Defense",active:true },
  { id:"p22",name:"Homan",number:99,position:"Defense",active:true },
];

const POSITIONS = ["Attack","Attack/Midfield","Midfield","Defense","LSM","Goalie"];
const LOGO_URLS = ["https://lh3.googleusercontent.com/d/1fH_A8GPBN3SDjg54CMtH_D7WLKGeSmQW","https://drive.google.com/thumbnail?id=1fH_A8GPBN3SDjg54CMtH_D7WLKGeSmQW&sz=w400"];

const genId = () => Math.random().toString(36).substr(2,8);
const isDef = (p) => p.position==="Defense"||p.position==="LSM";
const sortByNum = (r) => [...r].sort((a,b)=>a.number-b.number);
const posGroup = (p) => { if(p.position==="Goalie") return 2; if(isDef(p)) return 1; return 0; };
const sortForStats = (r) => [...r].sort((a,b)=>posGroup(a)-posGroup(b)||a.number-b.number);
const pctFn = (n,d) => d===0?"-":((n/d)*100).toFixed(1)+"%";
const todayStr = () => new Date().toISOString().split("T")[0];
const posAbbr = (p) => { const m={"Attack":"A","Attack/Midfield":"A/M","Midfield":"M","Defense":"Def","LSM":"LSM","Goalie":"G"}; return m[p]||p; };
const fmtTime = (ts) => { if(!ts) return ""; const d=new Date(ts); return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}); };

function applyOverrides(playerStats, overrides) {
  if(!overrides||Object.keys(overrides).length===0) return playerStats;
  const result={...playerStats};
  Object.entries(overrides).forEach(([k,v])=>{ if(result[k]) result[k]={...result[k],...v}; });
  return result;
}

// Compute per-recorder stats from raw events (used for recorder table view)
function computeRecorderStats(recData, roster) {
  const ps={};
  roster.forEach(p=>{const k=p.name+"-"+p.number;ps[k]={name:p.name,number:p.number,position:p.position,goals:0,assists:0,shotsOnGoal:0,shotsMissed:0,groundballs:0,cto:0,saves:0,shotsAgainst:0,goalsAgainst:0,faceoffsTaken:0,faceoffsWon:0,penalties:0};});
  const stats=recData.stats||[];
  stats.forEach(s=>{
    if(s.type==="Goals"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].goals++;}
    if(s.type==="Assists"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].assists++;}
    if(s.type==="Shot on Goal"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].shotsOnGoal++;}
    if(s.type==="Shot Missed"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].shotsMissed++;}
    if(s.type==="Groundballs"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].groundballs++;}
    if(s.type==="Turnovers Caused"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].cto++;}
    if(s.type==="Penalty"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].penalties++;}
    if(s.type==="Faceoffs Won"&&s.player){const k=s.player+"-"+s.number;if(ps[k]){ps[k].faceoffsTaken++;ps[k].faceoffsWon++;}}
    if(s.type==="Faceoffs Lost"&&s.player){const k=s.player+"-"+s.number;if(ps[k])ps[k].faceoffsTaken++;}
    if((s.type==="Save"||s.type==="Goal Against"||s.type==="Opponent Shot Miss")&&s.goalie){
      const gp=roster.find(x=>x.name===s.goalie);
      if(gp){const k=gp.name+"-"+gp.number;if(ps[k]){if(s.type==="Save")ps[k].saves++;else if(s.type==="Goal Against"){ps[k].goalsAgainst++;ps[k].shotsAgainst++;}ps[k].shotsAgainst++;}}
    }
  });
  // Fix shotsAgainst double-count: saves+GA+misses
  roster.forEach(p=>{if(p.position==="Goalie"){const k=p.name+"-"+p.number;if(ps[k]){const sv=stats.filter(s=>s.type==="Save"&&s.goalie===p.name).length;const ga=stats.filter(s=>s.type==="Goal Against"&&s.goalie===p.name).length;const ms=stats.filter(s=>s.type==="Opponent Shot Miss"&&s.goalie===p.name).length;ps[k].saves=sv;ps[k].goalsAgainst=ga;ps[k].shotsAgainst=sv+ga+ms;}}});
  // Apply tableOverrides if present
  if(recData.tableOverrides){Object.entries(recData.tableOverrides).forEach(([k,v])=>{if(ps[k])ps[k]={...ps[k],...v};});}
  return ps;
}

function mergeAllStats(rMap, roster) {
  const ps = {};
  roster.forEach((p) => {
    const k=p.name+"-"+p.number;
    if(!ps[k]) ps[k]={name:p.name,number:p.number,position:p.position,goals:0,assists:0,shotsOnGoal:0,shotsMissed:0,groundballs:0,cto:0,saves:0,shotsAgainst:0,goalsAgainst:0,faceoffsTaken:0,faceoffsWon:0,penalties:0};
  });

  // For each recorder, get their effective counts (tableOverrides if set, else raw counts)
  // Then apply MAX across recorders
  const fields=["goals","assists","shotsOnGoal","shotsMissed","groundballs","cto","saves","goalsAgainst","shotsAgainst","faceoffsTaken","faceoffsWon","penalties"];

  Object.values(rMap).forEach(recData=>{
    const recStats=computeRecorderStats(recData,roster);
    Object.entries(recStats).forEach(([k,p])=>{
      if(ps[k]){
        fields.forEach(f=>{
          if((p[f]||0)>ps[k][f]) ps[k][f]=p[f]||0;
        });
      }
    });
  });

  const totalGoals=Object.values(ps).reduce((s,p)=>s+(p.goals||0),0);
  const totalGA=Object.values(ps).reduce((s,p)=>s+(p.goalsAgainst||0),0);
  return{playerStats:ps,totalGoals,totalGA};
}

async function loadGameMerge(gId,roster){
  const keys=await sList("game:"+gId+":stats:");
  const rMap={},rNames=[];
  for(const k of keys){const nm=k.replace("game:"+gId+":stats:","");const d=await sGet(k);if(d&&!d.deleted){rMap[nm]=d;rNames.push(nm);}}
  return{merge:Object.keys(rMap).length?mergeAllStats(rMap,roster):null,recorders:rNames};
}

function LogoImg({size}){const sz=size||"lg";const[fail,setFail]=useState(false);const[idx,setIdx]=useState(0);const sc=sz==="sm"?"w-14 h-14":sz==="md"?"w-24 h-24":"w-32 h-32";const ts=sz==="sm"?"text-3xl":sz==="md"?"text-5xl":"text-7xl";if(fail)return(<div className="flex flex-col items-center"><div className={"font-black text-red-600 italic "+ts} style={{textShadow:"3px 3px 0 #000,-1px -1px 0 #FFD700",fontFamily:"Impact,Arial Black,sans-serif",letterSpacing:"-4px"}}>91</div>{sz==="lg"&&<div><h1 className="text-xl font-black text-black text-center">TEAM 91 MARYLAND</h1><div className="text-base font-bold text-red-600 text-center">2031</div></div>}</div>);return<img src={LOGO_URLS[idx]} alt="91" className={sc+" object-contain mx-auto"} onError={()=>{if(idx<LOGO_URLS.length-1)setIdx(idx+1);else setFail(true);}}/>;}
function Btn({children,onClick,cls,disabled}){return<button onClick={onClick} disabled={disabled} className={"active:scale-95 transition-all "+(cls||"")}>{children}</button>;}
function CopyBtn({label,doneLabel,cls}){const[d,setD]=useState(false);return<button onClick={async()=>{try{const el=document.getElementById("stats-table");const r=document.createRange();r.selectNode(el);window.getSelection().removeAllRanges();window.getSelection().addRange(r);document.execCommand("copy");window.getSelection().removeAllRanges();setD(true);setTimeout(()=>setD(false),2000);}catch(e){}}} className={"w-full py-3 rounded-lg font-black border-2 border-black active:scale-95 "+(d?"bg-green-600 text-white":"bg-blue-600 text-white")+" "+(cls||"")}>{d?doneLabel:label}</button>;}

function StatsTable({playerStats,tableId}){
  const id=tableId||"stats-table";
  const hd=["#","Player","Pos","G","A","Shots","SOG","Shot%","GB","CTO","FO","FOW","FO%","SAV","GA","SA","SV%","PEN"];
  const tt={goals:0,assists:0,shotsOnGoal:0,shotsMissed:0,groundballs:0,cto:0,saves:0,goalsAgainst:0,shotsAgainst:0,faceoffsTaken:0,faceoffsWon:0,penalties:0};
  const sorted=sortForStats(Object.values(playerStats));
  sorted.forEach((p)=>Object.keys(tt).forEach((k)=>{tt[k]+=(p[k]||0);}));
  const ttShots=tt.goals+tt.shotsOnGoal+tt.shotsMissed;const ttSOG=tt.goals+tt.shotsOnGoal;
  const C="p-2 text-center font-bold border border-gray-300";const CB="p-2 text-center border-2 border-black";
  return(
    <div className="overflow-x-auto"><table id={id} className="w-full text-sm border-2 border-black">
      <thead className="bg-red-600 text-white"><tr>{hd.map((h)=><th key={h} className={CB+" font-black"}>{h}</th>)}</tr></thead>
      <tbody>
        {sorted.map((p,i)=>{const shots=p.goals+(p.shotsOnGoal||0)+(p.shotsMissed||0);const sog=p.goals+(p.shotsOnGoal||0);return(
          <tr key={i} className={i%2===0?"bg-gray-50":"bg-white"}>
            <td className="p-2 font-black border border-gray-300">{p.number}</td>
            <td className="p-2 font-bold border border-gray-300">{p.name}</td>
            <td className="p-2 font-bold border border-gray-300">{posAbbr(p.position)}</td>
            <td className={C}>{p.goals||"-"}</td><td className={C}>{p.assists||"-"}</td>
            <td className={C}>{shots||"-"}</td><td className={C}>{sog||"-"}</td>
            <td className={C}>{pctFn(p.goals,shots)}</td><td className={C}>{p.groundballs||"-"}</td>
            <td className={C}>{p.cto||"-"}</td>
            <td className={C}>{p.faceoffsTaken||"-"}</td><td className={C}>{p.faceoffsWon||"-"}</td>
            <td className={C}>{pctFn(p.faceoffsWon||0,p.faceoffsTaken||0)}</td>
            <td className={C}>{p.saves||"-"}</td><td className={C}>{p.goalsAgainst||"-"}</td>
            <td className={C}>{p.shotsAgainst||"-"}</td>
            <td className={C}>{pctFn(p.saves||0,(p.saves||0)+(p.goalsAgainst||0))}</td>
            <td className={C}>{p.penalties||"-"}</td>
          </tr>);})}
        <tr className="bg-red-600 text-white font-black">
          <td className={CB} colSpan="3">TOTALS</td>
          <td className={CB}>{tt.goals}</td><td className={CB}>{tt.assists}</td>
          <td className={CB}>{ttShots}</td><td className={CB}>{ttSOG}</td><td className={CB}>{pctFn(tt.goals,ttShots)}</td>
          <td className={CB}>{tt.groundballs}</td><td className={CB}>{tt.cto}</td>
          <td className={CB}>{tt.faceoffsTaken}</td><td className={CB}>{tt.faceoffsWon}</td><td className={CB}>{pctFn(tt.faceoffsWon,tt.faceoffsTaken)}</td>
          <td className={CB}>{tt.saves}</td><td className={CB}>{tt.goalsAgainst}</td><td className={CB}>{tt.shotsAgainst}</td>
          <td className={CB}>{pctFn(tt.saves,tt.saves+tt.goalsAgainst)}</td><td className={CB}>{tt.penalties}</td>
        </tr>
      </tbody>
    </table></div>
  );
}

// ── Per-recorder editable stats table ──────────────────────────────────────
const EDITABLE_COLS=[
  {key:"goals",label:"G",w:"w-10"},
  {key:"assists",label:"A",w:"w-10"},
  {key:"shotsOnGoal",label:"SOG",w:"w-12"},
  {key:"shotsMissed",label:"Miss",w:"w-12"},
  {key:"groundballs",label:"GB",w:"w-10"},
  {key:"cto",label:"CTO",w:"w-10"},
  {key:"faceoffsTaken",label:"FO",w:"w-10"},
  {key:"faceoffsWon",label:"FOW",w:"w-12"},
  {key:"saves",label:"SAV",w:"w-10"},
  {key:"goalsAgainst",label:"GA",w:"w-10"},
  {key:"shotsAgainst",label:"SA",w:"w-10"},
  {key:"penalties",label:"PEN",w:"w-10"},
];

function RecorderEditableTable({recData, roster, onSave, onClearOverrides, hasOverrides}){
  const[local,setLocal]=useState(()=>computeRecorderStats(recData,roster));
  const[saved,setSaved]=useState(false);
  const sorted=sortForStats(Object.values(local));

  const setField=(pk,field,val)=>{
    setLocal(prev=>({...prev,[pk]:{...prev[pk],[field]:Math.max(0,parseInt(val)||0)}}));
  };

  const handleSave=async()=>{
    // Build tableOverrides: only store players with any non-zero stat
    const ovr={};
    Object.entries(local).forEach(([k,p])=>{
      const hasData=EDITABLE_COLS.some(({key})=>(p[key]||0)>0);
      if(hasData) ovr[k]={...p};
    });
    await onSave(ovr);
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  // Compute derived columns live
  const shots=(p)=>(p.goals||0)+(p.shotsOnGoal||0)+(p.shotsMissed||0);
  const sog=(p)=>(p.goals||0)+(p.shotsOnGoal||0);

  const totals=EDITABLE_COLS.reduce((acc,{key})=>{acc[key]=sorted.reduce((s,p)=>s+(local[p.name+"-"+p.number]?.[key]||0),0);return acc;},{});
  const totalShots=totals.goals+(totals.shotsOnGoal||0)+(totals.shotsMissed||0);
  const totalSOG=totals.goals+(totals.shotsOnGoal||0);

  const C="text-center border border-gray-300 text-xs";
  const CB="text-center border-2 border-black text-xs font-black";
  const inp="w-full text-center border border-gray-400 rounded font-black text-xs py-1 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";

  return(
    <div>
      {hasOverrides&&<div className="flex gap-2 mb-2 items-center">
        <span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-300 px-2 py-1 rounded">TABLE OVERRIDES ACTIVE</span>
        <button onClick={onClearOverrides} className="text-xs font-black text-orange-700 underline active:scale-95">Clear &amp; reset from raw stats</button>
      </div>}
      <p className="text-xs text-gray-500 font-bold mb-2">Edit any cell. Percentages update live. Hit SAVE to apply to merge.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-black">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-1 text-left border border-gray-600 font-black">#</th>
              <th className="p-1 text-left border border-gray-600 font-black">Player</th>
              <th className="p-1 border border-gray-600 font-black">G</th>
              <th className="p-1 border border-gray-600 font-black">A</th>
              <th className="p-1 border border-gray-600 font-black">Sh</th>
              <th className="p-1 border border-gray-600 font-black">SOG</th>
              <th className="p-1 border border-gray-600 font-black text-yellow-300">Sh%</th>
              <th className="p-1 border border-gray-600 font-black">GB</th>
              <th className="p-1 border border-gray-600 font-black">CTO</th>
              <th className="p-1 border border-gray-600 font-black">FO</th>
              <th className="p-1 border border-gray-600 font-black">FOW</th>
              <th className="p-1 border border-gray-600 font-black text-yellow-300">FO%</th>
              <th className="p-1 border border-gray-600 font-black">SAV</th>
              <th className="p-1 border border-gray-600 font-black">GA</th>
              <th className="p-1 border border-gray-600 font-black">SA</th>
              <th className="p-1 border border-gray-600 font-black text-yellow-300">SV%</th>
              <th className="p-1 border border-gray-600 font-black">PEN</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>{
              const pk=p.name+"-"+p.number;
              const cur=local[pk]||p;
              const sh=shots(cur);const sg=sog(cur);
              return(
                <tr key={pk} className={i%2===0?"bg-gray-50":"bg-white"}>
                  <td className="p-1 font-black border border-gray-300 text-xs">{p.number}</td>
                  <td className="p-1 font-bold border border-gray-300 text-xs whitespace-nowrap">{p.name}</td>
                  {/* Editable: G */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.goals||0} onChange={e=>setField(pk,"goals",e.target.value)} className={inp}/></td>
                  {/* Editable: A */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.assists||0} onChange={e=>setField(pk,"assists",e.target.value)} className={inp}/></td>
                  {/* Computed: Shots */}
                  <td className={C+" bg-yellow-50 font-bold"}>{sh||"-"}</td>
                  {/* Editable: SOG */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.shotsOnGoal||0} onChange={e=>setField(pk,"shotsOnGoal",e.target.value)} className={inp}/></td>
                  {/* Computed: Shot% */}
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.goals||0,sh)}</td>
                  {/* Editable: GB */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.groundballs||0} onChange={e=>setField(pk,"groundballs",e.target.value)} className={inp}/></td>
                  {/* Editable: CTO */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.cto||0} onChange={e=>setField(pk,"cto",e.target.value)} className={inp}/></td>
                  {/* Editable: FO */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.faceoffsTaken||0} onChange={e=>setField(pk,"faceoffsTaken",e.target.value)} className={inp}/></td>
                  {/* Editable: FOW */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.faceoffsWon||0} onChange={e=>setField(pk,"faceoffsWon",e.target.value)} className={inp}/></td>
                  {/* Computed: FO% */}
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.faceoffsWon||0,cur.faceoffsTaken||0)}</td>
                  {/* Editable: SAV */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.saves||0} onChange={e=>setField(pk,"saves",e.target.value)} className={inp}/></td>
                  {/* Editable: GA */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.goalsAgainst||0} onChange={e=>setField(pk,"goalsAgainst",e.target.value)} className={inp}/></td>
                  {/* Editable: SA */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.shotsAgainst||0} onChange={e=>setField(pk,"shotsAgainst",e.target.value)} className={inp}/></td>
                  {/* Computed: SV% */}
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.saves||0,(cur.saves||0)+(cur.goalsAgainst||0))}</td>
                  {/* Editable: PEN */}
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.penalties||0} onChange={e=>setField(pk,"penalties",e.target.value)} className={inp}/></td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-red-600 text-white font-black text-xs">
              <td className={CB} colSpan="2">TOTALS</td>
              <td className={CB}>{totals.goals}</td>
              <td className={CB}>{totals.assists}</td>
              <td className={CB+" bg-red-700"}>{totalShots}</td>
              <td className={CB}>{totalSOG}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.goals,totalShots)}</td>
              <td className={CB}>{totals.groundballs}</td>
              <td className={CB}>{totals.cto}</td>
              <td className={CB}>{totals.faceoffsTaken}</td>
              <td className={CB}>{totals.faceoffsWon}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.faceoffsWon,totals.faceoffsTaken)}</td>
              <td className={CB}>{totals.saves}</td>
              <td className={CB}>{totals.goalsAgainst}</td>
              <td className={CB}>{totals.shotsAgainst}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.saves,totals.saves+totals.goalsAgainst)}</td>
              <td className={CB}>{totals.penalties}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 font-bold mt-1">Yellow columns are auto-calculated. White columns are editable. Shots = G + SOG + misses (edit SOG and Miss separately via stat list).</p>
      <button onClick={handleSave} className={"w-full mt-3 py-3 rounded-lg font-black border-2 border-black active:scale-95 "+(saved?"bg-green-600 text-white border-green-700":"bg-gray-800 text-yellow-400 border-yellow-400")}>{saved?"✓ SAVED — MERGE UPDATED!":"SAVE TABLE EDITS"}</button>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

function PlayerSelectModal({title,subtitle,roster,onSelect,onCancel,skipLabel,highlighted}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"><div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md border-4 border-black my-8">
    <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">{title}</h3>{subtitle&&<p className="text-sm text-yellow-300 font-bold">{subtitle}</p>}</div>
    <div className="p-4">
      {skipLabel&&<button onClick={()=>onSelect(null)} className="w-full py-4 mb-3 bg-yellow-500 text-black rounded-lg font-black border-2 border-black active:scale-95">{skipLabel}</button>}
      <div className="grid grid-cols-2 gap-2 mb-4">{sortForStats(roster).map((p)=>{const d=isDef(p);const hl=highlighted&&highlighted[p.id];return<button key={p.id} onClick={()=>onSelect(p)} className={"py-2 px-2 rounded-lg text-left border-2 active:scale-95 flex items-center gap-2 "+(hl?"bg-yellow-400 text-black border-yellow-600":d?"bg-red-600 text-white border-black":"bg-gray-100 border-gray-300")}><div className={"w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-lg "+(hl?"bg-black text-white":d?"bg-white text-red-600":"bg-black text-white")}>{p.number}</div><div><div className={"font-black text-xs "+(hl?"text-black":d?"text-white":"text-gray-800")}>{p.name}</div><div className={"text-xs font-bold "+(hl?"text-gray-700":d?"text-yellow-300":"text-gray-600")}>{posAbbr(p.position)}</div></div></button>;})}</div>
      {onCancel&&<button onClick={onCancel} className="w-full py-3 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>}
    </div>
  </div></div></div>
);}

function AssistSelectModal({goalPlayer,roster,onSelect,highlighted}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"><div className="min-h-screen flex items-center justify-center p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md border-4 border-black my-8">
    <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">WHO ASSISTED?</h3><p className="text-sm text-yellow-300 font-bold">Goal by {goalPlayer.name} #{goalPlayer.number}</p></div>
    <div className="p-4">
      <button onClick={()=>onSelect(null)} className="w-full py-4 mb-3 bg-yellow-500 text-black rounded-lg font-black border-2 border-black active:scale-95">UNASSISTED</button>
      <div className="grid grid-cols-2 gap-2 mb-4">{sortForStats(roster).map((p)=>{const d=isDef(p);const isScorer=p.id===goalPlayer.id;const hl=highlighted&&highlighted[p.id];
        if(isScorer)return<div key={p.id} className="py-2 px-2 rounded-lg border-2 bg-gray-200 border-gray-300 opacity-40 flex items-center gap-2"><div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-lg bg-gray-400 text-white">{p.number}</div><div><div className="font-black text-xs text-gray-400">{p.name}</div></div></div>;
        return<button key={p.id} onClick={()=>onSelect(p)} className={"py-2 px-2 rounded-lg text-left border-2 active:scale-95 flex items-center gap-2 "+(hl?"bg-yellow-400 text-black border-yellow-600":d?"bg-red-600 text-white border-black":"bg-gray-100 border-gray-300")}><div className={"w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-lg "+(hl?"bg-black text-white":d?"bg-white text-red-600":"bg-black text-white")}>{p.number}</div><div><div className={"font-black text-xs "+(hl?"text-black":d?"text-white":"text-gray-800")}>{p.name}</div><div className={"text-xs font-bold "+(hl?"text-gray-700":d?"text-yellow-300":"text-gray-600")}>{posAbbr(p.position)}</div></div></button>;
      })}</div>
    </div>
  </div></div></div>
);}

function OpponentShotModal({activeGoalie,goalieNumber,onResult,onCancel}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
      <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">OPPONENT SHOT</h3><p className="text-xs text-yellow-200 font-bold mt-1">Confirm goalie before selecting result</p></div>
      <div className="bg-yellow-400 border-b-4 border-black px-4 py-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center font-black text-yellow-400 text-lg flex-shrink-0">{goalieNumber??""}</div>
        <div><div className="text-xs font-black text-gray-700 uppercase tracking-wide">Active Goalie</div><div className="text-xl font-black text-black">{activeGoalie||"None set"}</div></div>
        <div className="ml-auto text-2xl">🧤</div>
      </div>
      <div className="p-4 space-y-3">
        <button onClick={()=>onResult("Save")} className="w-full py-4 rounded-lg font-black border-2 border-black active:scale-95 bg-green-500 text-white text-lg">SAVE</button>
        <button onClick={()=>onResult("Miss")} className="w-full py-4 rounded-lg font-black border-2 border-black active:scale-95 bg-yellow-500 text-black text-lg">MISS (wide/over)</button>
        <button onClick={()=>onResult("Goal")} className="w-full py-4 rounded-lg font-black border-2 border-black active:scale-95 bg-red-500 text-white text-lg">GOAL AGAINST</button>
        <button onClick={onCancel} className="w-full py-3 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
      </div>
    </div>
  </div>
);}

function ModalChoice({title,subtitle,choices,onCancel}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
    <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">{title}</h3>{subtitle&&<p className="text-sm text-yellow-300 font-bold">{subtitle}</p>}</div>
    <div className="p-4 space-y-3">{choices.map((c,i)=><button key={i} onClick={c.action} className={"w-full py-4 rounded-lg font-black border-2 border-black active:scale-95 "+c.cls}>{c.label}</button>)}{onCancel&&<button onClick={onCancel} className="w-full py-3 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>}</div>
  </div></div>
);}

function ConfirmModal({label,onConfirm,onCancel}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-red-600">
    <div className="bg-red-700 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">CONFIRM DELETE</h3></div>
    <div className="p-4 space-y-3"><p className="text-center font-bold text-gray-800">Delete <span className="text-red-600 font-black">{label}</span>?</p><p className="text-center text-sm text-gray-500 font-bold">This cannot be undone.</p>
      <button onClick={onConfirm} className="w-full py-3 bg-red-700 text-white rounded-lg font-black border-2 border-black active:scale-95">YES, DELETE</button>
      <button onClick={onCancel} className="w-full py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
    </div>
  </div></div>
);}

function AdminModal({adminInput,setAdminInput,adminErr,onUnlock,onCancel}){return(
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
    <div className="bg-gray-800 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">ADMIN ACCESS</h3></div>
    <div className="p-4 space-y-3"><input type="password" value={adminInput} onChange={(e)=>setAdminInput(e.target.value)} placeholder="Enter passcode" className="w-full px-4 py-3 border-2 border-black rounded-lg text-center text-lg font-black"/>{adminErr&&<p className="text-red-600 font-bold text-sm text-center">{adminErr}</p>}
      <button onClick={onUnlock} className="w-full py-3 bg-black text-yellow-400 rounded-lg font-black border-2 border-yellow-400 active:scale-95">UNLOCK</button>
      <button onClick={onCancel} className="w-full py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
    </div>
  </div></div>
);}

function StatEditModal({stat,roster,onSave,onDelete,onCancel}){
  const[s,setS]=useState({...stat});
  const goalies=roster.filter(p=>p.position==="Goalie");
  const isGoalieStat=["Save","Goal Against","Opponent Shot Miss"].includes(s.type);
  const isPlayerStat=["Goals","Assists","Shot on Goal","Shot Missed","Groundballs","Turnovers Caused","Faceoffs Won","Faceoffs Lost","Penalty"].includes(s.type);
  const setPlayer=(name)=>{const p=sortForStats(roster).find(x=>x.name===name);if(p)setS(prev=>({...prev,player:p.name,number:p.number}));};
  const typeColor=(t)=>{if(t==="Goals")return"bg-green-100 text-green-800 border-green-400";if(t==="Goal Against")return"bg-red-100 text-red-800 border-red-400";if(t==="Save")return"bg-blue-100 text-blue-800 border-blue-400";if(t==="Assists")return"bg-yellow-100 text-yellow-800 border-yellow-400";return"bg-gray-100 text-gray-700 border-gray-300";};
  return(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
        <div className="bg-gray-800 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">EDIT STAT</h3><span className={"text-xs font-black px-2 py-1 rounded border mt-1 inline-block "+typeColor(s.type)}>{s.type}</span>{s.timestamp&&<span className="text-xs text-gray-400 font-bold ml-2">{fmtTime(s.timestamp)}</span>}</div>
        <div className="p-4 space-y-3">
          {isGoalieStat&&<div><label className="block text-xs font-black text-gray-700 mb-1">GOALIE</label><select value={s.goalie||""} onChange={e=>setS(prev=>({...prev,goalie:e.target.value}))} className="w-full px-3 py-2 border-2 border-black rounded-lg font-bold text-sm bg-white">{goalies.map(g=><option key={g.id} value={g.name}>{g.name} #{g.number}</option>)}<option value="">— Unknown —</option></select></div>}
          {isPlayerStat&&<div><label className="block text-xs font-black text-gray-700 mb-1">PLAYER</label><select value={s.player||""} onChange={e=>setPlayer(e.target.value)} className="w-full px-3 py-2 border-2 border-black rounded-lg font-bold text-sm bg-white">{sortForStats(roster).map(p=><option key={p.id} value={p.name}>{p.name} #{p.number} ({posAbbr(p.position)})</option>)}</select></div>}
          <button onClick={()=>onSave(s)} className="w-full py-3 bg-green-600 text-white rounded-lg font-black border-2 border-black active:scale-95">SAVE CHANGES</button>
          <button onClick={onDelete} className="w-full py-2 bg-red-700 text-white rounded-lg font-black border-2 border-black active:scale-95">DELETE THIS STAT</button>
          <button onClick={onCancel} className="w-full py-2 bg-gray-500 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

const ALL_EDIT_FIELDS=[
  {key:"goals",label:"G"},{key:"assists",label:"A"},{key:"shotsOnGoal",label:"SOG"},
  {key:"shotsMissed",label:"Miss"},{key:"groundballs",label:"GB"},{key:"cto",label:"CTO"},
  {key:"faceoffsTaken",label:"FO"},{key:"faceoffsWon",label:"FOW"},{key:"saves",label:"SAV"},
  {key:"goalsAgainst",label:"GA"},{key:"shotsAgainst",label:"SA"},{key:"penalties",label:"PEN"},
];

function EditFinalStats({playerStats,onSave,onClearOverrides,hasOverrides}){
  const[local,setLocal]=useState(()=>{const o={};Object.entries(playerStats).forEach(([k,p])=>{o[k]={...p};});return o;});
  const[saved,setSaved]=useState(false);
  const sorted=sortForStats(Object.values(local));
  const setField=(pk,field,val)=>setLocal(prev=>({...prev,[pk]:{...prev[pk],[field]:Math.max(0,parseInt(val)||0)}}));
  const handleSave=async()=>{await onSave(local);setSaved(true);setTimeout(()=>setSaved(false),2000);};

  const shots=(p)=>(p.goals||0)+(p.shotsOnGoal||0)+(p.shotsMissed||0);
  const sog=(p)=>(p.goals||0)+(p.shotsOnGoal||0);
  const totals=EDITABLE_COLS.reduce((acc,{key})=>{acc[key]=sorted.reduce((s,p)=>s+(local[p.name+"-"+p.number]?.[key]||0),0);return acc;},{});
  const totalShots=totals.goals+(totals.shotsOnGoal||0)+(totals.shotsMissed||0);
  const totalSOG=totals.goals+(totals.shotsOnGoal||0);
  const inp="w-full text-center border border-gray-400 rounded font-black text-xs py-1 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500";
  const C="text-center border border-gray-300 text-xs";
  const CB="text-center border-2 border-black text-xs font-black";

  return(
    <div>
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3 mb-3 text-sm">
        <p className="font-black text-yellow-800">⚠️ DIRECT EDIT MODE</p>
        <p className="text-yellow-700 font-bold mt-1">Changes override merged data. Raw recorder sheets are preserved. Yellow columns auto-calculate.</p>
      </div>
      {hasOverrides&&<button onClick={onClearOverrides} className="w-full mb-3 py-2 bg-orange-100 text-orange-800 border-2 border-orange-400 rounded-lg font-black text-sm active:scale-95">↺ CLEAR OVERRIDES — revert to merged data</button>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-2 border-black">
          <thead className="bg-red-600 text-white">
            <tr>
              <th className="p-1 text-left border border-red-400 font-black">#</th>
              <th className="p-1 text-left border border-red-400 font-black">Player</th>
              <th className="p-1 border border-red-400 font-black">G</th>
              <th className="p-1 border border-red-400 font-black">A</th>
              <th className="p-1 border border-red-400 font-black bg-red-700">Sh</th>
              <th className="p-1 border border-red-400 font-black">SOG</th>
              <th className="p-1 border border-red-400 font-black bg-red-700 text-yellow-300">Sh%</th>
              <th className="p-1 border border-red-400 font-black">GB</th>
              <th className="p-1 border border-red-400 font-black">CTO</th>
              <th className="p-1 border border-red-400 font-black">FO</th>
              <th className="p-1 border border-red-400 font-black">FOW</th>
              <th className="p-1 border border-red-400 font-black bg-red-700 text-yellow-300">FO%</th>
              <th className="p-1 border border-red-400 font-black">SAV</th>
              <th className="p-1 border border-red-400 font-black">GA</th>
              <th className="p-1 border border-red-400 font-black">SA</th>
              <th className="p-1 border border-red-400 font-black bg-red-700 text-yellow-300">SV%</th>
              <th className="p-1 border border-red-400 font-black">PEN</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>{
              const pk=p.name+"-"+p.number;const cur=local[pk]||p;
              const sh=shots(cur);
              return(
                <tr key={pk} className={i%2===0?"bg-gray-50":"bg-white"}>
                  <td className="p-1 font-black border border-gray-300 text-xs">{p.number}</td>
                  <td className="p-1 font-bold border border-gray-300 text-xs whitespace-nowrap">{p.name}</td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.goals||0} onChange={e=>setField(pk,"goals",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.assists||0} onChange={e=>setField(pk,"assists",e.target.value)} className={inp}/></td>
                  <td className={C+" bg-yellow-50 font-bold"}>{sh||"-"}</td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.shotsOnGoal||0} onChange={e=>setField(pk,"shotsOnGoal",e.target.value)} className={inp}/></td>
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.goals||0,sh)}</td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.groundballs||0} onChange={e=>setField(pk,"groundballs",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.cto||0} onChange={e=>setField(pk,"cto",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.faceoffsTaken||0} onChange={e=>setField(pk,"faceoffsTaken",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.faceoffsWon||0} onChange={e=>setField(pk,"faceoffsWon",e.target.value)} className={inp}/></td>
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.faceoffsWon||0,cur.faceoffsTaken||0)}</td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.saves||0} onChange={e=>setField(pk,"saves",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.goalsAgainst||0} onChange={e=>setField(pk,"goalsAgainst",e.target.value)} className={inp}/></td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.shotsAgainst||0} onChange={e=>setField(pk,"shotsAgainst",e.target.value)} className={inp}/></td>
                  <td className={C+" bg-yellow-50 font-bold"}>{pctFn(cur.saves||0,(cur.saves||0)+(cur.goalsAgainst||0))}</td>
                  <td className="p-0.5 border border-gray-300"><input type="number" min="0" value={cur.penalties||0} onChange={e=>setField(pk,"penalties",e.target.value)} className={inp}/></td>
                </tr>
              );
            })}
            <tr className="bg-red-600 text-white font-black text-xs">
              <td className={CB} colSpan="2">TOTALS</td>
              <td className={CB}>{totals.goals}</td>
              <td className={CB}>{totals.assists}</td>
              <td className={CB+" bg-red-700"}>{totalShots}</td>
              <td className={CB}>{totalSOG}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.goals,totalShots)}</td>
              <td className={CB}>{totals.groundballs}</td>
              <td className={CB}>{totals.cto}</td>
              <td className={CB}>{totals.faceoffsTaken}</td>
              <td className={CB}>{totals.faceoffsWon}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.faceoffsWon,totals.faceoffsTaken)}</td>
              <td className={CB}>{totals.saves}</td>
              <td className={CB}>{totals.goalsAgainst}</td>
              <td className={CB}>{totals.shotsAgainst}</td>
              <td className={CB+" bg-red-700"}>{pctFn(totals.saves,totals.saves+totals.goalsAgainst)}</td>
              <td className={CB}>{totals.penalties}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 font-bold mt-1">Yellow columns auto-calculate. All other columns are editable.</p>
      <button onClick={handleSave} className={"w-full mt-3 py-3 rounded-lg font-black border-2 border-black active:scale-95 "+(saved?"bg-green-600 text-white border-green-700":"bg-black text-yellow-400 border-yellow-400")}>{saved?"✓ SAVED!":"SAVE FINAL STATS"}</button>
    </div>
  );
}

export default function App(){
  const[screen,setScreen]=useState("home");
  const[roster,setRoster]=useState([]);
  const[games,setGames]=useState([]);
  const[curGameId,setCurGameId]=useState(null);
  const[curGame,setCurGame]=useState(null);
  const[recorderName,setRecorderName]=useState("");
  const[activeGoalie,setActiveGoalie]=useState("");
  const[stats,setStats]=useState([]);
  const[goalSeq,setGoalSeq]=useState(0);
  const[gaSeq,setGaSeq]=useState(0);
  const[showPlayerSelect,setShowPlayerSelect]=useState(null);
  const[pendingGoal,setPendingGoal]=useState(null);
  const[pendingStat,setPendingStat]=useState(null);
  const[mergedData,setMergedData]=useState(null);
  const[recorderList,setRecorderList]=useState([]);
  const[busy,setBusy]=useState(false);
  const[formName,setFormName]=useState("");
  const[ngOpp,setNgOpp]=useState("");
  const[ngDate,setNgDate]=useState(todayStr());
  const[ngLoc,setNgLoc]=useState("");
  const[editPlayer,setEditPlayer]=useState(null);
  const[epName,setEpName]=useState("");
  const[epNum,setEpNum]=useState("");
  const[epPos,setEpPos]=useState("Midfield");
  const[selectedGames,setSelectedGames]=useState([]);
  const[multiData,setMultiData]=useState(null);
  const[isAdmin,setIsAdmin]=useState(false);
  const[showAdminPrompt,setShowAdminPrompt]=useState(false);
  const[adminInput,setAdminInput]=useState("");
  const[adminErr,setAdminErr]=useState("");
  const[confirmDelete,setConfirmDelete]=useState(null);
  const[faceoffPlayers,setFaceoffPlayers]=useState({});
  const[loading,setLoading]=useState(true);
  const[reviewTab,setReviewTab]=useState("merged");
  const[allRecStats,setAllRecStats]=useState({});
  const[expandedRec,setExpandedRec]=useState(null);
  const[recSubTab,setRecSubTab]=useState({});  // per-recorder sub-tab: "list" | "table"
  const[editStatEntry,setEditStatEntry]=useState(null);
  const[recStatsLoading,setRecStatsLoading]=useState(false);
  const[overrides,setOverrides]=useState({});

  useEffect(()=>{(async()=>{
    let r=await sGet("roster:current");if(!r){r=DEFAULT_ROSTER;await sSet("roster:current",r);}
    let mig=false;r=r.map((p)=>{if(p.active===undefined){mig=true;return{...p,active:true};}return p;});if(mig)await sSet("roster:current",r);
    setRoster(r);
    const g=await sGet("games:index")||[];const td=todayStr();let ch=false;
    g.forEach((gm)=>{if(gm.status==="active"&&gm.date<td){gm.status="final";ch=true;}});if(ch)await sSet("games:index",g);
    setGames(g);setLoading(false);
  })();},[]);

  const saveRoster=async(r)=>{setRoster(r);await sSet("roster:current",r);};
  const saveGames=async(g)=>{setGames(g);await sSet("games:index",g);};
  const saveMyStats=useCallback(async()=>{if(!curGameId||!recorderName)return;await sSet("game:"+curGameId+":stats:"+recorderName,{stats,goalSeq,gaSeq});},[curGameId,recorderName,stats,goalSeq,gaSeq]);
  useEffect(()=>{if(screen==="tracking"&&curGameId&&recorderName)saveMyStats();},[stats,goalSeq,gaSeq,screen,saveMyStats]);
  const gameRoster=(g)=>g?.roster||roster;
  const activeRoster=()=>roster.filter((p)=>p.active!==false);
  const doAdminUnlock=()=>{if(adminInput==="Team91"){setIsAdmin(true);setShowAdminPrompt(false);setAdminErr("");}else{setAdminErr("Incorrect passcode");setAdminInput("");}};
  const doDelete=async()=>{if(!confirmDelete)return;if(confirmDelete.type==="all")await saveGames([]);else await saveGames(games.filter((gm)=>gm.id!==confirmDelete.id));setConfirmDelete(null);};

  const loadAllRecStats=async(gId)=>{
    setRecStatsLoading(true);const keys=await sList("game:"+gId+":stats:");const result={};
    for(const k of keys){const nm=k.replace("game:"+gId+":stats:","");const d=await sGet(k);if(d)result[nm]=d;}
    setAllRecStats(result);setRecStatsLoading(false);
  };

  const refreshMerge=async(gId,gr)=>{
    const res=await loadGameMerge(gId,gr);
    if(res.merge){setMergedData(res.merge);setRecorderList(res.recorders);const ng=games.map(g=>g.id===gId?{...g,goalsFor:res.merge.totalGoals,goalsAgainst:res.merge.totalGA}:g);await saveGames(ng);}
    return res;
  };

  const doSaveStatEdit=async(newStat,gr)=>{
    const{recorder,idx}=editStatEntry;const recData={...(allRecStats[recorder]||{})};
    const newStats=[...(recData.stats||[])];newStats[idx]=newStat;recData.stats=newStats;
    await sSet("game:"+curGameId+":stats:"+recorder,recData);
    setAllRecStats(prev=>({...prev,[recorder]:recData}));await refreshMerge(curGameId,gr);setEditStatEntry(null);
  };

  const doDeleteStatEntry=async(gr)=>{
    const{recorder,idx}=editStatEntry;const recData={...(allRecStats[recorder]||{})};
    recData.stats=(recData.stats||[]).filter((_,i)=>i!==idx);
    await sSet("game:"+curGameId+":stats:"+recorder,recData);
    setAllRecStats(prev=>({...prev,[recorder]:recData}));await refreshMerge(curGameId,gr);setEditStatEntry(null);
  };

  const doDeleteRecorder=async(recorderNm,gr)=>{
    await sSet("game:"+curGameId+":stats:"+recorderNm,{stats:[],goalSeq:0,gaSeq:0,deleted:true});
    setAllRecStats(prev=>{const n={...prev};n[recorderNm]={...n[recorderNm],deleted:true};return n;});
    setExpandedRec(null);await refreshMerge(curGameId,gr);
  };

  // Save per-recorder table overrides
  const doSaveRecorderTableOverrides=async(recorderNm,tableOverrides,gr)=>{
    const recData={...(allRecStats[recorderNm]||{})};
    recData.tableOverrides=tableOverrides;
    await sSet("game:"+curGameId+":stats:"+recorderNm,recData);
    setAllRecStats(prev=>({...prev,[recorderNm]:recData}));
    await refreshMerge(curGameId,gr);
  };

  const doClearRecorderTableOverrides=async(recorderNm,gr)=>{
    const recData={...(allRecStats[recorderNm]||{})};
    delete recData.tableOverrides;
    await sSet("game:"+curGameId+":stats:"+recorderNm,recData);
    setAllRecStats(prev=>({...prev,[recorderNm]:recData}));
    await refreshMerge(curGameId,gr);
  };

  const doSaveOverrides=async(editedStats)=>{
    const ovr={};Object.entries(editedStats).forEach(([k,p])=>{ovr[k]={...p};});
    setOverrides(ovr);await sSet("game:"+curGameId+":overrides",ovr);
    const totalG=Object.values(ovr).reduce((s,p)=>s+(p.goals||0),0);
    const totalGA=Object.values(ovr).reduce((s,p)=>s+(p.goalsAgainst||0),0);
    const ng=games.map(g=>g.id===curGameId?{...g,goalsFor:totalG,goalsAgainst:totalGA}:g);await saveGames(ng);
  };

  const doClearOverrides=async()=>{setOverrides({});await sSet("game:"+curGameId+":overrides",{});};

  const openReview=async(g)=>{
    setCurGameId(g.id);setCurGame(g);setBusy(true);
    setReviewTab("merged");setAllRecStats({});setExpandedRec(null);setEditStatEntry(null);setOverrides({});setRecSubTab({});
    const res=await loadGameMerge(g.id,g.roster||roster);setMergedData(res.merge);setRecorderList(res.recorders);
    if(res.merge){setGoalSeq(res.merge.totalGoals);setGaSeq(res.merge.totalGA);}
    const ovr=await sGet("game:"+g.id+":overrides")||{};setOverrides(ovr);
    setBusy(false);setScreen("review");
  };

  const joinGame=async(g,name)=>{
    setCurGameId(g.id);setCurGame(g);setRecorderName(name);
    const gr=g.roster||roster;const gl=gr.filter(p=>p.position==="Goalie");
    setActiveGoalie(gl.length?gl[0].name:"");setFaceoffPlayers({});
    const ex=await sGet("game:"+g.id+":stats:"+name);
    if(ex){setStats(ex.stats||[]);setGoalSeq(ex.goalSeq||0);setGaSeq(ex.gaSeq||0);}
    else{setStats([]);const res=await loadGameMerge(g.id,gr);if(res.merge){setGoalSeq(res.merge.totalGoals);setGaSeq(res.merge.totalGA);}else{setGoalSeq(0);setGaSeq(0);}}
    setScreen("tracking");
  };

  if(loading)return<div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 flex items-center justify-center"><div className="text-white text-2xl font-black">Loading...</div></div>;

  if(screen==="home"){
    const actG=games.filter((g)=>g.status==="active");
    const pastG=games.filter((g)=>g.status==="final").sort((a,b)=>b.date.localeCompare(a.date));
    return(
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black relative">
        {!isAdmin?<button onClick={()=>{setShowAdminPrompt(true);setAdminInput("");setAdminErr("");}} className="absolute top-3 right-3 text-xs font-bold text-gray-400">ADMIN</button>:<div className="absolute top-3 right-3 flex items-center gap-1"><span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-1 rounded border border-yellow-400">ADMIN</span><button onClick={()=>setIsAdmin(false)} className="text-xs font-bold text-gray-400 underline">lock</button></div>}
        <div className="flex flex-col items-center mb-6"><LogoImg size="lg"/><div className="mt-2 text-sm font-bold text-gray-500">STAT TRACKER</div></div>
        <div className="space-y-3">
          <Btn onClick={()=>{setNgOpp("");setNgDate(todayStr());setNgLoc("");setScreen("newgame");}} cls="w-full bg-red-600 text-white py-4 rounded-lg font-black text-lg border-2 border-black">NEW GAME</Btn>
          <Btn onClick={()=>{setSelectedGames([]);setMultiData(null);setScreen("multigame");}} cls="w-full bg-yellow-400 text-black py-3 rounded-lg font-black border-2 border-black">SEASON STATS</Btn>
        </div>
        {actG.length>0&&<div className="mt-6"><h3 className="font-black text-gray-800 mb-2 text-sm">ACTIVE GAMES</h3>{actG.map((g)=>(
          <div key={g.id} className="mb-2 bg-green-50 border-2 border-green-400 rounded-lg p-3">
            <div className="font-black text-green-800">{g.date} vs {g.opponent}</div><div className="text-sm text-green-600 font-bold">{g.location}</div>
            {g.goalsFor!=null&&<div className="text-sm font-black text-gray-700 mt-1">Score: {g.goalsFor}-{g.goalsAgainst}</div>}
            <div className="flex gap-2 mt-2">
              <Btn onClick={()=>{const nm=formName||prompt("Enter your name:");if(!nm)return;setFormName(nm);joinGame(g,nm);}} cls="flex-1 py-1 bg-green-600 text-white rounded text-xs font-black border border-black">JOIN</Btn>
              <Btn onClick={async()=>{await saveGames(games.map((x)=>x.id===g.id?{...x,status:"final"}:x));}} cls="flex-1 py-1 bg-gray-600 text-white rounded text-xs font-black border border-black">FINALIZE</Btn>
              <Btn onClick={()=>openReview(g)} cls="flex-1 py-1 bg-blue-600 text-white rounded text-xs font-black border border-black">STATS</Btn>
              {isAdmin&&<Btn onClick={()=>setConfirmDelete({type:"game",id:g.id,label:g.date+" vs "+g.opponent})} cls="py-1 px-2 bg-red-700 text-white rounded text-xs font-black border border-black">DEL</Btn>}
            </div>
          </div>))}</div>}
        {pastG.length>0&&<div className="mt-4"><h3 className="font-black text-gray-800 mb-2 text-sm">PAST GAMES</h3><div className="space-y-2 max-h-64 overflow-y-auto">{pastG.map((g)=>{
          const wl=g.goalsFor!=null?(g.goalsFor>g.goalsAgainst?"W":g.goalsFor<g.goalsAgainst?"L":"T")+" "+g.goalsFor+"-"+g.goalsAgainst:"";
          return(<div key={g.id} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
            <Btn onClick={()=>openReview(g)} cls="w-full text-left"><div className="flex justify-between items-center"><div><div className="font-black text-gray-800">{g.date} vs {g.opponent}</div><div className="text-xs text-gray-500 font-bold">{g.location}</div></div>{wl&&<div className={"font-black text-lg "+(wl[0]==="W"?"text-green-600":wl[0]==="L"?"text-red-600":"text-gray-600")}>{wl}</div>}</div></Btn>
            <div className="flex gap-2 mt-2">
              <Btn onClick={async()=>{await saveGames(games.map((x)=>x.id===g.id?{...x,status:"active"}:x));}} cls="flex-1 py-1 bg-yellow-400 text-black rounded text-xs font-black border border-black">REACTIVATE</Btn>
              {isAdmin&&<Btn onClick={()=>setConfirmDelete({type:"game",id:g.id,label:g.date+" vs "+g.opponent})} cls="py-1 px-3 bg-red-700 text-white rounded text-xs font-black border border-black">DELETE</Btn>}
            </div>
          </div>);})}</div></div>}
        {isAdmin&&<div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-2">
          <Btn onClick={()=>setScreen("roster")} cls="w-full py-2 bg-gray-800 text-white rounded-lg font-black text-sm border-2 border-black">MANAGE ROSTER</Btn>
          {games.length>0&&<Btn onClick={()=>setConfirmDelete({type:"all",label:"ALL GAMES"})} cls="w-full py-2 bg-red-700 text-white rounded-lg font-black text-sm border-2 border-black">DELETE ALL GAMES</Btn>}
        </div>}
      </div></div>
      {showAdminPrompt&&<AdminModal adminInput={adminInput} setAdminInput={setAdminInput} adminErr={adminErr} onUnlock={doAdminUnlock} onCancel={()=>{setShowAdminPrompt(false);setAdminErr("");}}/>}
      {confirmDelete&&<ConfirmModal label={confirmDelete.label} onConfirm={confirmDelete.onConfirm||doDelete} onCancel={()=>setConfirmDelete(null)}/>}
      </div>);
  }

  if(screen==="roster"){
    const startEdit=(p)=>{setEditPlayer(p);setEpName(p.name);setEpNum(String(p.number));setEpPos(p.position);};
    const savePlayer=async()=>{let r;if(editPlayer.id==="NEW")r=[...roster,{id:genId(),name:epName,number:parseInt(epNum)||0,position:epPos,active:true}];else r=roster.map((p)=>p.id===editPlayer.id?{...p,name:epName,number:parseInt(epNum)||0,position:epPos}:p);await saveRoster(sortByNum(r));setEditPlayer(null);};
    const toggleActive=async(id)=>{await saveRoster(roster.map((p)=>p.id===id?{...p,active:!p.active}:p));};
    return(
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={()=>setScreen("home")} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <h2 className="text-xl font-black text-black text-center mb-4">MANAGE ROSTER</h2>
        <Btn onClick={()=>{setEditPlayer({id:"NEW"});setEpName("");setEpNum("");setEpPos("Midfield");}} cls="w-full bg-green-600 text-white py-3 rounded-lg font-black border-2 border-black mb-4">+ ADD PLAYER</Btn>
        {editPlayer&&<div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4"><h3 className="font-black text-sm mb-2">{editPlayer.id==="NEW"?"ADD PLAYER":"EDIT PLAYER"}</h3><div className="space-y-2">
          <input type="text" value={epName} onChange={(e)=>setEpName(e.target.value)} placeholder="Last name" className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm font-bold"/>
          <input type="number" value={epNum} onChange={(e)=>setEpNum(e.target.value)} placeholder="Jersey #" className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm font-bold"/>
          <div className="grid grid-cols-3 gap-1">{POSITIONS.map((pos)=><Btn key={pos} onClick={()=>setEpPos(pos)} cls={"py-2 px-1 rounded text-xs font-black border-2 "+(epPos===pos?"bg-red-600 text-white border-red-800":"bg-white text-gray-700 border-black")}>{pos}</Btn>)}</div>
          <div className="flex gap-2"><Btn onClick={savePlayer} disabled={!epName||!epNum} cls="flex-1 bg-green-600 text-white py-2 rounded-lg font-black border-2 border-black disabled:bg-gray-400">SAVE</Btn><Btn onClick={()=>setEditPlayer(null)} cls="flex-1 bg-gray-600 text-white py-2 rounded-lg font-black border-2 border-black">CANCEL</Btn></div>
        </div></div>}
        <div className="space-y-1 max-h-96 overflow-y-auto">{sortByNum(roster).map((p)=>{const inactive=p.active===false;return<div key={p.id} className={"flex items-center justify-between py-2 px-3 rounded-lg border-2 "+(inactive?"bg-gray-200 border-gray-300 opacity-60":"bg-gray-50 border-gray-200")}>
          <div><span className="font-black">#{p.number}</span> <span className="font-bold">{p.name}</span> <span className="text-xs font-bold text-gray-500">({posAbbr(p.position)})</span>{inactive&&<span className="text-xs font-bold text-red-500 ml-1">[INACTIVE]</span>}</div>
          <div className="flex gap-1"><Btn onClick={()=>startEdit(p)} cls="p-1 rounded text-blue-600"><Edit3 className="w-4 h-4"/></Btn><Btn onClick={()=>toggleActive(p.id)} cls={"px-2 py-1 rounded text-xs font-black border "+(inactive?"bg-green-100 text-green-700 border-green-400":"bg-red-100 text-red-700 border-red-400")}>{inactive?"ACTIVATE":"DEACTIVATE"}</Btn></div>
        </div>;})}</div>
        <p className="text-xs text-gray-500 mt-3 font-bold">Changes only affect future games. Historical stats preserved.</p>
      </div></div></div>);
  }

  if(screen==="newgame"){return(
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
      <Btn onClick={()=>setScreen("home")} cls="text-gray-500 font-black mb-4">← BACK</Btn>
      <LogoImg size="md"/><h2 className="text-xl font-black text-black text-center mb-4 mt-2">NEW GAME</h2>
      <div className="space-y-4">
        <div><label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label><input type="text" value={formName} onChange={(e)=>setFormName(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Your name"/></div>
        <div><label className="block text-sm font-bold text-gray-700 mb-1">Opponent</label><input type="text" value={ngOpp} onChange={(e)=>setNgOpp(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Opponent name"/></div>
        <div><label className="block text-sm font-bold text-gray-700 mb-1">Date</label><input type="date" value={ngDate} onChange={(e)=>setNgDate(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg text-sm appearance-none" style={{WebkitAppearance:"none",MozAppearance:"none"}}/></div>
        <div><label className="block text-sm font-bold text-gray-700 mb-1">Location</label><input type="text" value={ngLoc} onChange={(e)=>setNgLoc(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Field/venue"/></div>
        <Btn onClick={async()=>{if(!formName)return;const id=genId();const ar=activeRoster();const g={id,date:ngDate,opponent:ngOpp,location:ngLoc,status:"active",roster:[...ar],goalsFor:null,goalsAgainst:null};await saveGames([g,...games]);await sSet("game:"+id+":info",g);setCurGameId(id);setCurGame(g);setRecorderName(formName);const gl=ar.filter(p=>p.position==="Goalie");setActiveGoalie(gl.length?gl[0].name:"");setStats([]);setGoalSeq(0);setGaSeq(0);setFaceoffPlayers({});setScreen("tracking");}} disabled={!ngOpp||!ngLoc||!formName} cls="w-full bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400 disabled:bg-gray-400 disabled:border-gray-400">CREATE GAME</Btn>
      </div>
    </div></div></div>);
  }

  if(screen==="tracking"){
    const gr=gameRoster(curGame);const goalies=gr.filter((p)=>p.position==="Goalie");
    const activeGoaliePlayer=goalies.find(g=>g.name===activeGoalie);
    const addStat=(s)=>setStats((prev)=>[...prev,{...s,recorder:recorderName,timestamp:Date.now()}]);
    const rec=(st)=>{if(["Shot","Faceoffs","Groundballs","CTO","Penalties"].includes(st))setShowPlayerSelect(st);else if(st==="Opponent Shot")setPendingStat({type:"Opponent Shot"});};
    const hPS=(p)=>{if(showPlayerSelect==="Shot")setPendingStat({type:"Shot",player:p});else if(showPlayerSelect==="Penalties")setPendingStat({type:"Penalties",player:p});else if(showPlayerSelect==="Faceoffs")setPendingStat({type:"Faceoffs",player:p});else if(showPlayerSelect==="CTO")setPendingStat({type:"CTO",player:p});else if(showPlayerSelect==="Groundballs")addStat({type:"Groundballs",player:p.name,number:p.number});setShowPlayerSelect(null);};
    const hAS=(ap)=>{const ns=[{recorder:recorderName,type:"Goals",player:pendingGoal.player.name,number:pendingGoal.player.number,timestamp:Date.now()}];if(ap)ns.push({recorder:recorderName,type:"Assists",player:ap.name,number:ap.number,timestamp:Date.now()});setStats((prev)=>[...prev,...ns]);setGoalSeq(prev=>prev+1);setPendingGoal(null);};
    const hSR=(r)=>{if(r==="Score")setPendingGoal({player:pendingStat.player});else addStat({type:r==="On Goal"?"Shot on Goal":"Shot Missed",player:pendingStat.player.name,number:pendingStat.player.number});setPendingStat(null);};
    const hOR=(r)=>{if(r==="Goal"){addStat({type:"Goal Against",goalie:activeGoalie});setGaSeq((p)=>p+1);}else addStat({type:r==="Save"?"Save":"Opponent Shot Miss",goalie:activeGoalie});setPendingStat(null);};
    const hPT=(pt)=>{addStat({type:"Penalty",penaltyType:pt,player:pendingStat.player.name,number:pendingStat.player.number});setPendingStat(null);};
    const hFO=(r)=>{addStat({type:r==="Won"?"Faceoffs Won":"Faceoffs Lost",player:pendingStat.player.name,number:pendingStat.player.number});setFaceoffPlayers((prev)=>({...prev,[pendingStat.player.id]:true}));if(r==="Won")setPendingStat({type:"FO-GB"});else setPendingStat(null);};
    const hCTO=(choice)=>{addStat({type:"Turnovers Caused",player:pendingStat.player.name,number:pendingStat.player.number});if(choice==="Groundball")setPendingStat({type:"CTO-GB"});else setPendingStat(null);};
    const hGBSelect=(p)=>{if(p)addStat({type:"Groundballs",player:p.name,number:p.number});setPendingStat(null);};
    const undo=()=>{if(!stats.length)return;const l=stats[stats.length-1];if(l.type==="Goals")setGoalSeq((p)=>Math.max(0,p-1));else if(l.type==="Goal Against")setGaSeq((p)=>Math.max(0,p-1));setStats((p)=>p.slice(0,-1));};
    return(
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4 pb-20"><div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-4 mb-4 border-4 border-black">
          <div className="text-center mb-3"><LogoImg size="sm"/><h2 className="text-lg font-black">{curGame.date} vs {curGame.opponent}</h2><p className="text-xs font-bold text-gray-600">{curGame.location} · Rec: <span className="text-red-600">{recorderName}</span></p></div>
          <div className="mt-2"><p className="text-xs font-black text-gray-500 text-center mb-2 uppercase tracking-wide">Active Goalie</p>
            <div className="flex justify-center gap-2 flex-wrap">{goalies.map((g)=>(
              <button key={g.id} onClick={()=>setActiveGoalie(g.name)} className={"flex items-center gap-2 px-4 py-2 rounded-lg font-black border-2 border-black transition-all "+(activeGoalie===g.name?"bg-yellow-400 text-black scale-105":"bg-white text-gray-700")}>
                <div className={"w-8 h-8 rounded-full flex items-center justify-center font-black text-sm "+(activeGoalie===g.name?"bg-black text-yellow-400":"bg-gray-200 text-gray-700")}>{g.number}</div>
                <span>{g.name}</span>{activeGoalie===g.name&&<span>🧤</span>}
              </button>))}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-2xl p-4 mb-4 border-4 border-black"><div className="grid grid-cols-2 gap-4 text-center"><div><div className="text-5xl font-black text-red-600">{goalSeq}</div><div className="text-sm font-bold text-gray-600 mt-1">Goals For</div></div><div><div className="text-5xl font-black text-gray-700">{gaSeq}</div><div className="text-sm font-bold text-gray-600 mt-1">Goals Against</div></div></div></div>
        <div className="bg-white rounded-lg shadow-2xl p-4 border-4 border-black mb-4">
          <div className="flex justify-between items-center mb-3"><h3 className="font-black text-gray-800">RECORD STATS</h3>{stats.length>0&&<Btn onClick={undo} cls="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded-lg font-bold text-sm border-2 border-black"><Undo2 className="w-4 h-4"/>UNDO</Btn>}</div>
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={()=>rec("Shot")} cls="py-4 bg-green-600 text-white rounded-lg font-black border-2 border-black col-span-2">SHOT</Btn>
            <Btn onClick={()=>rec("Opponent Shot")} cls="py-3 bg-red-600 text-white rounded-lg font-black border-2 border-black col-span-2">
              <div className="text-base font-black">OPPONENT SHOT</div>
              <div className="text-xs font-bold text-red-200 mt-0.5">🧤 {activeGoalie||"No goalie set"} {activeGoaliePlayer?"#"+activeGoaliePlayer.number:""}</div>
            </Btn>
            <Btn onClick={()=>rec("Penalties")} cls="py-3 bg-black text-white rounded-lg font-black border-2 border-black">PENALTY</Btn>
            <Btn onClick={()=>rec("Faceoffs")} cls="py-3 bg-black text-white rounded-lg font-black border-2 border-black">FACEOFF</Btn>
            <Btn onClick={()=>rec("Groundballs")} cls="py-3 bg-black text-white rounded-lg font-black border-2 border-black">GROUNDBALL</Btn>
            <Btn onClick={()=>rec("CTO")} cls="py-3 bg-black text-white rounded-lg font-black border-2 border-black">CAUSED TO</Btn>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-2xl p-4 border-4 border-black">
          <h3 className="font-black text-gray-800 mb-2">RECENT (Last 10)</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {stats.slice(-10).reverse().map((s,i)=>(
              <div key={i} className="text-sm py-2 px-3 bg-gray-50 rounded border-2 border-gray-200 flex justify-between items-center">
                <div><span className="font-black">{s.type}</span>{s.player&&<span className="font-bold"> · {s.player} <span className="text-gray-500">#{s.number}</span></span>}{(s.type==="Save"||s.type==="Goal Against")&&s.goalie&&<span className="font-bold"> · 🧤{s.goalie}</span>}{s.penaltyType&&<span className="text-orange-700 font-bold"> · {s.penaltyType}</span>}</div>
                <span className="text-gray-400 text-xs font-bold ml-2 flex-shrink-0">{fmtTime(s.timestamp)}</span>
              </div>
            ))}
            {stats.length===0&&<p className="text-gray-500 text-center py-4 font-bold">No stats recorded yet</p>}
          </div>
          <div className="mt-2 text-xs text-gray-500 font-bold text-center">{stats.length} stats recorded</div>
        </div>
        <Btn onClick={async()=>{setBusy(true);await saveMyStats();const gr2=gameRoster(curGame);const res=await loadGameMerge(curGameId,gr2);setMergedData(res.merge);setRecorderList(res.recorders);if(res.merge){setGoalSeq(res.merge.totalGoals);setGaSeq(res.merge.totalGA);const ng=games.map((g)=>g.id===curGameId?{...g,goalsFor:res.merge.totalGoals,goalsAgainst:res.merge.totalGA}:g);await saveGames(ng);setCurGame(ng.find((g)=>g.id===curGameId));}setBusy(false);setScreen("review");}} cls="w-full mt-4 bg-black text-yellow-400 py-4 rounded-lg font-black text-lg border-2 border-yellow-400">{busy?"SAVING...":"SUBMIT STATS"}</Btn>
      </div>
      {showPlayerSelect&&!pendingGoal&&!pendingStat&&<PlayerSelectModal title="SELECT PLAYER" subtitle={showPlayerSelect} roster={gr} onSelect={hPS} onCancel={()=>setShowPlayerSelect(null)} highlighted={faceoffPlayers}/>}
      {pendingGoal&&!showPlayerSelect&&!pendingStat&&<AssistSelectModal goalPlayer={pendingGoal.player} roster={gr} onSelect={hAS} highlighted={faceoffPlayers}/>}
      {pendingStat?.type==="Shot"&&pendingStat.player&&!showPlayerSelect&&<ModalChoice title="SHOT RESULT" subtitle={pendingStat.player.name+" #"+pendingStat.player.number} choices={[{label:"SCORE",cls:"bg-green-500 text-white",action:()=>hSR("Score")},{label:"ON GOAL",cls:"bg-yellow-500 text-black",action:()=>hSR("On Goal")},{label:"MISS",cls:"bg-red-500 text-white",action:()=>hSR("Miss")}]} onCancel={()=>setPendingStat(null)}/>}
      {pendingStat?.type==="Opponent Shot"&&!showPlayerSelect&&<OpponentShotModal activeGoalie={activeGoalie} goalieNumber={activeGoaliePlayer?.number} onResult={hOR} onCancel={()=>setPendingStat(null)}/>}
      {pendingStat?.type==="Penalties"&&pendingStat.player&&!showPlayerSelect&&<ModalChoice title="PENALTY" subtitle={pendingStat.player.name+" #"+pendingStat.player.number} choices={[{label:"TECHNICAL (30s)",cls:"bg-yellow-500 text-black",action:()=>hPT("Technical Foul (30s)")},{label:"PERSONAL (60s)",cls:"bg-orange-500 text-white",action:()=>hPT("Personal Foul (60s)")},{label:"FLAGRANT (2-3min)",cls:"bg-red-500 text-white",action:()=>hPT("Flagrant Foul (2-3min)")}]} onCancel={()=>setPendingStat(null)}/>}
      {pendingStat?.type==="Faceoffs"&&pendingStat.player&&!showPlayerSelect&&<ModalChoice title="FACEOFF" subtitle={pendingStat.player.name+" #"+pendingStat.player.number} choices={[{label:"WON",cls:"bg-green-500 text-white",action:()=>hFO("Won")},{label:"LOST",cls:"bg-red-500 text-white",action:()=>hFO("Lost")}]} onCancel={()=>setPendingStat(null)}/>}
      {pendingStat?.type==="CTO"&&pendingStat.player&&!showPlayerSelect&&<ModalChoice title="CAUSED TURNOVER" subtitle={pendingStat.player.name+" #"+pendingStat.player.number} choices={[{label:"INTERCEPTION",cls:"bg-blue-600 text-white",action:()=>hCTO("Interception")},{label:"GROUNDBALL",cls:"bg-black text-white",action:()=>hCTO("Groundball")}]} onCancel={()=>setPendingStat(null)}/>}
      {pendingStat?.type==="FO-GB"&&<PlayerSelectModal title="WHO GOT THE GROUNDBALL?" subtitle="After faceoff win" roster={gr} onSelect={hGBSelect} skipLabel="NO GROUNDBALL" onCancel={()=>setPendingStat(null)} highlighted={faceoffPlayers}/>}
      {pendingStat?.type==="CTO-GB"&&<PlayerSelectModal title="WHO GOT THE GROUNDBALL?" subtitle="After caused turnover" roster={gr} onSelect={hGBSelect} onCancel={()=>setPendingStat(null)} highlighted={faceoffPlayers}/>}
      </div>);
  }

  if(screen==="review"){
    const gr=gameRoster(curGame);
    let ps,tG,tGA;
    if(mergedData){ps=mergedData.playerStats;tG=mergedData.totalGoals;tGA=mergedData.totalGA;}
    else{const m=mergeAllStats({local:{stats,goalSeq,gaSeq}},gr);ps=m.playerStats;tG=m.totalGoals;tGA=m.totalGA;}
    const displayPs=applyOverrides(ps,overrides);
    const hasOverrides=Object.keys(overrides).length>0;
    const canReturn=curGame?.status==="active";

    const statTypeStyle=(t)=>{
      if(t==="Goals")return"bg-green-100 text-green-800 border border-green-300";
      if(t==="Goal Against")return"bg-red-100 text-red-800 border border-red-300";
      if(t==="Save")return"bg-blue-100 text-blue-800 border border-blue-300";
      if(t==="Assists")return"bg-yellow-100 text-yellow-800 border border-yellow-300";
      if(t==="Shot on Goal")return"bg-purple-100 text-purple-800 border border-purple-300";
      if(t==="Faceoffs Won")return"bg-emerald-100 text-emerald-800 border border-emerald-300";
      if(t==="Faceoffs Lost")return"bg-orange-100 text-orange-800 border border-orange-300";
      return"bg-gray-100 text-gray-700 border border-gray-200";
    };

    return(
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-6xl mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 border-4 border-black">
        <div className="text-center mb-4"><LogoImg size="md"/><h2 className="text-2xl font-black text-black mt-2">GAME SUMMARY</h2></div>
        <div className="mb-4 text-center">
          <p className="font-bold text-gray-700"><span className="font-black">Opponent:</span> {curGame?.opponent}</p>
          <p className="font-bold text-gray-700">{curGame?.date} · {curGame?.location}</p>
          <p className="text-3xl font-black mt-2"><span className="text-red-600">{tG}</span> - <span className="text-gray-700">{tGA}</span></p>
          {hasOverrides&&<span className="text-xs font-black text-orange-600 bg-orange-50 border border-orange-300 px-2 py-0.5 rounded ml-2">OVERRIDES ACTIVE</span>}
        </div>
        {recorderList.length>0&&<div className="mb-3 bg-blue-50 p-2 rounded-lg border-2 border-blue-200 text-center"><span className="text-sm font-black text-blue-800">{recorderList.length} recorder{recorderList.length>1?"s":""}: </span><span className="text-sm font-bold text-blue-700">{recorderList.join(", ")}</span></div>}

        <div className="flex gap-1 mb-4 flex-wrap">
          <button onClick={()=>setReviewTab("merged")} className={"flex-1 py-2 rounded-lg font-black text-xs border-2 border-black "+(reviewTab==="merged"?"bg-black text-yellow-400":"bg-white text-gray-700")}>MERGED STATS</button>
          {isAdmin&&<button onClick={async()=>{setReviewTab("byrecorder");if(Object.keys(allRecStats).length===0)await loadAllRecStats(curGameId);}} className={"flex-1 py-2 rounded-lg font-black text-xs border-2 border-black "+(reviewTab==="byrecorder"?"bg-gray-800 text-yellow-400":"bg-white text-gray-700")}>BY RECORDER ✏️</button>}
          {isAdmin&&<button onClick={()=>setReviewTab("editfinal")} className={"flex-1 py-2 rounded-lg font-black text-xs border-2 border-black "+(reviewTab==="editfinal"?"bg-gray-800 text-yellow-400":"bg-white text-gray-700")}>EDIT FINAL{hasOverrides?" ⚠️":""}</button>}
        </div>

        {reviewTab==="merged"&&<div>
          <StatsTable playerStats={displayPs}/>
          <div className="mt-4 text-xs text-gray-600"><p className="font-bold">G=Goals, A=Assists, Shots=Total, SOG=On Goal (incl goals), Shot%=G/Shots, GB=Groundballs, CTO=Caused TO, FO/FOW=Faceoffs, SAV=Saves, GA=Goals Against, SA=Total Shots Against, SV%=SAV/(SAV+GA), PEN=Penalties</p></div>
          <CopyBtn label="COPY TABLE" doneLabel="✓ COPIED!" cls="mt-4"/>
          <Btn onClick={async()=>{setBusy(true);const res=await loadGameMerge(curGameId,gr);if(res.merge)setMergedData(res.merge);setRecorderList(res.recorders);setBusy(false);}} cls="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg font-black border-2 border-black">{busy?"REFRESHING...":"REFRESH DATA"}</Btn>
        </div>}

        {reviewTab==="byrecorder"&&isAdmin&&<div>
          {recStatsLoading&&<div className="text-center py-8 text-gray-500 font-black">Loading...</div>}
          {!recStatsLoading&&Object.keys(allRecStats).filter(k=>!allRecStats[k].deleted).length===0&&<div className="text-center py-8"><p className="text-gray-500 font-bold mb-4">No data loaded.</p><button onClick={()=>loadAllRecStats(curGameId)} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-black border-2 border-black active:scale-95">LOAD</button></div>}
          {!recStatsLoading&&Object.keys(allRecStats).length>0&&<div className="space-y-3">
            {Object.entries(allRecStats).sort(([a],[b])=>a.localeCompare(b)).map(([nm,data])=>{
              if(data.deleted)return null;
              const isExp=expandedRec===nm;
              const statList=data.stats||[];
              const gCount=statList.filter(s=>s.type==="Goals").length;
              const gaCount=statList.filter(s=>s.type==="Goal Against").length;
              const subTab=recSubTab[nm]||"list";
              const hasRecOverrides=!!(data.tableOverrides&&Object.keys(data.tableOverrides).length>0);
              return<div key={nm} className="border-2 border-gray-300 rounded-lg overflow-hidden">
                <button onClick={()=>setExpandedRec(isExp?null:nm)} className={"w-full p-3 flex justify-between items-center font-black text-left "+(isExp?"bg-gray-800 text-white":"bg-gray-100 text-gray-800 hover:bg-gray-200")}>
                  <span className="text-base">{nm}{hasRecOverrides&&<span className="ml-2 text-xs font-black text-orange-400">⚠️ overrides</span>}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={"font-bold "+(isExp?"text-green-300":"text-green-700")}>{gCount}G</span>
                    <span className={"font-bold "+(isExp?"text-red-300":"text-red-600")}>{gaCount}GA</span>
                    <span className={"font-bold "+(isExp?"text-gray-300":"text-gray-500")}>{statList.length} stats</span>
                    <span>{isExp?"▲":"▼"}</span>
                  </div>
                </button>
                {isExp&&<div className="bg-white">
                  {/* Sub-tab bar */}
                  <div className="flex border-b-2 border-gray-200">
                    <button onClick={()=>setRecSubTab(prev=>({...prev,[nm]:"list"}))} className={"flex-1 py-2 text-xs font-black border-r border-gray-200 "+(subTab==="list"?"bg-gray-800 text-yellow-400":"bg-gray-50 text-gray-700 hover:bg-gray-100")}>STAT LIST</button>
                    <button onClick={()=>setRecSubTab(prev=>({...prev,[nm]:"table"}))} className={"flex-1 py-2 text-xs font-black "+(subTab==="table"?"bg-gray-800 text-yellow-400":"bg-gray-50 text-gray-700 hover:bg-gray-100")}>STATS TABLE{hasRecOverrides?" ⚠️":""}</button>
                  </div>

                  {subTab==="list"&&<div className="p-3">
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {statList.length===0&&<p className="text-gray-500 text-center font-bold py-4">No stats recorded.</p>}
                      {statList.map((s,i)=>{
                        const isGoalie=["Save","Goal Against","Opponent Shot Miss"].includes(s.type);
                        return<div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-200 gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                            <span className={"text-xs font-black px-2 py-0.5 rounded "+statTypeStyle(s.type)}>{s.type}</span>
                            {s.player&&<span className="text-sm font-bold text-gray-800">{s.player} <span className="text-gray-500">#{s.number}</span></span>}
                            {isGoalie&&s.goalie&&<span className="text-sm font-bold text-gray-700">🧤{s.goalie}</span>}
                            {s.penaltyType&&<span className="text-xs text-orange-700 font-bold">{s.penaltyType}</span>}
                            {s.timestamp&&<span className="text-xs text-gray-400 font-bold">{fmtTime(s.timestamp)}</span>}
                          </div>
                          <button onClick={()=>setEditStatEntry({recorder:nm,idx:i,stat:{...s}})} className="flex-shrink-0 px-2 py-1 bg-yellow-400 text-black rounded text-xs font-black border border-yellow-600 active:scale-95">EDIT</button>
                        </div>;
                      })}
                    </div>
                    <button onClick={()=>setConfirmDelete({type:"sheet",label:nm+"'s entire sheet",onConfirm:()=>{doDeleteRecorder(nm,gr);setConfirmDelete(null);}})} className="mt-3 w-full py-2 bg-red-100 text-red-800 border-2 border-red-400 rounded-lg font-black text-sm active:scale-95">🗑 DELETE {nm}'S ENTIRE SHEET</button>
                  </div>}

                  {subTab==="table"&&<div className="p-3">
                    <RecorderEditableTable
                      recData={data}
                      roster={gr}
                      hasOverrides={hasRecOverrides}
                      onSave={(ovr)=>doSaveRecorderTableOverrides(nm,ovr,gr)}
                      onClearOverrides={()=>doClearRecorderTableOverrides(nm,gr)}
                    />
                  </div>}
                </div>}
              </div>;
            })}
          </div>}
        </div>}

        {reviewTab==="editfinal"&&isAdmin&&<EditFinalStats playerStats={displayPs} onSave={doSaveOverrides} onClearOverrides={doClearOverrides} hasOverrides={hasOverrides}/>}

        {canReturn&&<Btn onClick={()=>setScreen("tracking")} cls="w-full mt-4 py-3 bg-green-600 text-white rounded-lg font-black border-2 border-black">RETURN TO GAME</Btn>}
        <Btn onClick={()=>{setScreen("home");setMergedData(null);setRecorderList([]);setAllRecStats({});setExpandedRec(null);setOverrides({});setRecSubTab({});}} cls="w-full mt-2 bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400">BACK TO HOME</Btn>
      </div></div>
      {editStatEntry&&<StatEditModal stat={editStatEntry.stat} roster={gr} onSave={(ns)=>doSaveStatEdit(ns,gr)} onDelete={()=>doDeleteStatEntry(gr)} onCancel={()=>setEditStatEntry(null)}/>}
      {confirmDelete&&<ConfirmModal label={confirmDelete.label} onConfirm={confirmDelete.onConfirm||doDelete} onCancel={()=>setConfirmDelete(null)}/>}
      </div>);
  }

  if(screen==="multigame"){
    const fG=games.filter((g)=>g.status==="final"&&g.goalsFor!=null).sort((a,b)=>b.date.localeCompare(a.date));
    const toggle=(id)=>setSelectedGames((p)=>p.includes(id)?p.filter((x)=>x!==id):[...p,id]);
    const agg=async()=>{
      setBusy(true);const allPs={};
      for(const gId of selectedGames){
        const g=games.find((x)=>x.id===gId);const res=await loadGameMerge(gId,gameRoster(g));
        if(res.merge){const ovr=await sGet("game:"+gId+":overrides")||{};const final=applyOverrides(res.merge.playerStats,ovr);Object.entries(final).forEach(([k,p])=>{if(!allPs[k])allPs[k]={...p};else Object.keys(p).forEach((f)=>{if(typeof p[f]==="number"&&f!=="number")allPs[k][f]+=p[f];});});}
      }
      setMultiData({playerStats:allPs,gameCount:selectedGames.length});setBusy(false);
    };
    return(
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-6xl mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={()=>{setScreen("home");setMultiData(null);}} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <h2 className="text-xl font-black text-black text-center mb-4">SEASON STATS</h2>
        {!multiData&&<div>
          <p className="text-sm font-bold text-gray-600 mb-3">Select games to aggregate:</p>
          {fG.length===0&&<p className="text-gray-500 text-center py-4 font-bold">No finalized games yet</p>}
          <div className="flex gap-2 mb-3"><Btn onClick={()=>setSelectedGames(fG.map((g)=>g.id))} cls="flex-1 py-2 bg-yellow-400 text-black rounded-lg font-black border-2 border-black text-sm">SELECT ALL</Btn><Btn onClick={()=>setSelectedGames([])} cls="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-black border-2 border-black text-sm">CLEAR</Btn></div>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">{fG.map((g)=>{const sel=selectedGames.includes(g.id);const wl=(g.goalsFor>g.goalsAgainst?"W":g.goalsFor<g.goalsAgainst?"L":"T")+" "+g.goalsFor+"-"+g.goalsAgainst;
            return<Btn key={g.id} onClick={()=>toggle(g.id)} cls={"w-full rounded-lg p-3 text-left border-2 "+(sel?"bg-red-50 border-red-500":"bg-gray-50 border-gray-300")}><div className="flex justify-between items-center"><div className="flex items-center gap-2">{sel?<Check className="w-5 h-5 text-red-600 flex-shrink-0"/>:<div className="w-5 h-5 border-2 border-gray-400 rounded flex-shrink-0"/>}<div><div className="font-black text-gray-800">{g.date} vs {g.opponent}</div><div className="text-xs text-gray-500 font-bold">{g.location}</div></div></div><div className={"font-black "+(wl[0]==="W"?"text-green-600":wl[0]==="L"?"text-red-600":"text-gray-600")}>{wl}</div></div></Btn>;})}</div>
          <Btn onClick={agg} disabled={selectedGames.length<1||busy} cls="w-full bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400 disabled:bg-gray-400 disabled:border-gray-400">{busy?"CALCULATING...":"VIEW STATS ("+selectedGames.length+" GAME"+(selectedGames.length!==1?"S":"")+")"}</Btn>
        </div>}
        {multiData&&<div>
          <div className="mb-4 text-center"><LogoImg size="md"/><div className="mt-2 text-lg font-black text-gray-800">COMBINED — {multiData.gameCount} GAME{multiData.gameCount!==1?"S":""}</div></div>
          <StatsTable playerStats={multiData.playerStats}/>
          <div className="mt-4 text-xs text-gray-600"><p className="font-bold">Stats summed across selected games. Per-game overrides included. Percentages from combined totals.</p></div>
          <CopyBtn label="COPY TABLE" doneLabel="✓ COPIED!" cls="mt-4"/>
          <Btn onClick={()=>setMultiData(null)} cls="w-full mt-2 py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black">BACK TO SELECTION</Btn>
          <Btn onClick={()=>{setScreen("home");setMultiData(null);}} cls="w-full mt-2 bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400">BACK TO HOME</Btn>
        </div>}
      </div></div></div>);
  }
  return null;
}


