function ToolIcon({ cat, glyph }) {
  return (
    <div className={`tool-icon tool-icon--${cat}`}>{glyph}</div>
  );
}

function ToolCard({ tool, pinned, onPin, onOpen }) {
  return (
    <div className="tool-card" onClick={() => onOpen(tool.id)}>
      <div className="tool-card__head">
        <ToolIcon cat={tool.cat} glyph={tool.icon} />
        <button
          className={`tool-card__pin ${pinned ? "pinned" : ""}`}
          onClick={(e) => { e.stopPropagation(); onPin(tool.id); }}
          title={pinned ? "Unpin" : "Pin to favorites"}>
          {I.star}
        </button>
      </div>
      <div className="tool-card__title">
        {tool.name}
        {tool.badge ? <span className={`badge badge--${tool.badge.kind}`}>{tool.badge.text}</span> : null}
      </div>
      <p className="tool-card__desc">{tool.desc}</p>
      <div className="tool-card__foot">
        <span className="tool-card__cat">{CAT_LABELS[tool.cat]}</span>
        <span className="tool-card__open">Open {I.arrowRight}</span>
      </div>
    </div>
  );
}

const CATEGORIES = ["image", "video", "audio", "spaces", "3d"];

const RECENT_JOBS = [
  { name: "Frame_18_v3 cyberpunk street", tool: "Image Generator", status: "generating", pct: 64, time: "Started 1m ago", cat: "image" },
  { name: "KV_Hero_Image upscaled to 4K", tool: "Image Upscaler",   status: "completed",  pct: 100, time: "3m ago",         cat: "image" },
  { name: "Halida 60s spot · scene 02",   tool: "Video Generator",  status: "queued",     pct: 0,  time: "Queued",          cat: "video" },
  { name: "Bottle_Hero_v1 retouch",        tool: "Image Editor",    status: "failed",     pct: 0,  time: "8m ago · retry",  cat: "image" },
  { name: "Maria_VO narration v2",         tool: "Voice Generator", status: "completed",  pct: 100, time: "12m ago",        cat: "audio" },
];

const RECENT_ASSETS = [
  { name: "Frame_18_v3.png",       tone: "violet" },
  { name: "KV_Hero_Image_v4.png",  tone: "rose"   },
  { name: "Bottle_Hero_v1.png",    tone: "amber"  },
  { name: "Maria_VO_v2.wav",       tone: "teal"   },
];

function statusToChip(s) {
  if (s === "completed")   return ["chip chip--approved",   "Completed"];
  if (s === "generating")  return ["chip chip--generating", "Generating"];
  if (s === "queued")      return ["chip chip--draft",      "Queued"];
  if (s === "failed")      return ["chip chip--failed",     "Failed"];
  return ["chip chip--draft", s];
}

