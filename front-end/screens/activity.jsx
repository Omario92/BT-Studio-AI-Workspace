const ACT_USERS = [
  { k: "alice",  l: "Alice Chen",  c: 18 },
  { k: "david",  l: "David Kim",   c: 12 },
  { k: "sarah",  l: "Sarah M.",    c:  9 },
  { k: "tom",    l: "Tom L.",      c: 14 },
  { k: "maria",  l: "Maria R.",    c:  7 },
];

const ACT_PROJECTS = [
  { k: "huda",   l: "Huda Commercial",    c: 22 },
  { k: "halida", l: "Halida Fresh Beer",  c: 16 },
  { k: "excool", l: "Coolmate Excool KV", c: 11 },
  { k: "obagi",  l: "Obagi Skin Lab",     c:  6 },
  { k: "render", l: "Product Render V3",  c:  4 },
];

const ACT_ACTIONS = [
  { k: "gen",     l: "Generated",  c: 24 },
  { k: "upload",  l: "Uploaded",   c: 13 },
  { k: "approve", l: "Approved",   c:  9 },
  { k: "comment", l: "Commented",  c: 14 },
  { k: "revise",  l: "Revised",    c:  6 },
  { k: "reject",  l: "Rejected",   c:  3 },
];

// Map filter keys to timeline field matchers
const USER_MAP   = { alice:"Alice Chen", david:"David Kim", sarah:"Sarah M.", tom:"Tom L.", maria:"Maria R." };
const PROJ_MAP   = { huda:"Huda Commercial", halida:"Halida Fresh Beer", excool:"Coolmate Excool KV", obagi:"Obagi Skin Lab", render:"Product Render V3" };
const ACTION_MAP = { gen:"generat", upload:"upload", approve:"approv", comment:"comment", revise:"revis", reject:"reject" };

