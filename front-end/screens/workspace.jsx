// ─────────────────────────────────────────────────────────────
// IMAGE GENERATOR WORKBENCH (the original workspace, now scoped)
// ─────────────────────────────────────────────────────────────
function ImageGenWorkbench({ tool, onBack }) {
  const [style, setStyle] = React.useState("Realistic");
  const [ip, setIp] = React.useState("IP1");
  const [lock, setLock] = React.useState(true);
  const [active, setActive] = React.useState(0);
  const [prompt, setPrompt] = React.useState("Make the rain heavier, push the neon signs cooler, keep the character pose locked.");

  const versions = [
    { v: "v3 (Current)", date: "2024-10-24 17:35:38", tone: "violet" },
    { v: "v2",           date: "2024-10-24 17:05:39", tone: "rose"   },
    { v: "v1",           date: "2024-10-24 17:25:20", tone: "blue"   },
  ];

  return (
    <>
      <WorkbenchHead tool={tool} onBack={onBack} />

      <div className="aiw" style={{flex: 1, minHeight: 0}}>
        {/* INPUT */}
        <section className="aiw__panel">
          <header className="aiw__panel-head">
            <span className="aiw__panel-title">Input · Workspace</span>
            <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--ink-on-dark-3)", letterSpacing:"0.08em"}}>FRAME_18 / HUDA</span>
          </header>
          <div className="aiw__panel-body">
            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Upload Sketch</label>
              <div className="aiw__upload">
                <span className="aiw__upload__ico">{I.upload}</span>
                <div style={{fontSize:13, fontWeight:500, color:"var(--ink-on-dark)"}}>Drag &amp; drop file here</div>
                <div className="aiw__upload__formats">JPG · PNG · WEBP · SVG · ≤ 30MB</div>
                <button className="btn btn--secondary" style={{marginTop:6, background:"var(--bg-nav-2)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}}>Browse files</button>
              </div>
            </div>

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Description prompt</label>
              <textarea className="textarea textarea--dark"
                placeholder="A rainy cyberpunk street with neon billboards, low angle, cinematic depth, character mid-shot, holding umbrella…"
                defaultValue="Rainy cyberpunk street, low angle, cinematic mid-shot. Hero with leather jacket, soaked. Cool teal-magenta neon. Volumetric haze. Holds umbrella tilted." />
            </div>

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Negative prompt</label>
              <textarea className="textarea textarea--dark" style={{minHeight: 50}}
                defaultValue="blurry, low-quality, deformed hands, watermark, text artifacts" />
            </div>

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Style selection</label>
              <div className="aiw__style-grid">
                {[
                  { k: "2D",        sub: "ILLUSTRATION" },
                  { k: "3D",        sub: "RENDER" },
                  { k: "Realistic", sub: "PHOTO" },
                ].map(s => (
                  <button key={s.k}
                    className={`aiw__style-btn ${style === s.k ? "active" : ""}`}
                    onClick={() => setStyle(s.k)}>
                    {s.k}
                    <span className="sub">{s.sub}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn--secondary" style={{marginTop:8, background:"var(--bg-input-dark)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}}>
                {I.upload}<span>Upload Custom Style</span>
              </button>
            </div>

            <div className="aiw__refs-labels">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Environment Ref</label>
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Character Ref</label>
            </div>
            <div className="aiw__refs">
              <div className="aiw__ref aiw__ref--filled">
                <Placeholder tone="violet" label="ENV REF" style={{position:"absolute", inset:0, borderRadius:0}} />
                <span className="aiw__ref-tag">ENV · CYBERPUNK_STREET</span>
              </div>
              <div className="aiw__ref aiw__ref--filled">
                <Placeholder tone="rose" label="CHAR REF" style={{position:"absolute", inset:0, borderRadius:0}} />
                <span className="aiw__ref-tag">CHAR · HERO_03</span>
              </div>
            </div>

            <div className="field" style={{marginTop:14}}>
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>
                IP Presets
                <span className="field__hint" style={{marginLeft:"auto"}}>STUDIO LIBRARY</span>
              </label>
              <div className="aiw__ip-row">
                {["IP1","IP2","IP3"].map(k => (
                  <button key={k}
                    className={`aiw__ip-btn ${ip === k ? "active" : ""}`}
                    onClick={() => setIp(k)}>{k}</button>
                ))}
              </div>
            </div>

            <div className="aiw__consist">
              <span style={{color:"var(--ink-on-dark)"}}>{I.lock}</span>
              <div className="lbl">
                Lock Character Consistency
                <em>Forces same facial features across frames</em>
              </div>
              <button className={`toggle ${lock ? "toggle--on" : ""}`} onClick={() => setLock(!lock)} />
            </div>
          </div>
        </section>

        {/* CANVAS */}
        <section className="aiw__panel aiw__panel--canvas">
          <header className="aiw__panel-head">
            <span className="aiw__panel-title" style={{color:"var(--ink-2)"}}>Output Preview</span>
            <span className="chip chip--approved"><span className="dot-status dot-status--approved"/>v3 · APPROVED</span>
            <span style={{flex:1}} />
            <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)"}}>RENDER · 12.4s · 1920×1080</span>
          </header>

          <div className="canvas-wrap">
            <div className="canvas-stage">
              <Placeholder tone="violet" label="GENERATED OUTPUT · CYBERPUNK STREET" style={{position:"absolute", inset:0}} />
              <div className="canvas-sel"><i className="h1"/><i className="h2"/></div>
              <div style={{
                position:"absolute", left:12, bottom:12, background:"rgba(0,0,0,0.6)",
                padding:"6px 10px", borderRadius:6, color:"#fff",
                fontFamily:"var(--f-mono)", fontSize:10.5, letterSpacing:"0.06em"
              }}>SELECTION · 612 × 410 px · local edit zone</div>
            </div>
          </div>

          <div className="canvas-prompt">
            <label className="field__label" style={{marginBottom:8}}>
              Local Edit Prompt
              <span className="field__hint" style={{marginLeft:"auto"}}>EDITS ONLY SELECTION</span>
            </label>
            <textarea className="textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the local edit (e.g. 'replace billboard with company logo, keep lighting')" />
          </div>

          <div className="canvas-toolbar">
            <button className="btn btn--ghost">{I.eye}<span>Compare v2</span></button>
            <button className="btn btn--ghost">{I.refresh}<span>Reset selection</span></button>
            <span className="spacer" />
            <button className="btn btn--secondary">{I.download}<span>Download</span></button>
            <button className="btn btn--secondary">{I.save}<span>Save version</span></button>
            <button className="btn btn--primary">{I.spark}<span>Regenerate</span></button>
          </div>
        </section>

        {/* VERSIONS */}
        <section className="aiw__panel">
          <header className="aiw__panel-head">
            <span className="aiw__panel-title">Version history</span>
          </header>
          <div className="aiw__panel-body">
            <div className="versions">
              {versions.map((v, i) => (
                <button key={i}
                  className={`version ${active === i ? "active" : ""}`}
                  onClick={() => setActive(i)}>
                  <div className="version__thumb">
                    <Placeholder tone={v.tone} label="" style={{height:"100%", borderRadius:0}} />
                  </div>
                  <div className="version__meta">
                    <span className="version__name">{v.v}</span>
                    <span className="version__date">{v.date}</span>
                  </div>
                  {i === 0 ? <span className="version__current-tag">Current</span> : null}
                </button>
              ))}
            </div>

            <div style={{
              marginTop:16, padding:"10px 12px",
              border:"1px solid var(--line-on-dark-2)",
              borderRadius:8, background:"var(--bg-input-dark)"
            }}>
              <div style={{fontFamily:"var(--f-mono)", fontSize:10, letterSpacing:"0.10em", color:"var(--ink-on-dark-3)", marginBottom:4}}>SEED · LOCKED</div>
              <div style={{fontFamily:"var(--f-mono)", fontSize:12, color:"var(--ink-on-dark)"}}>0xA7F4 · 8821</div>
            </div>

            <button className="btn btn--secondary" style={{marginTop:12, width:"100%", justifyContent:"center", background:"var(--bg-input-dark)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}}>
              View full history
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// AI WORKSPACE — orchestrator (Home ↔ Workbench)
// ─────────────────────────────────────────────────────────────
function AIWorkspace({ onSwitchScreen, onActiveToolChange }) {
  const [toolId, setToolId] = React.useState(() => {
    try { return localStorage.getItem("bt_tool") || null; } catch (e) { return null; }
  });
  const [pinned, setPinned] = React.useState(() => {
    try {
      const raw = localStorage.getItem("bt_pinned");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return ["image-gen", "upscaler", "editor", "video-gen"];
  });

  React.useEffect(() => {
    try { localStorage.setItem("bt_tool", toolId || ""); } catch (e) {}
    if (onActiveToolChange) onActiveToolChange(toolId || null);
  }, [toolId]);
  React.useEffect(() => {
    try { localStorage.setItem("bt_pinned", JSON.stringify(pinned)); } catch (e) {}
  }, [pinned]);

  const togglePin = (id) => {
    setPinned(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  // Validate stale tool from localStorage
  React.useEffect(() => {
    if (toolId && !TOOLS.find(t => t.id === toolId)) setToolId(null);
  }, [toolId]);

  if (!toolId) {
    return <WorkspaceHome pinned={pinned} onPin={togglePin} onOpen={setToolId} onSwitchScreen={onSwitchScreen} />;
  }

  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) {
    return <WorkspaceHome pinned={pinned} onPin={togglePin} onOpen={setToolId} onSwitchScreen={onSwitchScreen} />;
  }

  // Pick workbench by tool id
  let Workbench = ComingSoonWorkbench;
  if (toolId === "image-gen") Workbench = ImageGenWorkbench;
  else if (toolId === "upscaler") Workbench = UpscalerWorkbench;
  else if (toolId === "editor")   Workbench = EditorWorkbench;

  return <Workbench tool={tool} onBack={() => setToolId(null)} />;
}

window.AIWorkspace = AIWorkspace;
window.ImageGenWorkbench = ImageGenWorkbench;