function WorkspaceHome({ pinned, onPin, onOpen, onSwitchScreen }) {
  const [cat, setCat] = React.useState("image");
  const [railCollapsed, setRailCollapsed] = React.useState(() => {
    try { return localStorage.getItem("bt_rail") === "1"; } catch (e) { return false; }
  });
  // Live tools from API (falls back to static TOOLS)
  const [tools, setTools] = React.useState(typeof TOOLS !== "undefined" ? TOOLS : []);
  // Live recent jobs from API (falls back to RECENT_JOBS)
  const [recentJobs, setRecentJobs] = React.useState(RECENT_JOBS);
  const [activeProject, setActiveProject] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("most-used");

  const [loadingTools, setLoadingTools] = React.useState(false);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const activeProjId = localStorage.getItem("bt_active_proj");
    if (activeProjId && typeof projectsApi !== "undefined") {
      projectsApi.getProject(activeProjId).then(({ data }) => {
        setActiveProject(data);
      }).catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem("bt_rail", railCollapsed ? "1" : "0"); } catch (e) {}
  }, [railCollapsed]);

  React.useEffect(() => {
    if (typeof toolsApi === "undefined") return;
    setLoadingTools(true);
    toolsApi.listTools().then(({ data, fromCache }) => {
      setOffline(prev => prev || fromCache);
      if (data && data.length) {
        // Re-attach icon objects from the static I map (API returns icon key only)
        const withIcons = data.map(t => ({
          ...t,
          icon: (typeof I !== "undefined" && t.iconKey && I[t.iconKey]) ? I[t.iconKey] : (t.icon ?? null),
        }));
        setTools(withIcons);
      }
    }).catch((err) => {
      console.error(err);
      setOffline(true);
    }).finally(() => {
      setLoadingTools(false);
    });
  }, []);

  React.useEffect(() => {
    if (typeof jobsApi === "undefined") return;
    setLoadingJobs(true);
    jobsApi.listJobs({ projectId: activeProject?.id, limit: 5 }).then(({ data, fromCache }) => {
      setOffline(prev => prev || fromCache);
      if (data && data.length) setRecentJobs(data);
    }).catch((err) => {
      console.error(err);
      setError(err.message || "Failed to load jobs");
      setOffline(true);
    }).finally(() => {
      setLoadingJobs(false);
    });
  }, [activeProject]);

  // Pinned tab = filter to pinned tool ids
  const filtered = cat === "pinned"
    ? tools.filter(t => pinned.includes(t.id))
    : tools.filter(t => t.cat === cat);

  const visible = React.useMemo(() => {
    const list = [...filtered];
    if (sortBy === "most-used") {
      list.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : (typeof TOOLS !== "undefined" ? TOOLS.findIndex(x => x.id === a.id) : 0);
        const orderB = b.sortOrder !== undefined ? b.sortOrder : (typeof TOOLS !== "undefined" ? TOOLS.findIndex(x => x.id === b.id) : 0);
        return orderA - orderB;
      });
    } else if (sortBy === "alpha") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [filtered, sortBy]);

  const countByCat = React.useMemo(() => {
    const o = { pinned: pinned.length };
    CATEGORIES.forEach(c => o[c] = tools.filter(t => t.cat === c).length);
    return o;
  }, [pinned, tools]);

  const pinnedTools = tools.filter(t => pinned.includes(t.id)).slice(0, 4);

  return (
    <div className={`toolhub ${railCollapsed ? "toolhub--collapsed" : ""}`}>
      {/* Collapse toggle — same look as Projects tree toggle (panel icon, bordered card) */}
      <button
        className={`rail-collapse ${railCollapsed ? "rail-collapse--outside" : "rail-collapse--inside"}`}
        onClick={() => setRailCollapsed(c => !c)}
        title={railCollapsed ? "Show side panel" : "Collapse side panel"}
        aria-label="Toggle side panel">
        {I.panelRight}
      </button>

      <div className="toolhub__main">
        {offline && (
          <div style={{ background: "var(--amber, #f59e0b)", color: "#000", padding: "6px 12px", borderRadius: 6, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡</span> Showing mock data — backend offline
          </div>
        )}
        {error && (
          <div style={{ background: "var(--st-failed-tint, #fee2e2)", color: "var(--st-failed, #ef4444)", padding: "6px 12px", borderRadius: 6, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚠️</span> {error}
          </div>
        )}
        {/* Header */}
        <div className="hub-head">
          <div>
            <h1 className="page-title">AI Workspace</h1>
            <p className="page-sub" style={{margin: 0}}>
              Create, enhance, edit, review and manage AI production assets.
              <span style={{color: "var(--ink-4)", marginLeft: 8, fontFamily:"var(--f-mono)", fontSize: 11, letterSpacing:"0.06em"}}>
                · {TOOLS.length} tools available
              </span>
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          <button className="qa" onClick={() => onOpen("image-gen")}>
            <div className="qa__ico">{I.spark}</div>
            <div className="qa__body">
              <div className="qa__title">New Generation</div>
              <div className="qa__sub">Image · Video · Audio</div>
            </div>
            <span className="qa__kbd">N</span>
          </button>
          <button className="qa qa--dark" onClick={() => onSwitchScreen && onSwitchScreen("batch")}>
            <div className="qa__ico">{I.layers}</div>
            <div className="qa__body">
              <div className="qa__title">Batch Job</div>
              <div className="qa__sub">20 – 40 sketches</div>
            </div>
            <span className="qa__kbd">B</span>
          </button>
          <button className="qa">
            <div className="qa__ico">{I.upload}</div>
            <div className="qa__body">
              <div className="qa__title">Upload Reference</div>
              <div className="qa__sub">Env · Character · IP</div>
            </div>
            <span className="qa__kbd">U</span>
          </button>
          <button className="qa">
            <div className="qa__ico">{I.history}</div>
            <div className="qa__body">
              <div className="qa__title">Open Recent Project</div>
              <div className="qa__sub">Huda Commercial</div>
            </div>
            <span className="qa__kbd">R</span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="cat-tabs">
          {CATEGORIES.map(c => (
            <button key={c}
              className={`cat-tab ${cat === c ? "active" : ""}`}
              onClick={() => setCat(c)}>
              {CAT_LABELS[c]}
              <span className="ct-count">{countByCat[c]}</span>
            </button>
          ))}
          <button
            className={`cat-tab ${cat === "pinned" ? "active" : ""}`}
            onClick={() => setCat("pinned")}>
            <span style={{color: cat === "pinned" ? "var(--accent)" : "var(--ink-4)", display:"inline-flex"}}>{I.star}</span>
            Pinned
            <span className="ct-count">{countByCat.pinned}</span>
          </button>
          <span style={{flex: 1}} />
          <div style={{display:"flex", gap: 6, alignItems:"center", paddingRight: 4}}>
            <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)", letterSpacing:"0.06em"}}>SORT</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="dropdown"
              style={{
                fontSize: 11.5,
                outline: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238B909B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                backgroundSize: "12px",
                paddingRight: "24px"
              }}
            >
              <option value="most-used" style={{background: "var(--bg-card)", color: "var(--ink)"}}>Most used</option>
              <option value="alpha" style={{background: "var(--bg-card)", color: "var(--ink)"}}>A–Z</option>
            </select>
          </div>
        </div>

        {/* Tool grid */}
        {visible.length === 0 ? (
          <div className="card card--pad" style={{padding: 40, textAlign:"center"}}>
            <div style={{fontSize: 28, marginBottom: 6}}>{I.star}</div>
            <h3 style={{margin: "0 0 6px"}}>No pinned tools yet</h3>
            <p style={{margin: 0, color: "var(--ink-3)"}}>Pin tools from any category to build your favorites here.</p>
          </div>
        ) : (
          <div className="tool-grid">
            {visible.map(t => (
              <ToolCard key={t.id} tool={t}
                pinned={pinned.includes(t.id)}
                onPin={onPin}
                onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="toolhub__rail">
        {/* Project context */}
        <div className="rail-section">
          <div className="rail-section__head">
            <span className="rail-section__title">Active Project</span>
          </div>
          <div className="ctx-card">
            <div className="ctx-row">
              <span className="ctx-row__k">Project</span>
              <span className="ctx-row__v">{activeProject?.name ?? "Huda Commercial"}</span>
              <span className="ctx-row__edit" onClick={() => onSwitchScreen && onSwitchScreen("projects")} style={{cursor:"pointer"}}>change</span>
            </div>
            <div className="ctx-row">
              <span className="ctx-row__k">Folder</span>
              <span className="ctx-row__v">Generated / Frame 18</span>
            </div>
            <div className="ctx-row">
              <span className="ctx-row__k">Save to</span>
              <span className="ctx-row__v">Project Folder</span>
            </div>
            <div className="ctx-row">
              <span className="ctx-row__k">IP Lock</span>
              <span className="ctx-row__v" style={{display:"flex", alignItems:"center", gap:6}}>
                <span style={{display:"inline-flex", color:"var(--accent)"}}>{I.lock}</span>
                IP1 · {activeProject?.tone ? (activeProject.tone.toUpperCase() + " Brand") : "Huda Brand"}
              </span>
            </div>
            <button className="ctx-card__switch" onClick={() => onSwitchScreen && onSwitchScreen("projects")}>Switch active project</button>
          </div>
        </div>

        {/* Queue status */}
        <div className="rail-section">
          <div className="rail-section__head">
            <span className="rail-section__title">Queue Status</span>
            <span className="spacer" />
            <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--st-approved)"}}>
              <span className="dot-status dot-status--approved" style={{display:"inline-block", marginRight: 4}}/>HEALTHY
            </span>
          </div>
          <div className="queue-card">
            <div className="queue-card__top">
              <span className="queue-card__title">GPU jobs in flight</span>
              <span style={{marginLeft:"auto"}} className="queue-card__val tabular">7</span>
            </div>
            <div className="queue-bar"><span style={{width: "62%"}}/></div>
            <div className="queue-card__row">
              <span className="pill">2 generating</span>
              <span className="pill">3 queued</span>
              <span className="pill">2 finishing</span>
            </div>
            <div className="queue-card__row" style={{paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)"}}>
              <span style={{color:"var(--ink-on-dark-3)"}}>Avg wait</span>
              <span style={{color:"#fff"}}>3m 24s</span>
              <span className="spacer" style={{flex:1}}/>
              <span style={{color:"var(--ink-on-dark-3)"}}>Cluster</span>
              <span style={{color:"#fff"}}>btstudio-prod-01</span>
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="rail-section">
          <div className="rail-section__head">
            <span className="rail-section__title">Recent Jobs</span>
            <span className="spacer" />
            <a className="rail-section__link">View all →</a>
          </div>
          <div>
            {recentJobs.map((j, i) => {
              // Normalize API shape (type→cat, status casing, tool name)
              const rawStatus = (j.status || "").toLowerCase();
              const apiStatus = rawStatus === "running" ? "generating" : rawStatus === "queued" ? "queued" : rawStatus;
              const [cls, txt] = statusToChip(apiStatus);
              const cat = j.cat || (() => {
                const t = (j.type || "").toLowerCase();
                if (t.includes("video")) return "video";
                if (t.includes("voice") || t.includes("audio") || t.includes("music") || t.includes("sfx")) return "audio";
                return "image";
              })();
              const toolName = j.tool?.name || j.tool || "AI Tool";
              const pct = j.progress ?? j.pct ?? 0;
              const timeStr = j.time || (() => {
                const d = Date.now() - new Date(j.createdAt || Date.now()).getTime();
                const m = Math.floor(d / 60000);
                return m < 1 ? "Just now" : m < 60 ? `${m}m ago` : `${Math.floor(m/60)}h ago`;
              })();
              return (
                <div className="job-row" key={j.id || i}>
                  <div className={`job-row__ico tool-icon--${cat}`}>
                    {cat === "image" ? I.imageGen : cat === "video" ? I.videoGen : cat === "audio" ? I.mic : I.spark}
                  </div>
                  <div className="job-row__body">
                    <div className="job-row__name">{j.name}</div>
                    <div className="job-row__meta">
                      <span>{toolName}</span>
                      <span>·</span>
                      <span>{timeStr}</span>
                    </div>
                    {apiStatus === "generating" ? (
                      <div className="job-row__progress"><span style={{width: pct + "%"}}/></div>
                    ) : null}
                  </div>
                  <span className={cls}>{txt}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pinned tools */}
        {pinnedTools.length ? (
          <div className="rail-section">
            <div className="rail-section__head">
              <span className="rail-section__title">Pinned Tools</span>
              <span className="spacer" />
              <a className="rail-section__link" onClick={() => setCat("pinned")}>See all →</a>
            </div>
            <div className="pinned-mini">
              {pinnedTools.map(t => (
                <div className="pinned-mini__row" key={t.id} onClick={() => onOpen(t.id)}>
                  <ToolIcon cat={t.cat} glyph={t.icon} />
                  <div style={{flex:1, minWidth:0}}>
                    <div className="pinned-mini__name">{t.name}</div>
                    <div className="pinned-mini__cat">{CAT_LABELS[t.cat]}</div>
                  </div>
                  <span style={{color:"var(--ink-4)", display:"inline-flex"}}>{I.chevRight}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Recent Assets */}
        <div className="rail-section">
          <div className="rail-section__head">
            <span className="rail-section__title">Recent Assets</span>
          </div>
          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6}}>
            {RECENT_ASSETS.map((a, i) => (
              <div key={i} title={a.name} style={{aspectRatio:1, borderRadius: 6, overflow:"hidden", border:"1px solid var(--line)"}}>
                <Placeholder tone={a.tone} label="" style={{height:"100%", borderRadius:0}} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

window.WorkspaceHome = WorkspaceHome;