const TIMELINE = [
  { t: "10:42 AM", daysAgo: 0,  u: "Alice Chen", i: "AC", c: "a", act: "generated",        obj: "Frame_18_v3.png",                proj: "Halida Fresh Beer",  icon: "approved", attach: { tone:"violet", label:"FRAME_18" } },
  { t: "10:31 AM", daysAgo: 0,  u: "Sarah M.",   i: "SM", c: "c", act: "approved",          obj: "KV_Hero_Image_v4.png",           proj: "Huda Commercial",    icon: "green",   chip: { cls:"chip chip--approved", text:"v4 approved" } },
  { t: "10:14 AM", daysAgo: 0,  u: "David Kim",  i: "DK", c: "b", act: "uploaded",          obj: "Character_Ref_HERO_03.jpg",      proj: "Huda Commercial",    icon: "blue",    attach: { tone:"rose", label:"CHAR REF" } },
  { t: "09:58 AM", daysAgo: 0,  u: "Maria R.",   i: "MR", c: "d", act: "commented on",      obj: "Character_Sheet_v2.jpg",         proj: "Huda Commercial",    icon: "amber",
    comment: "Eyes a bit too saturated, can we cool the skin tone? Also the hair highlight on v2 lost some specularity vs v1." },
  { t: "09:42 AM", daysAgo: 0,  u: "Tom L.",     i: "TL", c: "e", act: "completed batch",   obj: "Excool Sketch Pack · 32 frames", proj: "Coolmate Excool KV", icon: "green",   chip: { cls:"chip chip--approved", text:"32 ok · 0 failed" } },
  { t: "09:21 AM", daysAgo: 0,  u: "Tom L.",     i: "TL", c: "e", act: "rejected",          obj: "Bottle_Hero_v1.png",             proj: "Halida Fresh Beer",  icon: "red",
    comment: "Glass refraction is wrong — re-run with new env ref. See attached." },
  { t: "09:04 AM", daysAgo: 0,  u: "Alice Chen", i: "AC", c: "a", act: "revised",           obj: "Style_Sheet_Final.png",          proj: "Obagi Skin Lab",     icon: "amber" },
  { t: "08:47 AM", daysAgo: 0,  u: "David Kim",  i: "DK", c: "b", act: "regenerated",       obj: "Frame_20_v2.png with locked seed",proj: "Halida Fresh Beer", icon: "blue",    attach: { tone:"mono", label:"FRAME_20" } },
  { t: "08:32 AM", daysAgo: 0,  u: "Sarah M.",   i: "SM", c: "c", act: "started review on", obj: "Storyboard Act 02",              proj: "Halida Fresh Beer",  icon: "default" },
  { t: "03:15 PM", daysAgo: 2,  u: "David Kim",  i: "DK", c: "b", act: "generated",         obj: "Env_Ref_Sunset_v2.png",          proj: "Halida Fresh Beer",  icon: "blue",    attach: { tone:"amber", label:"ENV_REF" } },
  { t: "11:08 AM", daysAgo: 2,  u: "Alice Chen", i: "AC", c: "a", act: "approved",          obj: "Product_Render_v3.png",          proj: "Huda Commercial",    icon: "green",   chip: { cls:"chip chip--approved", text:"v3 approved" } },
  { t: "09:30 AM", daysAgo: 3,  u: "Sarah M.",   i: "SM", c: "c", act: "uploaded",          obj: "Brand_Guide_2026.pdf",           proj: "Obagi Skin Lab",     icon: "blue" },
  { t: "02:44 PM", daysAgo: 4,  u: "Tom L.",     i: "TL", c: "e", act: "completed batch",   obj: "Character Pack A · 16 frames",  proj: "Coolmate Excool KV", icon: "green",   chip: { cls:"chip chip--approved", text:"16 ok · 2 failed" } },
  { t: "10:22 AM", daysAgo: 5,  u: "Maria R.",   i: "MR", c: "d", act: "commented on",      obj: "KV_Draft_v1.png",                proj: "Huda Commercial",    icon: "amber",
    comment: "Lighting feels flat on the left side. Can we push more contrast?" },
  { t: "04:01 PM", daysAgo: 8,  u: "Alice Chen", i: "AC", c: "a", act: "generated",         obj: "Frame_01_v1.png",                proj: "Product Render V3",  icon: "default", attach: { tone:"teal", label:"FRAME_01" } },
  { t: "01:15 PM", daysAgo: 12, u: "David Kim",  i: "DK", c: "b", act: "revised",           obj: "Character_Sheet_v1.jpg",         proj: "Huda Commercial",    icon: "amber" },
  { t: "09:55 AM", daysAgo: 18, u: "Tom L.",     i: "TL", c: "e", act: "rejected",          obj: "Env_Background_v2.png",          proj: "Halida Fresh Beer",  icon: "red",
    comment: "Wrong aspect ratio for vertical format. Please redo at 9:16." },
  { t: "03:30 PM", daysAgo: 25, u: "Sarah M.",   i: "SM", c: "c", act: "approved",          obj: "Storyboard Act 01",              proj: "Halida Fresh Beer",  icon: "green",   chip: { cls:"chip chip--approved", text:"act 01 locked" } },
];

