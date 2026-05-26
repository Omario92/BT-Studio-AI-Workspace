// Shared workbench header
function WorkbenchHead({ tool, onBack, extra }) {
  return (
    <div className="wb-head">
      <button className="wb-head__back" onClick={onBack}>
        {I.chevLeft}<span>All tools</span>
      </button>
      <div style={{width:1, height: 22, background: "var(--line)"}} />
      <div className="wb-head__title">
        <div className={`tool-icon tool-icon--${tool.cat}`} style={{width: 30, height: 30, borderRadius: 8}}>{tool.icon}</div>
        <div>
          <h1>{tool.name}</h1>
          <div className="wb-head__sub">{CAT_LABELS[tool.cat]} · Project: Huda Commercial</div>
        </div>
        {tool.badge ? <span className={`badge badge--${tool.badge.kind}`}>{tool.badge.text}</span> : null}
      </div>
      <span className="spacer" />
      {extra}
      <button className="btn btn--secondary">{I.history}<span>History</span></button>
      <button className="btn btn--secondary">{I.save}<span>Save preset</span></button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPSCALER WORKBENCH
// ─────────────────────────────────────────────────────────────
function UpscalerWorkbench({ tool, onBack }) {
  const [factor, setFactor] = React.useState("4x");
  const [face, setFace] = React.useState(true);
  const [detail, setDetail] = React.useState(72);
  const [denoise, setDenoise] = React.useState(45);

  // V0.6 — preloaded source from Projects screen
  const [sourceAsset, setSourceAsset] = React.useState(() => {
    try {
      const raw = localStorage.getItem("bt_selected_assets_for_ai");
      if (!raw) return null;
      const ctx = JSON.parse(raw);
      if (ctx && Array.isArray(ctx.assets) && ctx.assets.length > 0 && (ctx.toolId === "upscaler" || ctx.jobType === "IMAGE_UPSCALE")) {
        return { ...ctx.assets[0], projectId: ctx.projectId || ctx.assets[0].projectId };
      }
      return null;
    } catch (e) { return null; }
  });

  const [currentJob, setCurrentJob] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [outputResult, setOutputResult] = React.useState(null); // { fileUrl, assetId, assetVersionId, provider, mockFallback }
  const [submitError, setSubmitError] = React.useState(null);
  const pollTimerRef = React.useRef(null);

  React.useEffect(() => () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }, []);

  const clearSource = () => {
    try { localStorage.removeItem("bt_selected_assets_for_ai"); } catch (e) {}
    setSourceAsset(null);
    setOutputResult(null);
    setCurrentJob(null);
    setProgress(0);
  };

  const isGenerating = currentJob && (currentJob.status === "QUEUED" || currentJob.status === "RUNNING");
  const scaleFromFactor = (f) => f === "2x" ? 2 : f === "8x" ? 8 : 4;

  const pollJob = (jobId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const job = await jobsApi.getJob(jobId);
        setCurrentJob(job);
        setProgress(job.progress || 0);
        if (job.status === "COMPLETED") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          const r = job.result || {};
          // Try to resolve a signed preview URL for the output
          let displayUrl = r.fileUrl || null;
          if (r.fileKey && typeof assetsApi !== "undefined") {
            try {
              const signed = await assetsApi.getSignedUrl(r.fileKey);
              if (signed) displayUrl = signed;
            } catch (e) {}
          }
          setOutputResult({ ...r, displayUrl });
        } else if (job.status === "FAILED" || job.status === "CANCELLED") {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSubmitError(job.errorMsg || "Upscale job failed");
        }
      } catch (err) {
        // Transient — keep polling
        console.warn("[Upscaler] poll error:", err);
      }
    }, 1500);
  };

  const handleUpscale = async () => {
    if (!sourceAsset) return;
    setSubmitError(null);
    setOutputResult(null);
    setProgress(0);
    setCurrentJob({ status: "QUEUED", type: "IMAGE_UPSCALE" });
    try {
      const projectId = sourceAsset.projectId || localStorage.getItem("bt_active_proj");
      const result = await assetsApi.useWithAI([sourceAsset.id], {
        projectId,
        toolId: "upscaler",
        jobType: "IMAGE_UPSCALE",
        mode: "single",
        params: {
          assetId: sourceAsset.id,
          sourceFileUrl: sourceAsset.sourceFileUrl || sourceAsset.previewUrl || sourceAsset.fileUrl,
          sourceFileKey: sourceAsset.fileKey || null,
          scale: scaleFromFactor(factor),
          faceEnhance: !!face,
          detail,
          denoise,
          outputPolicy: "NEW_VERSION_OF_SOURCE_ASSET",
          providerPreference: ["dispatcher", "comfyui", "mock"],
        },
      });
      const job = result.job;
      if (!job?.id) throw new Error("Job creation returned no id");
      setCurrentJob(job);
      pollJob(job.id);
    } catch (err) {
      console.error(err);
      setSubmitError(err?.message || "Failed to start upscale job");
      setCurrentJob({ status: "FAILED", errorMsg: err?.message || "Failed to start upscale job" });
    }
  };

  const openInProject = () => {
    if (!outputResult) return;
    try {
      if (outputResult.assetId) localStorage.setItem("bt_focus_asset", outputResult.assetId);
      if (outputResult.assetVersionId) localStorage.setItem("bt_focus_version", outputResult.assetVersionId);
      localStorage.removeItem("bt_selected_assets_for_ai");
      localStorage.setItem("bt_screen", "projects");
      window.location.reload();
    } catch (e) {}
  };

  return (
    <>
      <WorkbenchHead tool={tool} onBack={onBack} />

      <div className="upscaler" style={{flex: 1, minHeight: 0}}>
        {/* SIDE PANEL */}
        <aside className="up-side">
          <div className="up-side__head">Upscale Settings</div>
          <div className="up-side__body">

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>
                Source image
                {sourceAsset && (
                  <span className="field__hint" style={{marginLeft: "auto"}}>PRELOADED FROM PROJECTS</span>
                )}
              </label>
              <div style={{
                border: "1px solid var(--line-on-dark-2)",
                background: "var(--bg-input-dark)",
                borderRadius: 10, padding: 8,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{width: 56, height: 56, borderRadius: 6, overflow: "hidden", background: "var(--bg-canvas-2)"}}>
                  {sourceAsset?.previewUrl ? (
                    <img src={sourceAsset.previewUrl} alt={sourceAsset.name} style={{width: "100%", height: "100%", objectFit: "cover"}} />
                  ) : (
                    <Placeholder tone="violet" label="" style={{height:"100%", borderRadius: 0}} />
                  )}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 11, color:"#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"}} title={sourceAsset?.name || "No source"}>
                    {sourceAsset?.name || "No source selected"}
                  </div>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 10, color:"var(--ink-on-dark-3)", marginTop: 2}}>
                    {sourceAsset ? `${sourceAsset.mimeType || "image"} · v${sourceAsset.currentVersion ?? 1}` : "Use 'Use with AI' from Projects"}
                  </div>
                </div>
                {sourceAsset && (
                  <button className="icon-btn" onClick={clearSource} title="Clear source">{I.x}</button>
                )}
              </div>
            </div>

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Upscale factor</label>
              <div className="factor-grid">
                {[
                  { k: "2x", sub: "2048" },
                  { k: "4x", sub: "4096" },
                  { k: "8x", sub: "8192" },
                ].map(f => (
                  <button key={f.k}
                    className={`factor-btn ${factor === f.k ? "active" : ""}`}
                    onClick={() => setFactor(f.k)}>
                    <span className="big">{f.k}</span>
                    <span className={`sub ${factor === f.k ? "sub-active" : ""}`}>→ {f.sub}px</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                Detail enhancement
                <span className="v">{detail}%</span>
              </div>
              <div className="slider-track" onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setDetail(Math.round(((e.clientX - r.left) / r.width) * 100));
              }}>
                <div className="fill" style={{width: detail + "%"}}/>
                <div className="thumb" style={{left: detail + "%"}}/>
              </div>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                Denoise
                <span className="v">{denoise}%</span>
              </div>
              <div className="slider-track" onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setDenoise(Math.round(((e.clientX - r.left) / r.width) * 100));
              }}>
                <div className="fill" style={{width: denoise + "%"}}/>
                <div className="thumb" style={{left: denoise + "%"}}/>
              </div>
            </div>

            <div className="aiw__consist" style={{marginTop: 6}}>
              <span style={{color:"var(--ink-on-dark)"}}>{I.face}</span>
              <div className="lbl">
                Face enhancement
                <em>Identity-aware skin & feature refinement</em>
              </div>
              <button className={`toggle ${face ? "toggle--on" : ""}`} onClick={() => setFace(!face)} />
            </div>

            <div style={{
              marginTop: 16, padding: "10px 12px",
              border: "1px solid var(--line-on-dark-2)",
              borderRadius: 8, background: "var(--bg-input-dark)"
            }}>
              <div style={{fontFamily:"var(--f-mono)", fontSize: 10, letterSpacing:"0.10em", color:"var(--ink-on-dark-3)", marginBottom: 6}}>OUTPUT ESTIMATE</div>
              <div style={{display: "flex", justifyContent:"space-between", fontFamily:"var(--f-mono)", fontSize: 12, color:"var(--ink-on-dark)"}}>
                <span>Resolution</span><span>{factor === "2x" ? "2048" : factor === "4x" ? "4096" : "8192"}px</span>
              </div>
              <div style={{display: "flex", justifyContent:"space-between", fontFamily:"var(--f-mono)", fontSize: 12, color:"var(--ink-on-dark)", marginTop: 4}}>
                <span>Render time</span><span>~{factor === "2x" ? 6 : factor === "4x" ? 14 : 38}s</span>
              </div>
              <div style={{display: "flex", justifyContent:"space-between", fontFamily:"var(--f-mono)", fontSize: 12, color:"var(--ink-on-dark)", marginTop: 4}}>
                <span>GPU cost</span><span>{factor === "2x" ? "1" : factor === "4x" ? "3" : "8"} credits</span>
              </div>
            </div>
          </div>
          <div className="up-side__foot">
            <button className="btn btn--secondary" style={{flex:1, justifyContent:"center", background:"var(--bg-input-dark)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}} onClick={() => { setFactor("4x"); setFace(true); setDetail(72); setDenoise(45); }}>Reset</button>
            <button
              className="btn btn--primary"
              style={{flex:2, justifyContent:"center"}}
              onClick={handleUpscale}
              disabled={!sourceAsset || isGenerating}
              title={!sourceAsset ? "Pick an image from Projects → Use with AI" : (isGenerating ? "Job running..." : "Run upscale")}
            >
              {I.spark}<span>{isGenerating ? `${currentJob?.status || "RUNNING"} · ${progress}%` : "Upscale"}</span>
            </button>
          </div>
        </aside>

        {/* CANVAS */}
        <section className="up-canvas">
          <header className="up-canvas__head">
            <span className="lbl">Before / After</span>
            {outputResult ? (
              <span className="chip chip--approved"><span className="dot-status dot-status--approved"/>UPSCALE COMPLETE{outputResult.mockFallback ? " · MOCK" : ""}</span>
            ) : isGenerating ? (
              <span className="chip chip--generating"><span className="dot-status dot-status--generating"/>{currentJob.status} · {progress}%</span>
            ) : submitError ? (
              <span className="chip chip--failed"><span className="dot-status dot-status--failed"/>FAILED</span>
            ) : (
              <span className="chip chip--draft"><span className="dot-status dot-status--draft"/>READY</span>
            )}
            <span style={{flex: 1}} />
            <div className="segmented">
              <button className="active">Compare</button>
              <button>Before</button>
              <button>After</button>
            </div>
          </header>
          <div className="up-canvas__stage">
            <div className="compare">
              <div className="before" style={{position: "relative", overflow: "hidden"}}>
                {sourceAsset?.previewUrl ? (
                  <img src={sourceAsset.previewUrl} alt={sourceAsset.name} style={{width: "100%", height: "100%", objectFit: "contain"}} />
                ) : (
                  <Placeholder tone="violet" label="" />
                )}
                <span className="compare__tag" style={{left: 12}}>BEFORE · {sourceAsset?.name || "no source"}</span>
              </div>
              <div className="after" style={{position: "relative", overflow: "hidden"}}>
                {outputResult?.displayUrl ? (
                  <img src={outputResult.displayUrl} alt="Upscaled output" style={{width: "100%", height: "100%", objectFit: "contain"}} />
                ) : isGenerating ? (
                  <div style={{position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(13,15,18,0.85)", gap: 10}}>
                    <span className="dot-status dot-status--generating" style={{width: 10, height: 10}} />
                    <div style={{color: "#fff", fontFamily: "var(--f-mono)", fontSize: 12}}>{currentJob.status} · {progress}%</div>
                    <div style={{width: 220, height: 4, background: "var(--line-on-dark-2)", borderRadius: 2, overflow: "hidden"}}>
                      <div style={{width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 200ms ease"}} />
                    </div>
                  </div>
                ) : submitError ? (
                  <div style={{position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(180,50,31,0.1)", gap: 6, padding: 24, textAlign: "center"}}>
                    <div style={{color: "var(--st-failed)", fontWeight: 600}}>Upscale failed</div>
                    <div style={{fontSize: 12, color: "var(--ink-3)"}}>{submitError}</div>
                  </div>
                ) : (
                  <Placeholder tone="violet" label="" />
                )}
                <span className="compare__tag" style={{right: 12}}>AFTER · {factor === "2x" ? "2048" : factor === "4x" ? "4096" : "8192"}px</span>
              </div>
              <div className="compare__handle"/>
            </div>
          </div>
          <div className="up-canvas__foot">
            <div className="up-stats">
              <span>Scale: <b>{factor}</b></span>
              <span>Face enhance: <b>{face ? "ON" : "OFF"}</b></span>
              <span>Detail: <b>{detail}%</b></span>
              <span>Denoise: <b>{denoise}%</b></span>
              {outputResult?.provider && <span>Provider: <b>{outputResult.provider}</b></span>}
              {outputResult?.assetVersionId && <span style={{color: "var(--st-approved)"}}><b>Created new AssetVersion</b></span>}
            </div>
            <span className="spacer" />
            {outputResult?.displayUrl && (
              <a className="btn btn--secondary" href={outputResult.displayUrl} target="_blank" rel="noreferrer">
                {I.download}<span>Download</span>
              </a>
            )}
            <button
              className="btn btn--primary"
              onClick={openInProject}
              disabled={!outputResult || !outputResult.assetId}
              title={!outputResult ? "Run upscale first" : "Jump to the new version in Projects"}
            >
              {I.folder}<span>Open in Project</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// EDITOR WORKBENCH (mask + inpaint)
// ─────────────────────────────────────────────────────────────
function EditorWorkbench({ tool, onBack }) {
  const [active, setActive] = React.useState("brush");
  const [brushSize, setBrushSize] = React.useState(48);
  const [prompt, setPrompt] = React.useState("Replace the bottle's label with the Halida hero logo, keep the metallic finish and golden hour lighting.");

  // Load selected edit asset from localStorage if available
  const [editAsset, setEditAsset] = React.useState(() => {
    try {
      const stored = localStorage.getItem("bt_edit_asset");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const tools = [
    { id: "select",  ico: I.panelLeft },
    { id: "brush",   ico: I.brush },
    { id: "eraser",  ico: I.x },
    { id: "lasso",   ico: I.filter },
  ];

  return (
    <>
      <WorkbenchHead tool={tool} onBack={onBack} />

      <div className="editor" style={{flex: 1, minHeight: 0}}>
        {/* LEFT — asset selector + brush options */}
        <aside className="up-side">
          <div className="up-side__head">Asset & Brush</div>
          <div className="up-side__body">

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Selected asset</label>
              <div style={{
                border: "1px solid var(--line-on-dark-2)",
                background: "var(--bg-input-dark)",
                borderRadius: 10, padding: 8,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{width: 56, height: 56, borderRadius: 6, overflow: "hidden", background: 'var(--bg-canvas-2)'}}>
                  {editAsset?.previewUrl ? (
                    <img src={editAsset.previewUrl} alt={editAsset.assetName} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                  ) : (
                    <Placeholder tone="amber" label="" style={{height:"100%", borderRadius: 0}} />
                  )}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 11, color:"#fff", textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}} title={editAsset?.assetName || "Bottle_Hero_v1.png"}>
                    {editAsset?.assetName || "Bottle_Hero_v1.png"}
                  </div>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 10, color:"var(--ink-on-dark-3)", marginTop: 2}}>
                    {editAsset ? `v1 · ${editAsset.mimeType || 'image/png'}` : "v1 · 2048 × 2048"}
                  </div>
                </div>
                <button className="icon-btn" title="Clear selection" onClick={() => {
                  localStorage.removeItem("bt_edit_asset");
                  setEditAsset(null);
                }}>{I.x}</button>
              </div>
            </div>

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Mask mode</label>
              <div className="segmented segmented--dark" style={{width:"100%"}}>
                <button className="active" style={{flex:1}}>Inpaint</button>
                <button style={{flex:1}}>Outpaint</button>
                <button style={{flex:1}}>Erase</button>
              </div>
            </div>

            <div className="slider-row">
              <div className="slider-row__head">
                Brush size
                <span className="v">{brushSize} px</span>
              </div>
              <div className="slider-track" onClick={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setBrushSize(Math.round(((e.clientX - r.left) / r.width) * 200));
              }}>
                <div className="fill" style={{width: (brushSize/200)*100 + "%"}}/>
                <div className="thumb" style={{left: (brushSize/200)*100 + "%"}}/>
              </div>
            </div>
            <div className="slider-row">
              <div className="slider-row__head">
                Mask softness
                <span className="v">68%</span>
              </div>
              <div className="slider-track">
                <div className="fill" style={{width: "68%"}}/>
                <div className="thumb" style={{left: "68%"}}/>
              </div>
            </div>

            <div style={{marginTop: 14, padding: "10px 12px", border: "1px solid var(--line-on-dark-2)", borderRadius: 8, background: "var(--bg-input-dark)"}}>
              <div style={{fontFamily:"var(--f-mono)", fontSize:10, letterSpacing:"0.10em", color:"var(--ink-on-dark-3)", marginBottom: 6}}>MASK COVERAGE</div>
              <div style={{display:"flex", alignItems:"center", gap:10}}>
                <div style={{flex: 1, height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 999, overflow: "hidden"}}>
                  <div style={{height: "100%", width: "18%", background: "var(--accent)"}} />
                </div>
                <span style={{fontFamily:"var(--f-mono)", fontSize: 11, color: "#fff"}}>18%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER — canvas */}
        <section className="ed-canvas">
          <div className="ed-toolbar">
            {tools.map(t => (
              <button key={t.id}
                className={`ed-tool ${active === t.id ? "active" : ""}`}
                onClick={() => setActive(t.id)}>{t.ico}</button>
            ))}
            <div style={{width:1, height: 22, background: "var(--line)", margin: "0 4px"}} />
            <button className="ed-tool" title="Undo">{I.chevLeft}</button>
            <button className="ed-tool" title="Redo">{I.chevRight}</button>
            <span style={{flex:1}}/>
            <span style={{fontFamily:"var(--f-mono)", fontSize: 10.5, color: "var(--ink-4)", letterSpacing:"0.06em"}}>ZOOM</span>
            <div className="segmented" style={{padding: 2}}>
              <button>−</button>
              <button className="active">100%</button>
              <button>+</button>
            </div>
          </div>
          <div className="ed-stage">
            <div className="ed-image" style={{ background: '#0D0F12', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {editAsset?.previewUrl ? (
                <img src={editAsset.previewUrl} alt={editAsset.assetName} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} />
              ) : (
                <Placeholder tone="amber" label="BOTTLE_HERO_V1" style={{position:"absolute", inset:0, borderRadius: 0}}/>
              )}
              <div className="ed-mask">
                <span style={{top: "26%", left: "40%", width: 180, height: 220}}/>
                <span style={{top: "44%", left: "48%", width: 90, height: 70}}/>
              </div>
              <div style={{
                position: "absolute", left: 12, top: 12,
                background: "rgba(0,0,0,0.65)", color: "#fff",
                padding: "5px 9px", borderRadius: 5,
                fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.08em"
              }}>MASK · 2 regions · 18% coverage</div>
            </div>
          </div>
          <div className="ed-prompt">
            <label className="field__label" style={{marginBottom: 8}}>
              Local edit prompt
              <span className="field__hint" style={{marginLeft:"auto"}}>EDITS MASKED AREAS ONLY</span>
            </label>
            <textarea
              className="textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what to change..."
            />
          </div>
          <div className="ed-foot">
            <button className="btn btn--ghost">{I.refresh}<span>Clear mask</span></button>
            <button className="btn btn--ghost">{I.eye}<span>Hide mask</span></button>
            <span style={{flex:1}}/>
            <button className="btn btn--secondary">{I.save}<span>Save as new version</span></button>
            <button className="btn btn--primary">{I.spark}<span>Generate Edit</span></button>
          </div>
        </section>

        {/* RIGHT — version history (compact) */}
        <aside className="up-side">
          <div className="up-side__head">History · Layers</div>
          <div className="up-side__body">
            <div className="segmented segmented--dark" style={{width:"100%", marginBottom: 14}}>
              <button className="active" style={{flex:1}}>Versions</button>
              <button style={{flex:1}}>Layers</button>
            </div>
            <div className="versions">
              {[
                { v: "v4 (Current)", date: "now · mask edit", tone: "amber" },
                { v: "v3",           date: "12m ago",          tone: "amber" },
                { v: "v2",           date: "1h ago",           tone: "rose" },
                { v: "v1",           date: "Yesterday",        tone: "rose" },
              ].map((v, i) => (
                <div key={i} className={`version ${i === 0 ? "active" : ""}`}>
                  <div className="version__thumb"><Placeholder tone={v.tone} label="" style={{height:"100%", borderRadius:0}}/></div>
                  <div className="version__meta">
                    <span className="version__name">{v.v}</span>
                    <span className="version__date">{v.date}</span>
                  </div>
                  {i === 0 ? <span className="version__current-tag">Edited</span> : null}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// GENERIC "tool wired but workbench not yet built" placeholder
// ─────────────────────────────────────────────────────────────
function ComingSoonWorkbench({ tool, onBack }) {
  return (
    <>
      <WorkbenchHead tool={tool} onBack={onBack} />
      <div className="coming-soon">
        <div className="coming-soon__card">
          <div className={`coming-soon__ico tool-icon tool-icon--${tool.cat}`}
               style={{width: 60, height: 60, borderRadius: 14}}>
            {tool.icon}
          </div>
          <div style={{fontFamily:"var(--f-mono)", fontSize:10.5, letterSpacing:"0.12em", color:"var(--ink-4)", textTransform:"uppercase", marginBottom: 6}}>
            {CAT_LABELS[tool.cat]} · {tool.badge ? tool.badge.text.toUpperCase() : "WORKBENCH"}
          </div>
          <h2>{tool.name}</h2>
          <p>{tool.desc}</p>
          <p style={{color: "var(--ink-4)", fontSize: 12.5, fontFamily:"var(--f-mono)", letterSpacing:"0.04em"}}>
            This workbench follows the same shell as Image Generator and Upscaler — controls on the left,
            output preview in the center, history on the right. Wired into the same project context, queue and approval pipeline.
          </p>
          <div className="coming-soon__row">
            <button className="btn btn--secondary" onClick={onBack}>{I.chevLeft}<span>Back to tools</span></button>
            <button className="btn btn--primary">{I.spark}<span>Request access</span></button>
          </div>
        </div>
      </div>
    </>
  );
}

window.UpscalerWorkbench = UpscalerWorkbench;
window.EditorWorkbench = EditorWorkbench;
window.ComingSoonWorkbench = ComingSoonWorkbench;
window.WorkbenchHead = WorkbenchHead;
