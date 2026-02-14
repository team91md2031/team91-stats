import { useState, useEffect, useCallback } from "react";
import { Undo2, Edit3, Plus, Check } from "lucide-react";
import { sSet, sGet, sList } from "./firebase.js";

const DEFAULT_ROSTER = [
  { id: "p1", name: "Garland", number: 0, position: "Goalie", active: true },
  { id: "p2", name: "Rewkowski", number: 2, position: "Midfield", active: true },
  { id: "p3", name: "Hammond", number: 3, position: "Attack/Midfield", active: true },
  { id: "p4", name: "Sunderland", number: 5, position: "Defense", active: true },
  { id: "p5", name: "Oliver", number: 6, position: "Attack/Midfield", active: true },
  { id: "p6", name: "Jenkins", number: 7, position: "Midfield", active: true },
  { id: "p7", name: "Warfield", number: 8, position: "Attack", active: true },
  { id: "p8", name: "Bissel", number: 9, position: "Goalie", active: true },
  { id: "p9", name: "Trader", number: 12, position: "Defense", active: true },
  { id: "p10", name: "Markwort", number: 13, position: "Midfield", active: true },
  { id: "p11", name: "Stadler", number: 16, position: "Midfield", active: true },
  { id: "p12", name: "Archfield", number: 17, position: "Midfield", active: true },
  { id: "p13", name: "Merchlinski", number: 24, position: "Midfield", active: true },
  { id: "p14", name: "Calabrese", number: 29, position: "Midfield", active: true },
  { id: "p15", name: "Hogg", number: 32, position: "LSM", active: true },
  { id: "p16", name: "Schlegal", number: 37, position: "Attack/Midfield", active: true },
  { id: "p17", name: "Miles", number: 52, position: "LSM", active: true },
  { id: "p18", name: "Meehan", number: 64, position: "Defense", active: true },
  { id: "p19", name: "Stallings", number: 88, position: "Attack/Midfield", active: true },
  { id: "p20", name: "Severn", number: 88, position: "Midfield", active: true },
  { id: "p21", name: "Frounfelker", number: 93, position: "Defense", active: true },
  { id: "p22", name: "Homan", number: 99, position: "Defense", active: true },
];

const STAT_TYPES = ["Shot", "Groundballs", "Turnovers Caused", "Turnovers Committed", "Opponent Shot", "Faceoffs", "Penalties"];
const POSITIONS = ["Attack", "Attack/Midfield", "Midfield", "Defense", "LSM", "Goalie"];
const LOGO_URLS = [
  "https://lh3.googleusercontent.com/d/1fH_A8GPBN3SDjg54CMtH_D7WLKGeSmQW",
  "https://drive.google.com/thumbnail?id=1fH_A8GPBN3SDjg54CMtH_D7WLKGeSmQW&sz=w400",
];

const genId = () => Math.random().toString(36).substr(2, 8);
const isDef = (p) => p.position === "Defense" || p.position === "LSM";
const sortByNum = (r) => [...r].sort((a, b) => a.number - b.number);
const posGroup = (p) => { if (p.position === "Goalie") return 2; if (isDef(p)) return 1; return 0; };
const sortForStats = (r) => [...r].sort((a, b) => posGroup(a) - posGroup(b) || a.number - b.number);
const pctFn = (n, d) => (d === 0 ? "-" : ((n / d) * 100).toFixed(1) + "%");
const todayStr = () => new Date().toISOString().split("T")[0];

function mergeAllStats(rMap, roster) {
  const ps = {};
  roster.forEach((p) => {
    const k = p.name + "-" + p.number;
    if (!ps[k]) ps[k] = { name: p.name, number: p.number, position: p.position, goals: 0, assists: 0, shotsOnGoal: 0, shotsMissed: 0, groundballs: 0, turnoversCaused: 0, turnoversCommitted: 0, saves: 0, opponentShots: 0, faceoffsTaken: 0, faceoffsWon: 0, penalties: 0 };
  });
  const sm = { Goals: "goals", Assists: "assists", "Shot on Goal": "shotsOnGoal", "Shot Missed": "shotsMissed", Groundballs: "groundballs", "Turnovers Caused": "turnoversCaused", "Turnovers Committed": "turnoversCommitted", Penalty: "penalties" };
  Object.entries(sm).forEach(([sT, f]) => {
    const mx = {};
    Object.values(rMap).forEach((d) => {
      const ct = {};
      (d.stats || []).forEach((s) => { if (s.type === sT && s.player) { const k = s.player + "-" + s.number; ct[k] = (ct[k] || 0) + 1; } });
      Object.entries(ct).forEach(([k, v]) => { mx[k] = Math.max(mx[k] || 0, v); });
    });
    Object.entries(mx).forEach(([k, v]) => { if (ps[k]) ps[k][f] = v; });
  });
  const mxFT = {}, mxFW = {};
  Object.values(rMap).forEach((d) => {
    const t = {}, w = {};
    (d.stats || []).forEach((s) => {
      if (s.type === "Faceoffs Won" || s.type === "Faceoffs Lost") {
        const k = s.player + "-" + s.number; t[k] = (t[k] || 0) + 1;
        if (s.type === "Faceoffs Won") w[k] = (w[k] || 0) + 1;
      }
    });
    Object.entries(t).forEach(([k, v]) => { mxFT[k] = Math.max(mxFT[k] || 0, v); });
    Object.entries(w).forEach(([k, v]) => { mxFW[k] = Math.max(mxFW[k] || 0, v); });
  });
  Object.entries(mxFT).forEach(([k, v]) => { if (ps[k]) ps[k].faceoffsTaken = v; });
  Object.entries(mxFW).forEach(([k, v]) => { if (ps[k]) ps[k].faceoffsWon = v; });
  const mxSv = {}, mxGA = {};
  Object.values(rMap).forEach((d) => {
    const sv = {}, ga = {};
    (d.stats || []).forEach((s) => {
      if (s.type === "Save" && s.goalie) { const gp = roster.find((x) => x.name === s.goalie); if (gp) { const k = gp.name + "-" + gp.number; sv[k] = (sv[k] || 0) + 1; } }
      if (s.type === "Goal Against" && s.goalie) { const gp = roster.find((x) => x.name === s.goalie); if (gp) { const k = gp.name + "-" + gp.number; ga[k] = (ga[k] || 0) + 1; } }
    });
    Object.entries(sv).forEach(([k, v]) => { mxSv[k] = Math.max(mxSv[k] || 0, v); });
    Object.entries(ga).forEach(([k, v]) => { mxGA[k] = Math.max(mxGA[k] || 0, v); });
  });
  Object.entries(mxSv).forEach(([k, v]) => { if (ps[k]) ps[k].saves = v; });
  Object.keys(ps).forEach((k) => { if (ps[k].saves > 0 || mxGA[k]) ps[k].opponentShots = (ps[k].saves || 0) + (mxGA[k] || 0); });
  return { playerStats: ps, totalGoals: Object.values(ps).reduce((s, p) => s + p.goals, 0), totalGA: Object.values(mxGA).reduce((s, v) => s + v, 0) };
}

