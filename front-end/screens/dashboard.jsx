// ─── Dashboard — static mock data (fallback when API is offline) ──

const MOCK_RECENT_PROJECTS = [
  { id: "proj_huda",   name: "Huda Commercial",   client: "Beauty / KV",     progress: 72, tone: "rose"   },
  { id: "proj_halida", name: "Halida Fresh Beer",  client: "Beverage / Spot", progress: 44, tone: "amber"  },
  { id: "proj_excool", name: "Coolmate Excool KV", client: "Apparel / KV",    progress: 88, tone: "teal"   },
  { id: "proj_obagi",  name: "Obagi Skin Lab",     client: "Skincare / Spot", progress: 31, tone: "violet" },
];

const MOCK_PINNED = [
  { id: "proj_render", name: "Product Render V3",  client: "Internal · R&D",   progress: 64, tone: "blue"  },
  { id: "proj_char",   name: "Character Model 01", client: "Anim · Pre-prod",  progress: 22, tone: "green" },
];

const MOCK_ASSIGNMENTS = [
  { id: "a1", title: "Review Style Transfer — Huda KV v4", dueAt: new Date().toISOString(),                               isDone: false },
  { id: "a2", title: "Generate 50 Icon Variants — Excool",  dueAt: new Date(Date.now() + 86400000).toISOString(),          isDone: false },
  { id: "a3", title: "Feedback on Model 01 — pass B",       dueAt: new Date(Date.now() - 2 * 86400000).toISOString(),      isDone: false },
  { id: "a4", title: "Approve Storyboard — Halida 60s cut", dueAt: new Date(Date.now() + 4 * 86400000).toISOString(),      isDone: false },
];

const DASHBOARD_MOCK_ACTIVITY = [
  { id: "al1", user: { name: "Sarah M."   }, action: "approved",        detail: "Frame_18_v3.png on Halida Fresh Beer",       createdAt: new Date(Date.now() - 12*60000).toISOString() },
  { id: "al2", user: { name: "David Kim"  }, action: "uploaded",        detail: "Environment_Ref_v1.png to Huda Commercial",  createdAt: new Date(Date.now() - 60*60000).toISOString() },
  { id: "al3", user: { name: "Tom L."     }, action: "completed batch", detail: "32 frames · Excool sketch pack",             createdAt: new Date(Date.now() - 62*60000).toISOString() },
  { id: "al4", user: { name: "Maria R."   }, action: "commented on",    detail: "Character_Sheet_v2.jpg",                     createdAt: new Date(Date.now() - 2*3600000).toISOString() },
  { id: "al5", user: { name: "Alice Chen" }, action: "started",         detail: "AI Engine v4.0 — char-consistency model",    createdAt: new Date(Date.now() - 3*3600000).toISOString() },
  { id: "al6", user: { name: "Tom L."     }, action: "regenerated",     detail: "KV_Hero_Image_v4.png",                       createdAt: new Date(Date.now() - 24*3600000).toISOString() },
];

const MOCK_KPI = { activeProjects: 24, framesGenerated7d: 1287, awaitingApproval: 42, gpuQueueRunning: 2, gpuQueueQueued: 3 };

// ─── Helpers ─────────────────────────────────

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

function dueLabel(isoStr) {
  const diff = new Date(isoStr).getTime() - Date.now();
  const d = Math.round(diff / 86400000);
  if (d < -1) return { text: `${Math.abs(d)}d overdue`, cls: "due--over" };
  if (d < 0)  return { text: "Overdue",   cls: "due--over" };
  if (d === 0) return { text: "Due today", cls: "due--today" };
  if (d === 1) return { text: "Tomorrow",  cls: "due--soon" };
  return { text: `In ${d}d`, cls: "due--soon" };
}

const AVATAR_CLS = ["a","b","c","d","e","f"];

// ─── Dashboard component ──────────────────────