// Controlled FilterGroup — accepts selected + onChange from parent
function FilterGroup({ title, items, selected = {}, onChange }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="filter-group">
      <h4 className="filter-group__title">
        <button onClick={() => setOpen(!open)} style={{display:"inline-flex", alignItems:"center", gap:6, color:"inherit", fontFamily:"inherit"}}>
          <span style={{display:"inline-flex", color:"var(--ink-4)"}}>{open ? I.chevDownTiny : I.chevRightTiny}</span>
          {title}
        </button>
      </h4>
      {open && items.map(it => {
        const on = !!selected[it.k];
        return (
          <button key={it.k}
            className={`filter-item ${on ? "on" : ""}`}
            onClick={() => onChange({ ...selected, [it.k]: !on })}>
            <span style={{
              background: on ? "var(--accent)" : "transparent",
              borderColor: on ? "var(--accent)" : "var(--line-strong)",
              borderWidth: 1.5, borderStyle: "solid", borderRadius: 4,
              width: 14, height: 14, display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {on ? <span style={{
                width: 6, height: 3,
                borderLeft: "1.5px solid #fff", borderBottom: "1.5px solid #fff",
                transform: "rotate(-45deg)", marginTop: -1,
              }} /> : null}
            </span>
            <span>{it.l}</span>
            <span className="filter-count">{it.c}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActivityLog() {
  const [timeline, setTimeline] = React.useState(TIMELINE);

  // Pending filter state (committed on Apply)
  const [pendingUsers,    setPendingUsers]    = React.useState({});
  const [pendingProjects, setPendingProjects] = React.useState({});
  const [pendingActions,  setPendingActions]  = React.useState({});
  const [pendingDate,     setPendingDate]     = React.useState("24h");
  const [pendingSearch,   setPendingSearch]   = React.useState("");
  const [customFrom,      setCustomFrom]      = React.useState("");
  const [customTo,        setCustomTo]        = React.useState("");

  // Applied filter state (updated when Apply clicked)
  const [appliedUsers,    setAppliedUsers]    = React.useState({});
  const [appliedProjects, setAppliedProjects] = React.useState({});
  const [appliedActions,  setAppliedActions]  = React.useState({});
  const [appliedDate,     setAppliedDate]     = React.useState("24h");
  const [appliedSearch,   setAppliedSearch]   = React.useState("");

  const [applyFlash, setApplyFlash] = React.useState(false);
  const [viewMode, setViewMode] = React.useState("timeline");

  const DATE_LIMITS = { "24h": 1, "7d": 7, "30d": 30, "custom": Infinity };

  // Count active filters for badge
  const activeCount = Object.values(appliedUsers).filter(Boolean).length
    + Object.values(appliedProjects).filter(Boolean).length
    + Object.values(appliedActions).filter(Boolean).length
    + (appliedDate !== "24h" ? 1 : 0)
    + (appliedSearch ? 1 : 0);

  const filteredTimeline = React.useMemo(() => {
    const days = DATE_LIMITS[appliedDate] ?? 1;
    return timeline.filter(e => {
      // Date filter
      if (appliedDate !== "custom" && (e.daysAgo ?? 0) >= days) return false;

      // User filter
      const selUsers = Object.keys(appliedUsers).filter(k => appliedUsers[k]);
      if (selUsers.length > 0) {
        const match = selUsers.some(k => e.u === USER_MAP[k]);
        if (!match) return false;
      }

      // Project filter
      const selProjs = Object.keys(appliedProjects).filter(k => appliedProjects[k]);
      if (selProjs.length > 0) {
        const match = selProjs.some(k => e.proj === PROJ_MAP[k]);
        if (!match) return false;
      }

      // Action filter
      const selActs = Object.keys(appliedActions).filter(k => appliedActions[k]);
      if (selActs.length > 0) {
        const match = selActs.some(k => e.act.toLowerCase().includes(ACTION_MAP[k]));
        if (!match) return false;
      }

      // Search filter
      if (appliedSearch) {
        const q = appliedSearch.toLowerCase();
        const haystack = `${e.u} ${e.act} ${e.obj} ${e.proj} ${e.comment ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [timeline, appliedUsers, appliedProjects, appliedActions, appliedDate, appliedSearch]);

  const handleApply = () => {
    setAppliedUsers(pendingUsers);
    setAppliedProjects(pendingProjects);
    setAppliedActions(pendingActions);
    setAppliedDate(pendingDate);
    setAppliedSearch(pendingSearch);
    setApplyFlash(true);
    setTimeout(() => setApplyFlash(false), 800);
  };

  const handleClearAll = () => {
    setPendingUsers({});   setAppliedUsers({});
    setPendingProjects({}); setAppliedProjects({});
    setPendingActions({});  setAppliedActions({});
    setPendingDate("24h");  setAppliedDate("24h");
    setPendingSearch("");   setAppliedSearch("");
    setCustomFrom(""); setCustomTo("");
  };

  React.useEffect(() => {
    if (typeof activityApi === "undefined") return;
    activityApi.getActivity({ limit: 30 }).then(({ data }) => {
      if (!data || !data.length) return;
      const mapped = data.map(entry => ({
        t: new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        daysAgo: Math.floor((Date.now() - new Date(entry.createdAt)) / 86400000),
        u: entry.user?.name ?? "Unknown",
        i: (entry.user?.name ?? "?").split(" ").map(s => s[0]).join("").slice(0, 2),
        c: "a",
        act: entry.action,
        obj: entry.asset?.name || entry.job?.name || entry.detail || entry.entityId,
        proj: entry.project?.name ?? "",
        icon: entry.action?.includes("approv") ? "green"
            : entry.action?.includes("reject") ? "red"
            : entry.action?.includes("comment") ? "amber"
            : entry.action?.includes("upload") ? "blue"
            : "default",
        comment: entry.detail && entry.action?.includes("comment") ? entry.detail : undefined,
      }));
      setTimeline(mapped);
    }).catch(() => {});
  }, []);

  return (
    <div className="activity">
      <aside className="activity__filters">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:18}}>
          <h2 style={{fontSize:15, margin:0}}>Filters</h2>
          {activeCount > 0 && (
            <span style={{
              background:"var(--accent)", color:"#fff",
              fontSize:10, fontWeight:600, borderRadius:999,
              padding:"1px 6px", lineHeight:"16px",
            }}>{activeCount}</span>
          )}
          <span style={{flex:1}} />
          <button className="btn btn--ghost" style={{padding:"4px 8px", fontSize:11}} onClick={handleClearAll}>Reset</button>
        </div>

        <div className="field" style={{marginBottom:18}}>
          <input
            className="input"
            placeholder="Search activity…"
            value={pendingSearch}
            onChange={e => setPendingSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleApply()}
          />
        </div>

        <FilterGroup title="Users"       items={ACT_USERS}    selected={pendingUsers}    onChange={setPendingUsers}    />
        <FilterGroup title="Projects"    items={ACT_PROJECTS} selected={pendingProjects} onChange={setPendingProjects} />
        <FilterGroup title="Action type" items={ACT_ACTIONS}  selected={pendingActions}  onChange={setPendingActions}  />

        <div className="filter-group">
          <h4 className="filter-group__title">Date range</h4>
          <div className="segmented" style={{width:"100%"}}>
            {["24h","7d","30d","Custom"].map(r => (
              <button
                key={r}
                className={pendingDate === r.toLowerCase() ? "active" : ""}
                onClick={() => setPendingDate(r.toLowerCase())}
              >{r}</button>
            ))}
          </div>
          {pendingDate === "custom" && (
            <div style={{display:"flex", flexDirection:"column", gap:6, marginTop:8}}>
              <input className="input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{fontSize:12}} />
              <input className="input" type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   style={{fontSize:12}} />
            </div>
          )}
        </div>

        <div style={{display:"flex", gap:8, marginTop:14}}>
          <button className="btn btn--ghost" style={{flex:1}} onClick={handleClearAll}>Clear all</button>
          <button
            className="btn btn--primary"
            style={{flex:1, transition:"opacity 150ms", opacity: applyFlash ? 0.6 : 1}}
            onClick={handleApply}
          >{applyFlash ? "Applied ✓" : "Apply"}</button>
        </div>
      </aside>

      <main className="activity__main">
        <div style={{display:"flex", alignItems:"flex-end", gap:14, marginBottom:6}}>
          <div>
            <div className="crumbs">STUDIO / <strong>TEAM ACTIVITY LOG</strong></div>
            <h1 className="page-title" style={{marginTop:4}}>Team Activity Log</h1>
          </div>
          <div style={{flex:1}} />
          <div className="segmented">
            {["timeline","table"].map(m => (
              <button key={m} className={viewMode === m ? "active" : ""} onClick={() => setViewMode(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn--secondary">{I.download}<span>Export CSV</span></button>
        </div>
        <p className="page-sub">
          {filteredTimeline.length} event{filteredTimeline.length !== 1 ? "s" : ""} · {appliedDate === "custom" ? "custom range" : `last ${appliedDate}`}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? "s" : ""} active` : " · all team members, all projects"}
        </p>

        <div style={{
          display:"flex", alignItems:"center", gap:10, margin:"10px 0 8px",
          fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)", letterSpacing:"0.10em"
        }}>
          <span>TODAY · OCT 24, 2024</span>
          <div style={{flex:1, height:1, background:"var(--line-2)"}}/>
        </div>

        {filteredTimeline.length === 0 ? (
          <div style={{textAlign:"center", padding:"48px 0", color:"var(--ink-4)", fontSize:13}}>
            No events match the current filters.
            <div style={{marginTop:10}}>
              <button className="btn btn--ghost" onClick={handleClearAll}>Clear filters</button>
            </div>
          </div>
        ) : viewMode === "timeline" ? (
          <div className="timeline-list">
            {filteredTimeline.map((e, i) => (
              <div className="tl-item" key={i}>
                <span className={`tl-dot tl-dot--${e.icon === "approved" || e.icon === "green" ? "green" :
                                                    e.icon === "amber" ? "amber" :
                                                    e.icon === "red" ? "red" : ""}`} />
                <div className="tl-head">
                  <span className="tl-time">{e.t}</span>
                  <div className={`avatar avatar--${e.c} sm`}>{e.i}</div>
                  <span className="tl-user">{e.u}</span>
                  <span className="tl-action">{e.act} <b>{e.obj}</b> · <span style={{color:"var(--ink-4)", fontFamily:"var(--f-mono)", fontSize:11, letterSpacing:"0.06em"}}>{e.proj}</span></span>
                  {e.chip ? <span className={e.chip.cls} style={{marginLeft:"auto"}}>{e.chip.text}</span> : null}
                </div>
                {(e.attach || e.comment) ? (
                  <div className="tl-body">
                    {e.attach ? (
                      <div className="tl-thumb"><Placeholder tone={e.attach.tone} label={e.attach.label} style={{height:"100%"}} /></div>
                    ) : null}
                    {e.comment ? (
                      <div className="tl-comment">
                        <span style={{display:"inline-flex", color:"var(--ink-4)", marginRight:6, verticalAlign:"middle"}}>{I.comment}</span>
                        {e.comment}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
            <thead>
              <tr style={{fontFamily:"var(--f-mono)", fontSize:10.5, color:"var(--ink-4)", letterSpacing:"0.08em", borderBottom:"1px solid var(--line)"}}>
                <th style={{padding:"8px 12px 8px 0", fontWeight:500, textAlign:"left"}}>TIME</th>
                <th style={{padding:"8px 12px", fontWeight:500, textAlign:"left"}}>USER</th>
                <th style={{padding:"8px 12px", fontWeight:500, textAlign:"left"}}>ACTION</th>
                <th style={{padding:"8px 12px", fontWeight:500, textAlign:"left"}}>ASSET</th>
                <th style={{padding:"8px 12px", fontWeight:500, textAlign:"left"}}>PROJECT</th>
                <th style={{padding:"8px 12px", fontWeight:500, textAlign:"left"}}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTimeline.map((e, i) => (
                <tr key={i} style={{borderBottom:"1px solid var(--line-2)", transition:"background 120ms"}}
                  onMouseEnter={ev => ev.currentTarget.style.background="var(--bg-hover)"}
                  onMouseLeave={ev => ev.currentTarget.style.background=""}>
                  <td style={{padding:"10px 12px 10px 0", fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)", whiteSpace:"nowrap"}}>{e.t}{e.daysAgo > 0 ? <span style={{marginLeft:4, opacity:0.6}}>-{e.daysAgo}d</span> : null}</td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex", alignItems:"center", gap:7}}>
                      <div className={`avatar avatar--${e.c} sm`}>{e.i}</div>
                      <span style={{fontWeight:500}}>{e.u}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 12px"}}>
                    <span className={`chip ${
                      e.icon==="green" ? "chip--approved" :
                      e.icon==="red"   ? "chip--rejected" :
                      e.icon==="amber" ? "chip--wip" : "chip--draft"
                    }`} style={{textTransform:"capitalize"}}>{e.act}</span>
                  </td>
                  <td style={{padding:"10px 12px", maxWidth:200}}>
                    <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block"}}>{e.obj}</span>
                  </td>
                  <td style={{padding:"10px 12px", color:"var(--ink-3)", fontSize:12}}>{e.proj}</td>
                  <td style={{padding:"10px 12px"}}>
                    {e.chip ? <span className={e.chip.cls}>{e.chip.text}</span> :
                     e.comment ? <span className="chip chip--draft" style={{fontSize:10}}>comment</span> :
                     e.attach  ? <span className="chip chip--wip"   style={{fontSize:10}}>asset</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}

window.ActivityLog = ActivityLog;
