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

  return (
    <>
      <WorkbenchHead tool={tool} onBack={onBack} />

      <div className="upscaler" style={{flex: 1, minHeight: 0}}>
        {/* SIDE PANEL */}
        <aside className="up-side">
          <div className="up-side__head">Upscale Settings</div>
          <div className="up-side__body">

            <div className="field">
              <label className="field__label" style={{color:"var(--ink-on-dark)"}}>Source image</label>
              <div style={{
                border: "1px solid var(--line-on-dark-2)",
                background: "var(--bg-input-dark)",
                borderRadius: 10, padding: 8,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{width: 56, height: 56, borderRadius: 6, overflow: "hidden"}}>
                  <Placeholder tone="violet" label="" style={{height:"100%", borderRadius: 0}} />
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 11, color:"#fff"}}>KV_Hero_Image_v4.png</div>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 10, color:"var(--ink-on-dark-3)", marginTop: 2}}>
                    1024 × 1024 · 1.2 MB
                  </div>
                </div>
                <button className="icon-btn">{I.x}</button>
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
            <button className="btn btn--secondary" style={{flex:1, justifyContent:"center", background:"var(--bg-input-dark)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}}>Reset</button>
            <button className="btn btn--primary" style={{flex:2, justifyContent:"center"}}>{I.spark}<span>Upscale</span></button>
          </div>
        </aside>

        {/* CANVAS */}
        <section className="up-canvas">
          <header className="up-canvas__head">
            <span className="lbl">Before / After</span>
            <span className="chip chip--approved"><span className="dot-status dot-status--approved"/>UPSCALE COMPLETE</span>
            <span style={{flex: 1}} />
            <div className="segmented">
              <button className="active">Compare</button>
              <button>Before</button>
              <button>After</button>
            </div>
          </header>
          <div className="up-canvas__stage">
            <div className="compare">
              <div className="before">
                <Placeholder tone="violet" label="" />
                <span className="compare__tag" style={{left: 12}}>BEFORE · 1024px</span>
              </div>
              <div className="after">
                <Placeholder tone="violet" label="" />
                <span className="compare__tag" style={{right: 12}}>AFTER · {factor === "2x" ? "2048" : factor === "4x" ? "4096" : "8192"}px</span>
              </div>
              <div className="compare__handle"/>
            </div>
          </div>
          <div className="up-canvas__foot">
            <div className="up-stats">
              <span>Source: <b>1024×1024</b></span>
              <span>Output: <b>{factor === "2x" ? "2048×2048" : factor === "4x" ? "4096×4096" : "8192×8192"}</b></span>
              <span>Δ Sharpness: <b style={{color:"var(--st-approved)"}}>+38%</b></span>
              <span>Render: <b>{factor === "2x" ? "5.8s" : factor === "4x" ? "13.4s" : "37.9s"}</b></span>
            </div>
            <span className="spacer" />
            <button className="btn btn--secondary">{I.download}<span>Download</span></button>
            <button className="btn btn--secondary">{I.save}<span>Save version</span></button>
            <button className="btn btn--primary">{I.folder}<span>Save to project</span></button>
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