async function loadGameMerge(gId, roster) {
  const keys = await sList("game:" + gId + ":stats:");
  const rMap = {}, rNames = [];
  for (const k of keys) { const nm = k.replace("game:" + gId + ":stats:", ""); const d = await sGet(k); if (d) { rMap[nm] = d; rNames.push(nm); } }
  return { merge: Object.keys(rMap).length ? mergeAllStats(rMap, roster) : null, recorders: rNames };
}

function LogoImg({ size }) {
  const sz = size || "lg";
  const [fail, setFail] = useState(false);
  const [idx, setIdx] = useState(0);
  const sc = sz === "sm" ? "w-14 h-14" : sz === "md" ? "w-24 h-24" : "w-32 h-32";
  const ts = sz === "sm" ? "text-3xl" : sz === "md" ? "text-5xl" : "text-7xl";
  if (fail) return (
    <div className="flex flex-col items-center">
      <div className={"font-black text-red-600 italic " + ts} style={{ textShadow: "3px 3px 0px #000,-1px -1px 0px #FFD700", fontFamily: "Impact,Arial Black,sans-serif", letterSpacing: "-4px" }}>91</div>
      {sz === "lg" && <div><h1 className="text-xl font-black text-black text-center">TEAM 91 MARYLAND</h1><div className="text-base font-bold text-red-600 text-center">2031</div></div>}
    </div>
  );
  return <img src={LOGO_URLS[idx]} alt="Team 91" className={sc + " object-contain mx-auto"} onError={() => { if (idx < LOGO_URLS.length - 1) setIdx(idx + 1); else setFail(true); }} />;
}

function Btn({ children, onClick, cls, disabled }) {
  return <button onClick={onClick} disabled={disabled} className={"active:scale-95 transition-all " + (cls || "")}>{children}</button>;
}

function StatPicker({ stats, setStats }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">Stats to Track</label>
      <button onClick={() => setStats((p) => p.length === STAT_TYPES.length ? [] : [...STAT_TYPES])} className={"w-full py-2 px-3 rounded-lg text-sm font-black border-2 border-black mb-2 active:scale-95 " + (stats.length === STAT_TYPES.length ? "bg-green-600 text-white" : "bg-yellow-400 text-black")}>{stats.length === STAT_TYPES.length ? "✓ ALL SELECTED" : "SELECT ALL"}</button>
      <div className="grid grid-cols-2 gap-2">{STAT_TYPES.map((st) => <button key={st} onClick={() => setStats((p) => p.includes(st) ? p.filter((s) => s !== st) : [...p, st])} className={"py-2 px-3 rounded-lg text-sm font-bold border-2 border-black active:scale-95 " + (stats.includes(st) ? "bg-red-600 text-white" : "bg-white text-gray-700")}>{st.toUpperCase()}</button>)}</div>
    </div>
  );
}

function CopyBtn({ label, doneLabel, cls }) {
  const [d, setD] = useState(false);
  return <button onClick={async () => { try { const el = document.getElementById("stats-table"); const r = document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); document.execCommand("copy"); window.getSelection().removeAllRanges(); setD(true); setTimeout(() => setD(false), 2000); } catch (e) {} }} className={"w-full py-3 rounded-lg font-black border-2 border-black active:scale-95 " + (d ? "bg-green-600 text-white" : "bg-blue-600 text-white") + " " + (cls || "")}>{d ? doneLabel : label}</button>;
}

