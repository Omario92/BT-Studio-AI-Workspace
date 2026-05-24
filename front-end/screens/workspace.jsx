// ─────────────────────────────────────────────────────────────
// IMAGE GENERATOR WORKBENCH (the original workspace, now scoped)
// ─────────────────────────────────────────────────────────────
function ImageGenWorkbench({ tool, onBack }) {
  const [style, setStyle] = React.useState("Realistic");
  const [ip, setIp] = React.useState("IP1");
  const [lock, setLock] = React.useState(true);
  const [active, setActive] = React.useState(0);
  const [prompt, setPrompt] = React.useState("Make the rain heavier, push the neon signs cooler, keep the character pose locked.");
  const [promptText, setPromptText] = React.useState("Rainy cyberpunk street, low angle, cinematic mid-shot. Hero with leather jacket, soaked. Cool teal-magenta neon. Volumetric haze. Holds umbrella tilted.");

  const [currentJob, setCurrentJob] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [generatedAsset, setGeneratedAsset] = React.useState(null);
  
  const pollTimerRef = React.useRef(null);

  const startPolling = (jobId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (typeof jobsApi === "undefined") return;
      jobsApi.getJob(jobId).then(job => {
        setCurrentJob(job);
        setProgress(job.progress || 0);
        if (job.status === "COMPLETED") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          if (job.assets && job.assets.length > 0) {
            setGeneratedAsset(job.assets[0]);
          } else {
            setGeneratedAsset({ name: "Generated_Output.png" });
          }
        } else if (job.status === "FAILED") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }).catch(() => {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      });
    }, 1500);
  };

  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleGenerate = () => {
    const activeProjId = localStorage.getItem("bt_active_proj") || "proj_huda";
    setProgress(0);
    setCurrentJob({ status: "QUEUED", type: "IMAGE_GENERATION" });
    
    if (typeof jobsApi === "undefined") {
      // Offline fallback
      setTimeout(() => {
        setProgress(50);
        setCurrentJob({ status: "RUNNING", type: "IMAGE_GENERATION" });
        setTimeout(() => {
          setProgress(100);
          setCurrentJob({ status: "COMPLETED", type: "IMAGE_GENERATION" });
          setGeneratedAsset({ name: "Offline_Gen.png" });
        }, 1500);
      }, 1500);
      return;
    }

    jobsApi.createJob({
      name: `Frame_${Date.now().toString().slice(-4)}`,
      type: "IMAGE_GENERATION",
      projectId: activeProjId,
      toolId: tool._dbId,
      params: { prompt: promptText }
    }).then(job => {
      setCurrentJob(job);
      startPolling(job.id);
    }).catch(err => {
      console.error(err);
      setCurrentJob({ status: "FAILED", errorMsg: err.message || "Failed to start job" });
    });
  };

  const versions = [
    { v: "v3 (Current)", date: "2024-10-24 17:35:38", tone: "violet" },
    { v: "v2",           date: "2024-10-24 17:05:39", tone: "rose"   },
    { v: "v1",           date: "2024-10-24 17:25:20", tone: "blue"   },
  ];

  const isGenerating = currentJob && (currentJob.status === "RUNNING" || currentJob.status === "QUEUED");

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
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder="A rainy cyberpunk street with neon billboards, low angle, cinematic depth, character mid-shot, holding umbrella…" />
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
            {isGenerating ? (
              <span className="chip chip--generating"><span className="dot-status dot-status--generating"/>{currentJob.status} · {progress}%</span>
            ) : currentJob?.status === "COMPLETED" ? (
              <span className="chip chip--approved"><span className="dot-status dot-status--approved"/>COMPLETED</span>
            ) : currentJob?.status === "FAILED" ? (
              <span className="chip chip--failed"><span className="dot-status dot-status--failed"/>FAILED</span>
            ) : (
              <span className="chip chip--approved"><span className="dot-status dot-status--approved"/>v3 · APPROVED</span>
            )}
            <span style={{flex:1}} />
            <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)"}}>RENDER · 12.4s · 1920×1080</span>
          </header>

          <div className="canvas-wrap">
            <div className="canvas-stage">
              {isGenerating && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(13,15,18,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 10, borderRadius: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="dot-status dot-status--generating" style={{ width: 10, height: 10, display: "inline-block" }} />
                    {currentJob.status === "QUEUED" ? "In Queue..." : "Generating via GPU..."}
                  </div>
                  <div style={{ width: 220, height: 4, background: "var(--line-on-dark-2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 200ms ease" }} />
                  </div>
                  <div style={{ color: "var(--ink-on-dark-3)", fontFamily: "var(--f-mono)", fontSize: 10.5 }}>
                    PROGRESS · {progress}% · {currentJob.type}
                  </div>
                </div>
              )}
              {currentJob?.status === "COMPLETED" && generatedAsset ? (
                <Placeholder tone="teal" label={`COMPLETED: ${generatedAsset.name}`} style={{position:"absolute", inset:0}} />
              ) : currentJob?.status === "FAILED" ? (
                <div style={{ position: "absolute", inset: 0, background: "rgba(180,50,31,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div style={{ color: "var(--st-failed)", fontWeight: 600 }}>Generation Failed</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{currentJob.errorMsg || "Provider timeout"}</div>
                </div>
              ) : (
                <Placeholder tone="violet" label="GENERATED OUTPUT · CYBERPUNK STREET" style={{position:"absolute", inset:0}} />
              )}
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
            <button className="btn btn--primary" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating..." : <><span style={{display:"inline-flex",marginRight:4}}>{I.spark}</span><span>Regenerate</span></>}
            </button>
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