function Dashboard() {
  const [kpi, setKpi]         = React.useState(MOCK_KPI);
  const [projects, setProjects] = React.useState(MOCK_RECENT_PROJECTS);
  const [pinned, setPinned]   = React.useState(MOCK_PINNED);
  const [assignments, setAssignments] = React.useState(MOCK_ASSIGNMENTS);
  const [activity, setActivity] = React.useState(DASHBOARD_MOCK_ACTIVITY);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    if (typeof activityApi === "undefined") return;
    activityApi.getDashboardSummary().then(({ data, fromCache }) => {
      setOffline(fromCache);
      if (data.kpi)             setKpi(data.kpi);
      if (data.recentProjects)  setProjects(data.recentProjects);
      if (data.recentActivity)  setActivity(data.recentActivity);
      if (data.assignments)     setAssignments(data.assignments);
      // Pinned comes from the projects list
      const pinnedItems = (data.recentProjects || []).filter(p => p.isPinned);
      if (pinnedItems.length) setPinned(pinnedItems);
    }).catch(() => setOffline(true));
  }, []);

  const openAssignments = assignments.filter(a => !a.isDone);

  return (
    <div className="page">
      {offline && (
        <div style={{ background: "var(--amber, #f59e0b)", color: "#000", padding: "6px 12px", borderRadius: 6, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <span>⚡</span> Showing mock data — backend offline
        </div>
      )}

      <h1 className="page-title">Good morning, Alice.</h1>
      <p className="page-sub">
        You have <strong>{openAssignments.length} assignments</strong>,{" "}
        <strong>{kpi.awaitingApproval} reviews pending</strong>, and{" "}
        <strong>{kpi.gpuQueueRunning} job{kpi.gpuQueueRunning !== 1 ? "s" : ""}</strong> running.
      </p>

      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi__k">Active Projects</div>
          <div className="kpi__v tabular">{kpi.activeProjects}</div>
          <div className="kpi__d"><span className="kpi__delta kpi__delta--up">+3</span> this week</div>
        </div>
        <div className="kpi">
          <div className="kpi__k">Frames Generated · 7d</div>
          <div className="kpi__v tabular">{(kpi.framesGenerated7d ?? 0).toLocaleString()}</div>
          <div className="kpi__d"><span className="kpi__delta kpi__delta--up">+18%</span> vs last week</div>
        </div>
        <div className="kpi">
          <div className="kpi__k">Awaiting Approval</div>
          <div className="kpi__v tabular">{kpi.awaitingApproval}</div>
          <div className="kpi__d"><span className="kpi__delta kpi__delta--dn">+12</span> past 24h</div>
        </div>
        <div className="kpi">
          <div className="kpi__k">GPU Queue · Running</div>
          <div className="kpi__v tabular">{kpi.gpuQueueRunning}<span style={{fontSize:14,color:"var(--ink-4)",marginLeft:4}}>jobs</span></div>
          <div className="kpi__d"><span className="kpi__delta kpi__delta--up">{kpi.gpuQueueQueued} queued</span></div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="section-title">
        <h2>Recent Projects</h2>
        <span className="count">{projects.length} OF {kpi.activeProjects}</span>
        <span className="spacer" />
        <a className="link">View all →</a>
      </div>
      <div className="grid-cards cards-4">
        {projects.slice(0, 4).map((p, i) => (
          <div className="project-card" key={p.id || p.name}>
            <div className="project-card__thumb">
              <Placeholder tone={p.tone} label="KEY VISUAL" style={{height:"100%",borderRadius:0}} />
            </div>
            <div className="project-card__body">
              <div className="project-card__title-row">
                <span className="project-card__title">{p.name}</span>
                <span className="chip chip--version">v{Math.floor((p.progress||0)/20)+1}</span>
              </div>
              <div className="project-card__meta">
                <span>{p.client}</span>
                <span style={{marginLeft:"auto"}}>{p.progress}%</span>
              </div>
              <div className="project-card__meta-row">
                <div className="progress"><div className="progress__bar" style={{width:(p.progress||0)+"%"}} /></div>
              </div>
              <div className="project-card__meta-row">
                <div className="avatar-stack">
                  {(p.members || []).slice(0,3).map((m, mi) => (
                    <div key={mi} className={`avatar avatar--${AVATAR_CLS[mi]} sm`}>
                      {(m.user?.name || m.name || "?").split(" ").map(s=>s[0]).join("").slice(0,2)}
                    </div>
                  ))}
                  {!(p.members?.length) && <>
                    <div className="avatar avatar--a sm">AC</div>
                    <div className="avatar avatar--b sm">DK</div>
                  </>}
                </div>
                <span className="chip chip--wip"><span className="dot-status dot-status--wip"/>WIP</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pinned + Assigned + Activity */}
      <div className="section-title" style={{marginTop:36}}>
        <h2>Pinned Projects</h2>
        <span className="count">{pinned.length} PINNED</span>
      </div>
      <div className="split-2">
        <div>
          <div className="grid-cards" style={{gridTemplateColumns:"1fr 1fr"}}>
            {pinned.slice(0,2).map(p => (
              <div className="pinned-card" key={p.id || p.name}>
                <div className="pinned-card__head">
                  <span style={{color:"var(--accent)"}}>{I.pin}</span>
                  <span className="pinned-card__name">{p.name}</span>
                  <button className="icon-btn icon-btn--light">{I.more}</button>
                </div>
                <div style={{aspectRatio:"16 / 7"}}>
                  <Placeholder tone={p.tone} label="PINNED PROJECT" style={{height:"100%"}} />
                </div>
                <div className="pinned-card__row">
                  <span className="pinned-card__client">{p.client}</span>
                  <span style={{marginLeft:"auto"}}>{p.progress}%</span>
                </div>
                <div className="pinned-card__row">
                  <div className="pinned-card__bar">
                    <div className="progress__bar" style={{width:(p.progress||0)+"%"}} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title" style={{marginTop:28}}>
            <h2>Assigned to you</h2>
            <span className="count">{openAssignments.length} OPEN</span>
          </div>
          <div className="card">
            {openAssignments.map((a, i) => {
              const due = dueLabel(a.dueAt || a.due || new Date().toISOString());
              return (
                <div className="assigned-row" key={a.id || i}>
                  <button className="checkbox" />
                  <span className="assigned-row__name">{a.title || a.name}</span>
                  <span className={`assigned-row__due ${due.cls}`}>{due.text}</span>
                  <div className="avatar avatar--a sm">AC</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Recent Activity</h2>
            <span className="count">LIVE</span>
            <span className="spacer" />
            <a className="link">Open log →</a>
          </div>
          <div className="card card--pad" style={{padding:"6px 16px"}}>
            {activity.slice(0, 6).map((a, i) => {
              const name = a.user?.name || a.who || "Unknown";
              const initials = name.split(" ").map(s=>s[0]).join("").slice(0,2);
              return (
                <div className="activity-row" key={a.id || i}>
                  <div className={`avatar avatar--${AVATAR_CLS[i % 6]} md`}>{initials}</div>
                  <div className="activity-row__body">
                    <div className="activity-row__line">
                      <strong>{name}</strong> {a.action || a.act}{" "}
                      <span style={{color:"var(--ink)"}}>{a.detail || a.what}</span>
                    </div>
                    <div className="activity-row__time">{timeAgo(a.createdAt || new Date().toISOString())}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