function StatsTable({ playerStats }) {
  const hd = ["#", "Player", "Pos", "G", "A", "SOG", "SM", "Shot%", "GB", "TC", "TComm", "FO-T", "FO-W", "FO%", "SV", "SA", "SV%", "PEN"];
  const tt = { goals: 0, assists: 0, shotsOnGoal: 0, shotsMissed: 0, groundballs: 0, turnoversCaused: 0, turnoversCommitted: 0, saves: 0, opponentShots: 0, faceoffsTaken: 0, faceoffsWon: 0, penalties: 0 };
  const sorted = sortForStats(Object.values(playerStats));
  sorted.forEach((p) => Object.keys(tt).forEach((k) => { tt[k] += p[k]; }));
  const ttS = tt.goals + tt.shotsOnGoal + tt.shotsMissed;
  const C = "p-2 text-center font-bold border border-gray-300";
  const CB = "p-2 text-center border-2 border-black";
  return (
    <div className="overflow-x-auto">
      <table id="stats-table" className="w-full text-sm border-2 border-black">
        <thead className="bg-red-600 text-white"><tr>{hd.map((h) => <th key={h} className={CB + " font-black"}>{h}</th>)}</tr></thead>
        <tbody>
          {sorted.map((p, i) => { const ts = p.goals + p.shotsOnGoal + p.shotsMissed; return (
            <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="p-2 font-black border border-gray-300">{p.number}</td>
              <td className="p-2 font-bold border border-gray-300">{p.name}</td>
              <td className="p-2 font-bold border border-gray-300">{p.position}</td>
              <td className={C}>{p.goals || "-"}</td><td className={C}>{p.assists || "-"}</td>
              <td className={C}>{p.shotsOnGoal || "-"}</td><td className={C}>{p.shotsMissed || "-"}</td>
              <td className={C}>{pctFn(p.goals, ts)}</td><td className={C}>{p.groundballs || "-"}</td>
              <td className={C}>{p.turnoversCaused || "-"}</td><td className={C}>{p.turnoversCommitted || "-"}</td>
              <td className={C}>{p.faceoffsTaken || "-"}</td><td className={C}>{p.faceoffsWon || "-"}</td>
              <td className={C}>{pctFn(p.faceoffsWon, p.faceoffsTaken)}</td>
              <td className={C}>{p.saves || "-"}</td><td className={C}>{p.opponentShots || "-"}</td>
              <td className={C}>{pctFn(p.saves, p.opponentShots)}</td><td className={C}>{p.penalties || "-"}</td>
            </tr>); })}
          <tr className="bg-red-600 text-white font-black">
            <td className={CB} colSpan="3">TEAM TOTALS</td>
            <td className={CB}>{tt.goals}</td><td className={CB}>{tt.assists}</td><td className={CB}>{tt.shotsOnGoal}</td><td className={CB}>{tt.shotsMissed}</td><td className={CB}>{pctFn(tt.goals, ttS)}</td><td className={CB}>{tt.groundballs}</td><td className={CB}>{tt.turnoversCaused}</td><td className={CB}>{tt.turnoversCommitted}</td><td className={CB}>{tt.faceoffsTaken}</td><td className={CB}>{tt.faceoffsWon}</td><td className={CB}>{pctFn(tt.faceoffsWon, tt.faceoffsTaken)}</td><td className={CB}>{tt.saves}</td><td className={CB}>{tt.opponentShots}</td><td className={CB}>{pctFn(tt.saves, tt.opponentShots)}</td><td className={CB}>{tt.penalties}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlayerSelectModal({ statType, roster, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md border-4 border-black my-8">
          <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">SELECT PLAYER</h3><p className="text-sm text-yellow-300 font-bold">{statType}</p></div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-4">{sortForStats(roster).map((p) => { const d = isDef(p); return <button key={p.id} onClick={() => onSelect(p)} className={"py-3 px-4 rounded-lg text-left border-2 active:scale-95 " + (d ? "bg-red-600 text-white border-black" : "bg-gray-100 border-gray-300")}><div className={"font-black text-sm " + (d ? "text-white" : "text-gray-800")}>#{p.number} {p.name}</div><div className={"text-xs font-bold " + (d ? "text-yellow-300" : "text-gray-600")}>{p.position}</div></button>; })}</div>
            <button onClick={onCancel} className="w-full py-3 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistSelectModal({ goalPlayer, roster, onSelect }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md border-4 border-black my-8">
          <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">WHO ASSISTED?</h3><p className="text-sm text-yellow-300 font-bold">Goal by {goalPlayer.name} #{goalPlayer.number}</p></div>
          <div className="p-4">
            <button onClick={() => onSelect(null)} className="w-full py-4 mb-3 bg-yellow-500 text-black rounded-lg font-black border-2 border-black active:scale-95">UNASSISTED</button>
            <div className="grid grid-cols-2 gap-2 mb-4">{sortForStats(roster).map((p) => {
              const d = isDef(p);
              const isScorer = p.id === goalPlayer.id;
              if (isScorer) return <div key={p.id} className="py-3 px-4 rounded-lg text-left border-2 bg-gray-200 border-gray-300 opacity-40"><div className="font-black text-sm text-gray-400">#{p.number} {p.name}</div><div className="text-xs font-bold text-gray-400">{p.position}</div></div>;
              return <button key={p.id} onClick={() => onSelect(p)} className={"py-3 px-4 rounded-lg text-left border-2 active:scale-95 " + (d ? "bg-red-600 text-white border-black" : "bg-gray-100 border-gray-300")}><div className={"font-black text-sm " + (d ? "text-white" : "text-gray-800")}>#{p.number} {p.name}</div><div className={"text-xs font-bold " + (d ? "text-yellow-300" : "text-gray-600")}>{p.position}</div></button>;
            })}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalChoice({ title, subtitle, choices, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
        <div className="bg-red-600 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">{title}</h3><p className="text-sm text-yellow-300 font-bold">{subtitle}</p></div>
        <div className="p-4 space-y-3">
          {choices.map((c, i) => <button key={i} onClick={c.action} className={"w-full py-4 rounded-lg font-black border-2 border-black active:scale-95 " + c.cls}>{c.label}</button>)}
          {onCancel && <button onClick={onCancel} className="w-full py-3 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ label, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-red-600">
        <div className="bg-red-700 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">CONFIRM DELETE</h3></div>
        <div className="p-4 space-y-3">
          <p className="text-center font-bold text-gray-800">Permanently delete <span className="text-red-600 font-black">{label}</span>?</p>
          <p className="text-center text-sm text-gray-500 font-bold">This cannot be undone.</p>
          <button onClick={onConfirm} className="w-full py-3 bg-red-700 text-white rounded-lg font-black border-2 border-black active:scale-95">YES, DELETE</button>
          <button onClick={onCancel} className="w-full py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function AdminModal({ adminInput, setAdminInput, adminErr, onUnlock, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full border-4 border-black">
        <div className="bg-gray-800 border-b-4 border-black p-4"><h3 className="text-xl font-black text-white">ADMIN ACCESS</h3><p className="text-sm text-gray-300 font-bold">Enter passcode</p></div>
        <div className="p-4 space-y-3">
          <input type="password" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} placeholder="Enter passcode" className="w-full px-4 py-3 border-2 border-black rounded-lg text-center text-lg font-black" />
          {adminErr && <p className="text-red-600 font-bold text-sm text-center">{adminErr}</p>}
          <button onClick={onUnlock} className="w-full py-3 bg-black text-yellow-400 rounded-lg font-black border-2 border-yellow-400 active:scale-95">UNLOCK</button>
          <button onClick={onCancel} className="w-full py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black active:scale-95">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [roster, setRoster] = useState([]);
  const [games, setGames] = useState([]);
  const [curGameId, setCurGameId] = useState(null);
  const [curGame, setCurGame] = useState(null);
  const [recorderName, setRecorderName] = useState("");
  const [selectedStats, setSelectedStats] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [activeGoalie, setActiveGoalie] = useState("");
  const [stats, setStats] = useState([]);
  const [goalSeq, setGoalSeq] = useState(0);
  const [gaSeq, setGaSeq] = useState(0);
  const [showPlayerSelect, setShowPlayerSelect] = useState(null);
  const [pendingGoal, setPendingGoal] = useState(null);
  const [pendingStat, setPendingStat] = useState(null);
  const [mergedData, setMergedData] = useState(null);
  const [recorderList, setRecorderList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formName, setFormName] = useState("");
  const [formStats, setFormStats] = useState([]);
  const [ngOpp, setNgOpp] = useState("");
  const [ngDate, setNgDate] = useState(todayStr());
  const [ngLoc, setNgLoc] = useState("");
  const [ngPt, setNgPt] = useState("quarters");
  const [editPlayer, setEditPlayer] = useState(null);
  const [epName, setEpName] = useState("");
  const [epNum, setEpNum] = useState("");
  const [epPos, setEpPos] = useState("Midfield");
  const [selectedGames, setSelectedGames] = useState([]);
  const [multiData, setMultiData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    let r = await sGet("roster:current");
    if (!r) { r = DEFAULT_ROSTER; await sSet("roster:current", r); }
    let mig = false; r = r.map((p) => { if (p.active === undefined) { mig = true; return { ...p, active: true }; } return p; });
    if (mig) await sSet("roster:current", r);
    setRoster(r);
    const g = await sGet("games:index") || [];
    const td = todayStr(); let ch = false;
    g.forEach((gm) => { if (gm.status === "active" && gm.date < td) { gm.status = "final"; ch = true; } });
    if (ch) await sSet("games:index", g);
    setGames(g);
    setLoading(false);
  })(); }, []);

  const saveRoster = async (r) => { setRoster(r); await sSet("roster:current", r); };
  const saveGames = async (g) => { setGames(g); await sSet("games:index", g); };
  const saveMyStats = useCallback(async () => { if (!curGameId || !recorderName) return; await sSet("game:" + curGameId + ":stats:" + recorderName, { stats, goalSeq, gaSeq }); }, [curGameId, recorderName, stats, goalSeq, gaSeq]);
  useEffect(() => { if (screen === "tracking" && curGameId && recorderName) saveMyStats(); }, [stats, goalSeq, gaSeq, screen, saveMyStats]);
  const gameRoster = (g) => g?.roster || roster;
  const activeRoster = () => roster.filter((p) => p.active !== false);
  const doAdminUnlock = () => { if (adminInput === "Team91") { setIsAdmin(true); setShowAdminPrompt(false); setAdminErr(""); } else { setAdminErr("Incorrect passcode"); setAdminInput(""); } };
  const doDelete = async () => { if (!confirmDelete) return; if (confirmDelete.type === "all") await saveGames([]); else { await saveGames(games.filter((gm) => gm.id !== confirmDelete.id)); } setConfirmDelete(null); };
  const openReview = async (g) => { setCurGameId(g.id); setCurGame(g); setBusy(true); const res = await loadGameMerge(g.id, g.roster || roster); setMergedData(res.merge); setRecorderList(res.recorders); if (res.merge) { setGoalSeq(res.merge.totalGoals); setGaSeq(res.merge.totalGA); } setBusy(false); setScreen("review"); };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 flex items-center justify-center"><div className="text-white text-2xl font-black">Loading...</div></div>;

  // ─── HOME ───
  if (screen === "home") {
    const actG = games.filter((g) => g.status === "active");
    const pastG = games.filter((g) => g.status === "final").sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black relative">
            {!isAdmin
              ? <button onClick={() => { setShowAdminPrompt(true); setAdminInput(""); setAdminErr(""); }} className="absolute top-3 right-3 text-xs font-bold text-gray-400">ADMIN</button>
              : <div className="absolute top-3 right-3 flex items-center gap-1"><span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-1 rounded border border-yellow-400">ADMIN</span><button onClick={() => setIsAdmin(false)} className="text-xs font-bold text-gray-400 underline">lock</button></div>
            }
            <div className="flex flex-col items-center mb-6"><LogoImg size="lg" /><div className="mt-2 text-sm font-bold text-gray-500">STAT TRACKER</div></div>
            <div className="space-y-3">
              <Btn onClick={() => { setNgOpp(""); setNgDate(todayStr()); setNgLoc(""); setNgPt("quarters"); setScreen("newgame"); }} cls="w-full bg-red-600 text-white py-4 rounded-lg font-black text-lg border-2 border-black">NEW GAME</Btn>
              <Btn onClick={() => setScreen("roster")} cls="w-full bg-white text-gray-800 py-3 rounded-lg font-black border-2 border-black">MANAGE ROSTER</Btn>
              <Btn onClick={() => { setSelectedGames([]); setMultiData(null); setScreen("multigame"); }} cls="w-full bg-white text-gray-800 py-3 rounded-lg font-black border-2 border-black">SEASON STATS</Btn>
            </div>
            {actG.length > 0 && <div className="mt-6"><h3 className="font-black text-gray-800 mb-2 text-sm">ACTIVE GAMES</h3>{actG.map((g) => (
              <div key={g.id} className="mb-2 bg-green-50 border-2 border-green-400 rounded-lg p-3">
                <div className="font-black text-green-800">{g.date} vs {g.opponent}</div>
                <div className="text-sm text-green-600 font-bold">{g.location}</div>
                {g.goalsFor != null && <div className="text-sm font-black text-gray-700 mt-1">Score: {g.goalsFor}-{g.goalsAgainst}</div>}
                <div className="flex gap-2 mt-2">
                  <Btn onClick={() => { setCurGameId(g.id); setCurGame(g); setFormName(""); setFormStats([]); setScreen("join"); }} cls="flex-1 py-1 bg-green-600 text-white rounded text-xs font-black border border-black">JOIN</Btn>
                  <Btn onClick={async () => { await saveGames(games.map((x) => x.id === g.id ? { ...x, status: "final" } : x)); }} cls="flex-1 py-1 bg-gray-600 text-white rounded text-xs font-black border border-black">FINALIZE</Btn>
                  <Btn onClick={() => openReview(g)} cls="flex-1 py-1 bg-blue-600 text-white rounded text-xs font-black border border-black">STATS</Btn>
                  {isAdmin && <Btn onClick={() => setConfirmDelete({ type: "game", id: g.id, label: g.date + " vs " + g.opponent })} cls="py-1 px-2 bg-red-700 text-white rounded text-xs font-black border border-black">DEL</Btn>}
                </div>
              </div>
            ))}</div>}
            {pastG.length > 0 && <div className="mt-4"><h3 className="font-black text-gray-800 mb-2 text-sm">PAST GAMES</h3><div className="space-y-2 max-h-64 overflow-y-auto">{pastG.map((g) => {
              const wl = g.goalsFor != null ? (g.goalsFor > g.goalsAgainst ? "W" : g.goalsFor < g.goalsAgainst ? "L" : "T") + " " + g.goalsFor + "-" + g.goalsAgainst : "";
              return (
                <div key={g.id} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
                  <Btn onClick={() => openReview(g)} cls="w-full text-left">
                    <div className="flex justify-between items-center">
                      <div><div className="font-black text-gray-800">{g.date} vs {g.opponent}</div><div className="text-xs text-gray-500 font-bold">{g.location}</div></div>
                      {wl && <div className={"font-black text-lg " + (wl[0] === "W" ? "text-green-600" : wl[0] === "L" ? "text-red-600" : "text-gray-600")}>{wl}</div>}
                    </div>
                  </Btn>
                  <div className="flex gap-2 mt-2">
                    <Btn onClick={async () => { await saveGames(games.map((x) => x.id === g.id ? { ...x, status: "active" } : x)); }} cls="flex-1 py-1 bg-yellow-400 text-black rounded text-xs font-black border border-black">REACTIVATE</Btn>
                    {isAdmin && <Btn onClick={() => setConfirmDelete({ type: "game", id: g.id, label: g.date + " vs " + g.opponent })} cls="py-1 px-3 bg-red-700 text-white rounded text-xs font-black border border-black">DELETE</Btn>}
                  </div>
                </div>
              );
            })}</div></div>}
            {isAdmin && games.length > 0 && <div className="mt-4 pt-4 border-t-2 border-gray-200"><Btn onClick={() => setConfirmDelete({ type: "all", label: "ALL GAMES" })} cls="w-full py-2 bg-red-700 text-white rounded-lg font-black text-sm border-2 border-black">DELETE ALL GAMES</Btn></div>}
          </div>
        </div>
        {showAdminPrompt && <AdminModal adminInput={adminInput} setAdminInput={setAdminInput} adminErr={adminErr} onUnlock={doAdminUnlock} onCancel={() => { setShowAdminPrompt(false); setAdminErr(""); }} />}
        {confirmDelete && <ConfirmModal label={confirmDelete.label} onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />}
      </div>
    );
  }

  // ─── ROSTER ───
  if (screen === "roster") {
    const startEdit = (p) => { setEditPlayer(p); setEpName(p.name); setEpNum(String(p.number)); setEpPos(p.position); };
    const savePlayer = async () => {
      let r; if (editPlayer.id === "NEW") r = [...roster, { id: genId(), name: epName, number: parseInt(epNum) || 0, position: epPos, active: true }];
      else r = roster.map((p) => p.id === editPlayer.id ? { ...p, name: epName, number: parseInt(epNum) || 0, position: epPos } : p);
      await saveRoster(sortByNum(r)); setEditPlayer(null);
    };
    const toggleActive = async (id) => { await saveRoster(roster.map((p) => p.id === id ? { ...p, active: !p.active } : p)); };
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={() => setScreen("home")} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <h2 className="text-xl font-black text-black text-center mb-4">MANAGE ROSTER</h2>
        <Btn onClick={() => { setEditPlayer({ id: "NEW" }); setEpName(""); setEpNum(""); setEpPos("Midfield"); }} cls="w-full bg-green-600 text-white py-3 rounded-lg font-black border-2 border-black mb-4">+ ADD PLAYER</Btn>
        {editPlayer && <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4"><h3 className="font-black text-sm mb-2">{editPlayer.id === "NEW" ? "ADD PLAYER" : "EDIT PLAYER"}</h3><div className="space-y-2">
          <input type="text" value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="Last name" className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm font-bold" />
          <input type="number" value={epNum} onChange={(e) => setEpNum(e.target.value)} placeholder="Jersey #" className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm font-bold" />
          <div className="grid grid-cols-3 gap-1">{POSITIONS.map((pos) => <Btn key={pos} onClick={() => setEpPos(pos)} cls={"py-2 px-1 rounded text-xs font-black border-2 " + (epPos === pos ? "bg-red-600 text-white border-red-800" : "bg-white text-gray-700 border-black")}>{pos}</Btn>)}</div>
          <div className="flex gap-2"><Btn onClick={savePlayer} disabled={!epName || !epNum} cls="flex-1 bg-green-600 text-white py-2 rounded-lg font-black border-2 border-black disabled:bg-gray-400">SAVE</Btn><Btn onClick={() => setEditPlayer(null)} cls="flex-1 bg-gray-600 text-white py-2 rounded-lg font-black border-2 border-black">CANCEL</Btn></div>
        </div></div>}
        <div className="space-y-1 max-h-96 overflow-y-auto">{sortByNum(roster).map((p) => {
          const inactive = p.active === false;
          return <div key={p.id} className={"flex items-center justify-between py-2 px-3 rounded-lg border-2 " + (inactive ? "bg-gray-200 border-gray-300 opacity-60" : "bg-gray-50 border-gray-200")}>
            <div><span className="font-black">#{p.number}</span> <span className="font-bold">{p.name}</span> <span className="text-xs font-bold text-gray-500">({p.position})</span>{inactive && <span className="text-xs font-bold text-red-500 ml-1">[INACTIVE]</span>}</div>
            <div className="flex gap-1"><Btn onClick={() => startEdit(p)} cls="p-1 rounded text-blue-600"><Edit3 className="w-4 h-4" /></Btn><Btn onClick={() => toggleActive(p.id)} cls={"px-2 py-1 rounded text-xs font-black border " + (inactive ? "bg-green-100 text-green-700 border-green-400" : "bg-red-100 text-red-700 border-red-400")}>{inactive ? "ACTIVATE" : "DEACTIVATE"}</Btn></div>
          </div>;
        })}</div>
        <p className="text-xs text-gray-500 mt-3 font-bold">Inactive players won't appear during stat tracking but remain in historical data.</p>
      </div></div></div>
    );
  }

  // ─── NEW GAME ───
  if (screen === "newgame") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={() => setScreen("home")} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <LogoImg size="md" /><h2 className="text-xl font-black text-black text-center mb-4 mt-2">NEW GAME</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-gray-700 mb-1">Opponent</label><input type="text" value={ngOpp} onChange={(e) => setNgOpp(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Opponent name" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">Date</label><input type="date" value={ngDate} onChange={(e) => setNgDate(e.target.value)} className="w-full px-2 py-2 border-2 border-black rounded-lg text-sm" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-1">Location</label><input type="text" value={ngLoc} onChange={(e) => setNgLoc(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Field/venue" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Format</label><div className="flex gap-4"><Btn onClick={() => setNgPt("quarters")} cls={"flex-1 py-3 rounded-lg font-black border-2 border-black " + (ngPt === "quarters" ? "bg-red-600 text-white" : "bg-white text-gray-700")}>Quarters</Btn><Btn onClick={() => setNgPt("halves")} cls={"flex-1 py-3 rounded-lg font-black border-2 border-black " + (ngPt === "halves" ? "bg-red-600 text-white" : "bg-white text-gray-700")}>Halves</Btn></div></div>
          <Btn onClick={async () => { const id = genId(); const per = ngPt === "quarters" ? ["Q1","Q2","Q3","Q4"] : ["1st Half","2nd Half"]; const ar = activeRoster(); const g = { id, date: ngDate, opponent: ngOpp, location: ngLoc, periodType: ngPt, periods: per, status: "active", roster: [...ar], goalsFor: null, goalsAgainst: null }; await saveGames([g, ...games]); await sSet("game:" + id + ":info", g); setCurGameId(id); setCurGame(g); setFormName(""); setFormStats([]); setScreen("join"); }} disabled={!ngOpp || !ngLoc} cls="w-full bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400 disabled:bg-gray-400 disabled:border-gray-400">CREATE GAME</Btn>
        </div>
      </div></div></div>
    );
  }

  // ─── JOIN ───
  if (screen === "join") {
    const gr = gameRoster(curGame); const goalies = gr.filter((p) => p.position === "Goalie");
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-md mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={() => setScreen("home")} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <div className="text-center mb-4 bg-green-50 p-3 rounded-lg border-2 border-green-300"><div className="text-xl font-black text-black">vs {curGame?.opponent}</div><div className="text-sm font-bold text-gray-600">{curGame?.date} - {curGame?.location}</div></div>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-2 border-2 border-black rounded-lg" placeholder="Your name" /></div>
          <StatPicker stats={formStats} setStats={setFormStats} />
          <Btn onClick={async () => { setRecorderName(formName); setSelectedStats(formStats); setCurrentPeriod(curGame.periods[0]); setActiveGoalie(goalies.length ? goalies[0].name : ""); const ex = await sGet("game:" + curGameId + ":stats:" + formName); if (ex) { setStats(ex.stats || []); setGoalSeq(ex.goalSeq || 0); setGaSeq(ex.gaSeq || 0); } else { setStats([]); setGoalSeq(0); setGaSeq(0); } setScreen("tracking"); }} disabled={!formName || formStats.length === 0} cls="w-full bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400 disabled:bg-gray-400 disabled:border-gray-400">START TRACKING</Btn>
        </div>
      </div></div></div>
    );
  }

  // ─── TRACKING ───
  if (screen === "tracking") {
    const gr = gameRoster(curGame); const goalies = gr.filter((p) => p.position === "Goalie"); const pIdx = curGame.periods.indexOf(currentPeriod);
    const rec = (st) => { if (["Shot","Faceoffs","Groundballs","Turnovers Caused","Turnovers Committed","Penalties"].includes(st)) setShowPlayerSelect(st); else if (st === "Opponent Shot") setPendingStat({ type: "Opponent Shot" }); };
    const hPS = (p) => { if (showPlayerSelect === "Shot") { setPendingStat({ type: "Shot", player: p }); } else if (showPlayerSelect === "Penalties") { setPendingStat({ type: "Penalties", player: p }); } else if (showPlayerSelect === "Faceoffs") { setPendingStat({ type: "Faceoffs", player: p }); } else { setStats((prev) => [...prev, { recorder: recorderName, type: showPlayerSelect, player: p.name, number: p.number, period: currentPeriod, timestamp: Date.now() }]); } setShowPlayerSelect(null); };
    const hAS = (ap) => { const ns = [{ recorder: recorderName, type: "Goals", player: pendingGoal.player.name, number: pendingGoal.player.number, period: currentPeriod, sequence: pendingGoal.sequence, timestamp: Date.now() }]; if (ap) ns.push({ recorder: recorderName, type: "Assists", player: ap.name, number: ap.number, period: currentPeriod, goalSequence: pendingGoal.sequence, timestamp: Date.now() }); setStats((prev) => [...prev, ...ns]); setGoalSeq(pendingGoal.sequence); setPendingGoal(null); };
    const hSR = (r) => { if (r === "Score") { setPendingGoal({ player: pendingStat.player, sequence: goalSeq + 1 }); } else { setStats((prev) => [...prev, { recorder: recorderName, type: r === "On Goal" ? "Shot on Goal" : "Shot Missed", player: pendingStat.player.name, number: pendingStat.player.number, period: currentPeriod, timestamp: Date.now() }]); } setPendingStat(null); };
    const hOR = (r) => { if (r === "Goal") { setStats((prev) => [...prev, { recorder: recorderName, type: "Goal Against", period: currentPeriod, sequence: gaSeq + 1, goalie: activeGoalie, timestamp: Date.now() }]); setGaSeq((p) => p + 1); } else { setStats((prev) => [...prev, { recorder: recorderName, type: r === "Save" ? "Save" : "Opponent Shot Miss", goalie: activeGoalie, period: currentPeriod, timestamp: Date.now() }]); } setPendingStat(null); };
    const hPT = (pt) => { setStats((prev) => [...prev, { recorder: recorderName, type: "Penalty", penaltyType: pt, player: pendingStat.player.name, number: pendingStat.player.number, period: currentPeriod, timestamp: Date.now() }]); setPendingStat(null); };
    const hFO = (r) => { setStats((prev) => [...prev, { recorder: recorderName, type: r === "Won" ? "Faceoffs Won" : "Faceoffs Lost", player: pendingStat.player.name, number: pendingStat.player.number, period: currentPeriod, timestamp: Date.now() }]); setPendingStat(null); };
    const undo = () => { if (!stats.length) return; const l = stats[stats.length - 1]; if (l.type === "Goals") setGoalSeq((p) => p - 1); else if (l.type === "Goal Against") setGaSeq((p) => p - 1); setStats((p) => p.slice(0, -1)); };
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4 pb-20"><div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-4 mb-4 border-4 border-black">
          <div className="text-center mb-3"><LogoImg size="sm" /><h2 className="text-lg font-black">{curGame.date} vs {curGame.opponent}</h2><p className="text-xs font-bold text-gray-600">{curGame.location} - Rec: <span className="text-red-600">{recorderName}</span></p></div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Btn onClick={() => { if (pIdx > 0) setCurrentPeriod(curGame.periods[pIdx - 1]); }} disabled={pIdx === 0} cls="px-3 py-1 bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 rounded font-black border-2 border-black">←</Btn>
            <div className="px-6 py-2 bg-red-600 text-white font-black rounded-lg text-lg border-2 border-black">{currentPeriod}</div>
            <Btn onClick={() => { if (pIdx < curGame.periods.length - 1) setCurrentPeriod(curGame.periods[pIdx + 1]); }} disabled={pIdx === curGame.periods.length - 1} cls="px-3 py-1 bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 rounded font-black border-2 border-black">→</Btn>
          </div>
          <div className="flex justify-center gap-2">{goalies.map((g) => <Btn key={g.id} onClick={() => setActiveGoalie(g.name)} cls={"px-4 py-2 rounded-lg font-black border-2 border-black " + (activeGoalie === g.name ? "bg-yellow-400 text-black" : "bg-white text-gray-700")}>{g.name} #{g.number}</Btn>)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-2xl p-4 mb-4 border-4 border-black"><div className="grid grid-cols-2 gap-4 text-center"><div><div className="text-5xl font-black text-red-600">{goalSeq}</div><div className="text-sm font-bold text-gray-600 mt-1">Goals For</div></div><div><div className="text-5xl font-black text-gray-700">{gaSeq}</div><div className="text-sm font-bold text-gray-600 mt-1">Goals Against</div></div></div></div>
        <div className="bg-white rounded-lg shadow-2xl p-4 border-4 border-black mb-4">
          <div className="flex justify-between items-center mb-3"><h3 className="font-black text-gray-800">RECORD STATS</h3>{stats.length > 0 && <Btn onClick={undo} cls="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded-lg font-bold text-sm border-2 border-black"><Undo2 className="w-4 h-4" />UNDO</Btn>}</div>
          <div className="grid grid-cols-2 gap-3">
            {selectedStats.includes("Shot") && <Btn onClick={() => rec("Shot")} cls="py-4 bg-red-600 text-white rounded-lg font-black border-2 border-black col-span-2">SHOT</Btn>}
            {selectedStats.includes("Opponent Shot") && <Btn onClick={() => rec("Opponent Shot")} cls="py-4 bg-gray-700 text-white rounded-lg font-black border-2 border-black col-span-2">OPPONENT SHOT</Btn>}
            {selectedStats.filter((s) => s !== "Shot" && s !== "Opponent Shot").map((st) => <Btn key={st} onClick={() => rec(st)} cls="py-3 bg-red-600 text-white rounded-lg font-bold border-2 border-black">{st.toUpperCase()}</Btn>)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-2xl p-4 border-4 border-black">
          <h3 className="font-black text-gray-800 mb-2">RECENT (Last 10)</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {stats.slice(-10).reverse().map((s, i) => <div key={i} className="text-sm py-2 px-3 bg-gray-50 rounded border-2 border-gray-200"><span className="font-black">{s.type}</span>{s.player && " - " + s.player + " #" + s.number}{s.penaltyType && " - " + s.penaltyType}{s.sequence && " (" + (s.type === "Goals" ? "Goal" : "GA") + " #" + s.sequence + ")"}<span className="text-gray-500 text-xs ml-2 font-bold">{s.period}</span></div>)}
            {stats.length === 0 && <p className="text-gray-500 text-center py-4 font-bold">No stats recorded yet</p>}
          </div>
          <div className="mt-2 text-xs text-gray-500 font-bold text-center">{stats.length} stats recorded</div>
        </div>
        <Btn onClick={async () => { setBusy(true); await saveMyStats(); setBusy(false); }} cls="w-full mt-4 py-2 rounded-lg font-black border-2 border-black bg-green-600 text-white">{busy ? "SAVING..." : "SAVE MY STATS"}</Btn>
        <Btn onClick={async () => { setBusy(true); await saveMyStats(); const res = await loadGameMerge(curGameId, gr); setMergedData(res.merge); setRecorderList(res.recorders); if (res.merge) { setGoalSeq(res.merge.totalGoals); setGaSeq(res.merge.totalGA); const ng = games.map((g) => g.id === curGameId ? { ...g, goalsFor: res.merge.totalGoals, goalsAgainst: res.merge.totalGA } : g); await saveGames(ng); setCurGame(ng.find((g) => g.id === curGameId)); } setBusy(false); setScreen("review"); }} cls="w-full mt-2 bg-black text-yellow-400 py-4 rounded-lg font-black text-lg border-2 border-yellow-400">{busy ? "SAVING..." : "SAVE & REVIEW"}</Btn>
      </div>
      {showPlayerSelect && !pendingGoal && !pendingStat && <PlayerSelectModal statType={showPlayerSelect} roster={gr} onSelect={hPS} onCancel={() => setShowPlayerSelect(null)} />}
      {pendingGoal && !showPlayerSelect && !pendingStat && <AssistSelectModal goalPlayer={pendingGoal.player} roster={gr} onSelect={hAS} />}
      {pendingStat?.type === "Shot" && pendingStat.player && !showPlayerSelect && <ModalChoice title="SHOT RESULT" subtitle={pendingStat.player.name + " #" + pendingStat.player.number} choices={[{ label: "SCORE", cls: "bg-green-500 text-white", action: () => hSR("Score") }, { label: "ON GOAL", cls: "bg-yellow-500 text-black", action: () => hSR("On Goal") }, { label: "MISS", cls: "bg-red-500 text-white", action: () => hSR("Miss") }]} onCancel={() => setPendingStat(null)} />}
      {pendingStat?.type === "Opponent Shot" && !showPlayerSelect && <ModalChoice title="OPPONENT SHOT" subtitle={"Goalie: " + activeGoalie} choices={[{ label: "SAVE", cls: "bg-green-500 text-white", action: () => hOR("Save") }, { label: "MISS", cls: "bg-yellow-500 text-black", action: () => hOR("Miss") }, { label: "GOAL", cls: "bg-red-500 text-white", action: () => hOR("Goal") }]} onCancel={() => setPendingStat(null)} />}
      {pendingStat?.type === "Penalties" && pendingStat.player && !showPlayerSelect && <ModalChoice title="PENALTY" subtitle={pendingStat.player.name + " #" + pendingStat.player.number} choices={[{ label: "TECHNICAL (30s)", cls: "bg-yellow-500 text-black", action: () => hPT("Technical Foul (30s)") }, { label: "PERSONAL (60s)", cls: "bg-orange-500 text-white", action: () => hPT("Personal Foul (60s)") }, { label: "FLAGRANT (2-3min)", cls: "bg-red-500 text-white", action: () => hPT("Flagrant Foul (2-3min)") }]} onCancel={() => setPendingStat(null)} />}
      {pendingStat?.type === "Faceoffs" && pendingStat.player && !showPlayerSelect && <ModalChoice title="FACEOFF" subtitle={pendingStat.player.name + " #" + pendingStat.player.number} choices={[{ label: "WON", cls: "bg-green-500 text-white", action: () => hFO("Won") }, { label: "LOST", cls: "bg-red-500 text-white", action: () => hFO("Lost") }]} onCancel={() => setPendingStat(null)} />}
      </div>
    );
  }

  // ─── REVIEW ───
  if (screen === "review") {
    const gr = gameRoster(curGame);
    let ps, tG, tGA;
    if (mergedData) { ps = mergedData.playerStats; tG = mergedData.totalGoals; tGA = mergedData.totalGA; }
    else { const m = mergeAllStats({ local: { stats, goalSeq, gaSeq } }, gr); ps = m.playerStats; tG = m.totalGoals; tGA = m.totalGA; }
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-6xl mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 border-4 border-black">
        <div className="text-center mb-4"><LogoImg size="md" /><h2 className="text-2xl font-black text-black mt-2">GAME SUMMARY</h2></div>
        <div className="mb-4 text-center"><p className="font-bold text-gray-700"><span className="font-black">Opponent:</span> {curGame?.opponent}</p><p className="font-bold text-gray-700">{curGame?.date} - {curGame?.location}</p><p className="text-3xl font-black mt-2"><span className="text-red-600">{tG}</span> - <span className="text-gray-700">{tGA}</span></p></div>
        {recorderList.length > 0 && <div className="mb-3 bg-blue-50 p-2 rounded-lg border-2 border-blue-200 text-center"><span className="text-sm font-black text-blue-800">{recorderList.length} recorder{recorderList.length > 1 ? "s" : ""}: </span><span className="text-sm font-bold text-blue-700">{recorderList.join(", ")}</span></div>}
        <StatsTable playerStats={ps} />
        <div className="mt-4 text-xs text-gray-600"><p className="font-bold">G=Goals, A=Assists, SOG=On Goal, SM=Missed, GB=Groundballs, TC=Caused, TComm=Committed, FO=Faceoffs, SV=Saves, SA=Against, PEN=Penalties</p></div>
        <CopyBtn label="COPY TABLE" doneLabel="✓ COPIED!" cls="mt-4" />
        <Btn onClick={async () => { setBusy(true); const res = await loadGameMerge(curGameId, gr); if (res.merge) setMergedData(res.merge); setRecorderList(res.recorders); setBusy(false); }} cls="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg font-black border-2 border-black">{busy ? "REFRESHING..." : "REFRESH DATA"}</Btn>
        <Btn onClick={() => { setScreen("home"); setMergedData(null); setRecorderList([]); }} cls="w-full mt-2 bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400">BACK TO HOME</Btn>
      </div></div></div>
    );
  }

  // ─── SEASON STATS ───
  if (screen === "multigame") {
    const fG = games.filter((g) => g.status === "final" && g.goalsFor != null).sort((a, b) => b.date.localeCompare(a.date));
    const toggle = (id) => setSelectedGames((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
    const agg = async () => { setBusy(true); const allPs = {}; for (const gId of selectedGames) { const g = games.find((x) => x.id === gId); const res = await loadGameMerge(gId, gameRoster(g)); if (res.merge) { Object.entries(res.merge.playerStats).forEach(([k, p]) => { if (!allPs[k]) allPs[k] = { ...p }; else Object.keys(p).forEach((f) => { if (typeof p[f] === "number") allPs[k][f] += p[f]; }); }); } } setMultiData({ playerStats: allPs, gameCount: selectedGames.length }); setBusy(false); };
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-yellow-500 p-4"><div className="max-w-6xl mx-auto"><div className="bg-white rounded-lg shadow-2xl p-6 mt-4 border-4 border-black">
        <Btn onClick={() => { setScreen("home"); setMultiData(null); }} cls="text-gray-500 font-black mb-4">← BACK</Btn>
        <h2 className="text-xl font-black text-black text-center mb-4">SEASON STATS</h2>
        {!multiData && <div>
          <p className="text-sm font-bold text-gray-600 mb-3">Select games to aggregate:</p>
          {fG.length === 0 && <p className="text-gray-500 text-center py-4 font-bold">No finalized games yet</p>}
          <div className="flex gap-2 mb-3"><Btn onClick={() => setSelectedGames(fG.map((g) => g.id))} cls="flex-1 py-2 bg-yellow-400 text-black rounded-lg font-black border-2 border-black text-sm">SELECT ALL</Btn><Btn onClick={() => setSelectedGames([])} cls="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-black border-2 border-black text-sm">CLEAR</Btn></div>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">{fG.map((g) => {
            const sel = selectedGames.includes(g.id); const wl = (g.goalsFor > g.goalsAgainst ? "W" : g.goalsFor < g.goalsAgainst ? "L" : "T") + " " + g.goalsFor + "-" + g.goalsAgainst;
            return <Btn key={g.id} onClick={() => toggle(g.id)} cls={"w-full rounded-lg p-3 text-left border-2 " + (sel ? "bg-red-50 border-red-500" : "bg-gray-50 border-gray-300")}><div className="flex justify-between items-center"><div className="flex items-center gap-2">{sel ? <Check className="w-5 h-5 text-red-600 flex-shrink-0" /> : <div className="w-5 h-5 border-2 border-gray-400 rounded flex-shrink-0" />}<div><div className="font-black text-gray-800">{g.date} vs {g.opponent}</div><div className="text-xs text-gray-500 font-bold">{g.location}</div></div></div><div className={"font-black " + (wl[0] === "W" ? "text-green-600" : wl[0] === "L" ? "text-red-600" : "text-gray-600")}>{wl}</div></div></Btn>;
          })}</div>
          <Btn onClick={agg} disabled={selectedGames.length < 1 || busy} cls="w-full bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400 disabled:bg-gray-400 disabled:border-gray-400">{busy ? "CALCULATING..." : "VIEW STATS (" + selectedGames.length + " GAME" + (selectedGames.length !== 1 ? "S" : "") + ")"}</Btn>
        </div>}
        {multiData && <div>
          <div className="mb-4 text-center"><LogoImg size="md" /><div className="mt-2 text-lg font-black text-gray-800">COMBINED - {multiData.gameCount} GAME{multiData.gameCount !== 1 ? "S" : ""}</div></div>
          <StatsTable playerStats={multiData.playerStats} />
          <div className="mt-4 text-xs text-gray-600"><p className="font-bold">Stats summed across selected games. Percentages from combined totals.</p></div>
          <CopyBtn label="COPY TABLE" doneLabel="✓ COPIED!" cls="mt-4" />
          <Btn onClick={() => setMultiData(null)} cls="w-full mt-2 py-2 bg-gray-600 text-white rounded-lg font-black border-2 border-black">BACK TO SELECTION</Btn>
          <Btn onClick={() => { setScreen("home"); setMultiData(null); }} cls="w-full mt-2 bg-black text-yellow-400 py-3 rounded-lg font-black text-lg border-2 border-yellow-400">BACK TO HOME</Btn>
        </div>}
      </div></div></div>
    );
  }

  return null;
}
