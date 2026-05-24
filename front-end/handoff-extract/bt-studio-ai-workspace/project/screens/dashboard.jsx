const RECENT_PROJECTS = [
  { name: "Huda Commercial",            client: "Beauty / KV",     progress: 72, tone: "rose"   },
  { name: "Halida Fresh Beer",          client: "Beverage / Spot", progress: 44, tone: "amber"  },
  { name: "Coolmate Excool KV",         client: "Apparel / KV",    progress: 88, tone: "teal"   },
  { name: "Obagi Skin Lab",             client: "Skincare / Spot", progress: 31, tone: "violet" },
];

const PINNED = [
  { name: "Product Render V3",  client: "Internal · R&D",   progress: 64, tone: "blue" },
  { name: "Character Model 01", client: "Anim · Pre-prod",  progress: 22, tone: "green" },
];

const ASSIGNMENTS = [
  { name: "Review Style Transfer — Huda KV v4", due: "Due today",    cls: "due--today" },
  { name: "Generate 50 Icon Variants — Excool",  due: "Tomorrow",     cls: "due--soon"  },
  { name: "Feedback on Model 01 — pass B",       due: "2d overdue",   cls: "due--over"  },
  { name: "Approve Storyboard — Halida 60s cut", due: "Fri · Oct 27", cls: "due--soon"  },
];

const ACTIVITY = [
  { who: "Sarah M.",  act: "approved", what: "Frame_18_v3.png on Halida Fresh Beer", time: "12 min ago", color: "approved" },
  { who: "David Kim", act: "uploaded", what: "Environment_Ref_v1.png to Huda Commercial", time: "1h ago",   color: "wip"      },
  { who: "Tom L.",    act: "completed batch", what: "32 frames · Excool sketch pack", time: "1h ago",      color: "approved" },
  { who: "Maria R.",  act: "commented on", what: "Character_Sheet_v2.jpg", time: "2h ago", color: "default", note: "Eyes a bit too saturated, can we cool the skin tone?" },
  { who: "Alice Chen",act: "started", what: "AI Engine v4.0 — char-consistency model", time: "3h ago", color: "wip" },
  { who: "Tom L.",    act: "regenerated", what: "KV_Hero_Image_v4.png", time: "Yesterday", color: "default" },
];

function Dashboard() {
  return (
    <div className="page">
      <h1 className="page-title">Good morning, Alice.</h1>
      <p className="page-sub">
        You have <strong>4 assignments</strong>, <strong>2 reviews pending</strong>, and
        <strong> 1 batch job</strong> finishing in the next hour.
      </p>

      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi__k">Active Projects</div>
          <div className="kpi__v tabular">24</div>
          <div className="kpi__d">
            <span className="kpi__delta kpi__delta--up">+3</span>
            this week
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__k">Frames Generated · 7d</div>
          <div className="kpi__v tabular">1,287</div>
          <div className="kpi__d">
            <span className="kpi__delta kpi__delta--up">+18%</span>
            vs last week
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__k">Awaiting Approval</div>
          <div className="kpi__v tabular">42</div>
          <div className="kpi__d">
            <span className="kpi__delta kpi__delta--dn">+12</span>
            past 24h
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__k">GPU Queue · Avg</div>
          <div className="kpi__v tabular">3.4<span style={{fontSize:14, color:"var(--ink-4)", marginLeft:4}}>min</span></div>
          <div className="kpi__d">
            <span className="kpi__delta kpi__delta--up">−12%</span>
            faster
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="section-title">
        <h2>Recent Projects</h2>
        <span className="count">4 OF 24</span>
        <span className="spacer" />
        <a className="link">View all →</a>
      </div>
      <div className="grid-cards cards-4">
        {RECENT_PROJECTS.map(p => (
          <div className="project-card" key={p.name}>
            <div className="project-card__thumb">
              <Placeholder tone={p.tone} label="KEY VISUAL" style={{height: "100%", borderRadius: 0}} />
            </div>
            <div className="project-card__body">
              <div className="project-card__title-row">
                <span className="project-card__title">{p.name}</span>
                <span className="chip chip--version">v{Math.floor(p.progress/20)+1}</span>
              </div>
              <div className="project-card__meta">
                <span>{p.client}</span>
                <span style={{marginLeft:"auto"}}>{p.progress}%</span>
              </div>
              <div className="project-card__meta-row">
                <div className="progress"><div className="progress__bar" style={{width: p.progress + "%"}} /></div>
              </div>
              <div className="project-card__meta-row">
                <div className="avatar-stack">
                  <div className="avatar avatar--a sm">AC</div>
                  <div className="avatar avatar--b sm">DK</div>
                  <div className="avatar avatar--c sm">SM</div>
                </div>
                <span className="chip chip--wip"><span className="dot-status dot-status--wip"/>WIP</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pinned + Assigned + Activity */}
      <div className="section-title" style={{marginTop: 36}}>
        <h2>Pinned Projects</h2>
        <span className="count">2 PINNED</span>
      </div>
      <div className="split-2">
        <div>
          <div className="grid-cards" style={{gridTemplateColumns: "1fr 1fr"}}>
            {PINNED.map(p => (
              <div className="pinned-card" key={p.name}>
                <div className="pinned-card__head">
                  <span style={{color:"var(--accent)"}}>{I.pin}</span>
                  <span className="pinned-card__name">{p.name}</span>
                  <button className="icon-btn icon-btn--light">{I.more}</button>
                </div>
                <div style={{aspectRatio: "16 / 7"}}>
                  <Placeholder tone={p.tone} label="PINNED PROJECT" style={{height:"100%"}} />
                </div>
                <div className="pinned-card__row">
                  <span className="pinned-card__client">{p.client}</span>
                  <span style={{marginLeft:"auto"}}>{p.progress}%</span>
                </div>
                <div className="pinned-card__row">
                  <div className="pinned-card__bar">
                    <div className="progress__bar" style={{width: p.progress + "%"}} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-title" style={{marginTop: 28}}>
            <h2>Assigned to you</h2>
            <span className="count">{ASSIGNMENTS.length} OPEN</span>
          </div>
          <div className="card">
            {ASSIGNMENTS.map((a, i) => (
              <div className="assigned-row" key={i}>
                <button className="checkbox" />
                <span className="assigned-row__name">{a.name}</span>
                <span className={`assigned-row__due ${a.cls}`}>{a.due}</span>
                <div className="avatar avatar--a sm">AC</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title" style={{marginTop: 0}}>
            <h2>Recent Activity</h2>
            <span className="count">LIVE</span>
            <span className="spacer" />
            <a className="link">Open log →</a>
          </div>
          <div className="card card--pad" style={{padding: "6px 16px"}}>
            {ACTIVITY.map((a, i) => (
              <div className="activity-row" key={i}>
                <div className={`avatar avatar--${"abcdef"[i % 6]} md`}>
                  {a.who.split(" ").map(s => s[0]).join("").slice(0,2)}
                </div>
                <div className="activity-row__body">
                  <div className="activity-row__line">
                    <strong>{a.who}</strong> {a.act} <span style={{color:"var(--ink)"}}>{a.what}</span>
                  </div>
                  {a.note ? <div className="activity-row__line" style={{marginTop:4, color:"var(--ink-3)"}}>“{a.note}”</div> : null}
                  <div className="activity-row__time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
