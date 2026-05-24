const ACT_USERS = [
  { k: "alice",  l: "Alice Chen",  c: 18 },
  { k: "david",  l: "David Kim",   c: 12 },
  { k: "sarah",  l: "Sarah M.",    c:  9 },
  { k: "tom",    l: "Tom L.",      c: 14 },
  { k: "maria",  l: "Maria R.",    c:  7 },
];

const ACT_PROJECTS = [
  { k: "huda",   l: "Huda Commercial",       c: 22 },
  { k: "halida", l: "Halida Fresh Beer",     c: 16 },
  { k: "excool", l: "Coolmate Excool KV",    c: 11 },
  { k: "obagi",  l: "Obagi Skin Lab",        c:  6 },
  { k: "render", l: "Product Render V3",     c:  4 },
];

const ACT_ACTIONS = [
  { k: "gen",     l: "Generated",  c: 24 },
  { k: "upload",  l: "Uploaded",   c: 13 },
  { k: "approve", l: "Approved",   c:  9 },
  { k: "comment", l: "Commented",  c: 14 },
  { k: "revise",  l: "Revised",    c:  6 },
  { k: "reject",  l: "Rejected",   c:  3 },
];

const TIMELINE = [
  { t: "10:42 AM", u: "Alice Chen",  i: "AC", c: "a", act: "generated", obj: "Frame_18_v3.png", proj: "Halida Fresh Beer", icon: "approved", attach: { tone:"violet", label:"FRAME_18" } },
  { t: "10:31 AM", u: "Sarah M.",   i: "SM", c: "c", act: "approved",   obj: "KV_Hero_Image_v4.png", proj: "Huda Commercial", icon: "green", chip: { cls:"chip chip--approved", text:"v4 approved" } },
  { t: "10:14 AM", u: "David Kim",   i: "DK", c: "b", act: "uploaded",   obj: "Character_Ref_HERO_03.jpg", proj: "Huda Commercial", icon: "blue", attach: { tone:"rose", label:"CHAR REF" } },
  { t: "09:58 AM", u: "Maria R.",    i: "MR", c: "d", act: "commented on", obj: "Character_Sheet_v2.jpg", proj: "Huda Commercial", icon: "amber",
    comment: "Eyes a bit too saturated, can we cool the skin tone? Also the hair highlight on v2 lost some specularity vs v1." },
  { t: "09:42 AM", u: "Tom L.",      i: "TL", c: "e", act: "completed batch", obj: "Excool Sketch Pack · 32 frames", proj: "Coolmate Excool KV", icon: "green", chip: { cls:"chip chip--approved", text:"32 ok · 0 failed" } },
  { t: "09:21 AM", u: "Tom L.",      i: "TL", c: "e", act: "rejected", obj: "Bottle_Hero_v1.png", proj: "Halida Fresh Beer", icon: "red",
    comment: "Glass refraction is wrong — re-run with new env ref. See attached." },
  { t: "09:04 AM", u: "Alice Chen",  i: "AC", c: "a", act: "revised", obj: "Style_Sheet_Final.png", proj: "Obagi Skin Lab", icon: "amber" },
  { t: "08:47 AM", u: "David Kim",   i: "DK", c: "b", act: "regenerated", obj: "Frame_20_v2.png with locked seed", proj: "Halida Fresh Beer", icon: "blue", attach: { tone:"mono", label:"FRAME_20" } },
  { t: "08:32 AM", u: "Sarah M.",    i: "SM", c: "c", act: "started review on", obj: "Storyboard Act 02", proj: "Halida Fresh Beer", icon: "default" },
];

function FilterGroup({ title, items, mode = "check" }) {
  const [open, setOpen] = React.useState(true);
  const [selected, setSelected] = React.useState({});
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
            onClick={() => setSelected({...selected, [it.k]: !on})}>
            <span className={`checkbox__box ${on ? "" : ""}`} style={{
              background: on ? "var(--accent)" : "#fff",
              borderColor: on ? "var(--accent)" : "var(--line-strong)",
              borderWidth: 1.5, borderStyle: "solid", borderRadius: 4,
              width:14, height:14, display:"grid", placeItems:"center"
            }}>
              {on ? <span style={{
                width:6, height:3,
                borderLeft:"1.5px solid #fff", borderBottom:"1.5px solid #fff",
                transform:"rotate(-45deg)", marginTop:-1
              }}/> : null}
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

  React.useEffect(() => {
    if (typeof activityApi === "undefined") return;
    activityApi.getActivity({ limit: 30 }).then(({ data }) => {
      if (!data || !data.length) return;
      // Map API entries to the shape the render expects
      const mapped = data.map(entry => ({
        t: new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
          <span style={{flex:1}} />
          <button className="btn btn--ghost" style={{padding:"4px 8px", fontSize:11}}>Reset</button>
        </div>

        <div className="field" style={{marginBottom:18}}>
          <input className="input" placeholder="Search activity…" />
        </div>

        <FilterGroup title="Users"    items={ACT_USERS}    />
        <FilterGroup title="Projects" items={ACT_PROJECTS} />
        <FilterGroup title="Action type" items={ACT_ACTIONS} />

        <div className="filter-group">
          <h4 className="filter-group__title">Date range</h4>
          <div className="segmented" style={{width:"100%"}}>
            <button className="active" style={{flex:1}}>24h</button>
            <button style={{flex:1}}>7d</button>
            <button style={{flex:1}}>30d</button>
            <button style={{flex:1}}>Custom</button>
          </div>
        </div>

        <div style={{display:"flex", gap:8, marginTop:14}}>
          <button className="btn btn--ghost" style={{flex:1}}>Clear all</button>
          <button className="btn btn--primary" style={{flex:1}}>Apply</button>
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
            <button className="active">Timeline</button>
            <button>Table</button>
          </div>
          <button className="btn btn--secondary">{I.download}<span>Export CSV</span></button>
        </div>
        <p className="page-sub">9 events · last 24 hours · all team members, all projects</p>

        {/* day separator */}
        <div style={{
          display:"flex", alignItems:"center", gap:10, margin:"10px 0 8px",
          fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)", letterSpacing:"0.10em"
        }}>
          <span>TODAY · OCT 24, 2024</span>
          <div style={{flex:1, height:1, background:"var(--line-2)"}}/>
        </div>

        <div className="timeline-list">
          {timeline.map((e, i) => (
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
      </main>
    </div>
  );
}

window.ActivityLog = ActivityLog;
