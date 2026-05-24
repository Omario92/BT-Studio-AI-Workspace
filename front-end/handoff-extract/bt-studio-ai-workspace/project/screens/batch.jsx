function BatchMode() {
  // Build 30 batch output cells with mixed statuses
  const tones = ["rose","amber","green","violet","teal","blue","mono","neutral"];
  const cells = React.useMemo(() => {
    const seed = [
      "c","c","c","c","g","g",
      "g","g","g","g","c","c",
      "c","c","c","c","f","f",
      "c","c","c","c","c","c",
      "c","c","c","c","f","f"
    ];
    return seed.map((s, i) => ({
      status: s === "c" ? "complete" : s === "g" ? "gen" : "fail",
      tone: tones[i % tones.length],
      pct: 30 + ((i * 13) % 60)
    }));
  }, []);

  // Inputs: 23 filled out of 30
  const inputs = React.useMemo(() => {
    return Array.from({length: 30}, (_, i) => ({
      filled: i < 23,
      tone: tones[i % tones.length]
    }));
  }, []);

  return (
    <div className="batch">
      <div className="batch__col">
        <div className="batch__panel" style={{flex:"1 1 auto", display:"flex", flexDirection:"column", minHeight:0}}>
          <header className="batch__panel-head">
            <span style={{display:"inline-flex", color:"var(--accent)"}}>{I.layers}</span>
            <span className="batch__panel-title">Batch Input</span>
            <span className="batch__panel-meta">23 / 30 SLOTS</span>
          </header>
          <div className="batch__panel-body" style={{flex:1, overflow:"auto"}}>
            <div className="batch-input-grid">
              {inputs.map((s, i) => (
                s.filled
                  ? <div className="batch-slot batch-slot--filled" key={i}>
                      <Placeholder tone={s.tone} label="" style={{height:"100%", borderRadius:0}} />
                    </div>
                  : <div className="batch-slot" key={i}>{I.upload}</div>
              ))}
            </div>

            <div style={{
              marginTop: 14, padding:"10px 12px",
              border:"1px dashed var(--line-strong)",
              borderRadius:8, background:"var(--bg-canvas)",
              display:"flex", alignItems:"center", gap:10
            }}>
              <span style={{color:"var(--accent)", display:"inline-flex"}}>{I.upload}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:500}}>Upload sketches (20 – 40 files)</div>
                <div style={{fontFamily:"var(--f-mono)", fontSize:10.5, color:"var(--ink-4)", letterSpacing:"0.06em"}}>
                  JPG · PNG · WEBP · SVG · MAX 30MB EACH
                </div>
              </div>
              <button className="btn btn--secondary">Browse</button>
              <button className="btn btn--primary">{I.plus}<span>Add</span></button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="batch__panel">
          <header className="batch__panel-head">
            <span className="batch__panel-title">Generation Options</span>
            <span className="batch__panel-meta">APPLIED TO ALL</span>
          </header>
          <div className="batch__panel-body" style={{padding:"8px 18px"}}>
            <div className="options-row">
              <div className="options-row__label">
                Apply Style
                <em>2D / 3D / Realistic / Custom</em>
              </div>
              <div className="dropdown">Realistic {I.chevDown}</div>
            </div>
            <div className="options-row" style={{borderTop:"1px solid var(--line-2)"}}>
              <div className="options-row__label">
                Character consistency
                <em>Use locked seed across batch</em>
              </div>
              <button className="toggle toggle--on" />
            </div>
            <div className="options-row" style={{borderTop:"1px solid var(--line-2)"}}>
              <div className="options-row__label">
                Environment Reference
                <em>Single image applied to all frames</em>
              </div>
              <button className="btn btn--secondary" style={{padding:"6px 10px", fontSize:12}}>{I.upload}<span>Upload Ref</span></button>
            </div>
            <div className="options-row" style={{borderTop:"1px solid var(--line-2)"}}>
              <div className="options-row__label">
                IP Preset
                <em>Brand IP applied to outputs</em>
              </div>
              <div className="dropdown">IP1 · HUDA {I.chevDown}</div>
            </div>
            <div className="options-row" style={{borderTop:"1px solid var(--line-2)"}}>
              <div className="options-row__label">
                Output resolution
                <em>1024 · 1920 · 2560 px</em>
              </div>
              <div className="dropdown">1920 × 1080 {I.chevDown}</div>
            </div>
          </div>
          <div style={{padding:"12px 18px", borderTop:"1px solid var(--line-2)", display:"flex", gap:10}}>
            <button className="btn btn--secondary" style={{flex:1, justifyContent:"center"}}>Save preset</button>
            <button className="btn btn--primary" style={{flex:1.4, justifyContent:"center"}}>{I.spark}<span>Run batch (23)</span></button>
          </div>
        </div>
      </div>

      {/* Output column */}
      <div className="batch__col">
        <div className="batch__panel" style={{flex:1, display:"flex", flexDirection:"column", minHeight:0}}>
          <header className="batch__panel-head">
            <span style={{display:"inline-flex", color:"var(--st-approved)"}}>{I.layers}</span>
            <span className="batch__panel-title">Batch Output</span>
            <div style={{display:"flex", gap:6}}>
              <span className="chip chip--approved">22 done</span>
              <span className="chip chip--generating">4 generating</span>
              <span className="chip chip--failed">4 failed</span>
            </div>
            <span style={{flex:1}}/>
            <span className="batch__panel-meta">JOB · EX-2487</span>
          </header>

          <div className="batch__panel-body" style={{flex:1, overflow:"auto"}}>
            <div className="batch-output-grid">
              {cells.map((c, i) => (
                <div key={i} className={`batch-out batch-out--${c.status}`}>
                  {c.status === "complete" ? (
                    <>
                      <Placeholder tone={c.tone} label="" style={{height:"100%", borderRadius:0}} />
                      <div className="batch-out__status">
                        <span className="dot-status dot-status--approved"/>Completed
                      </div>
                    </>
                  ) : c.status === "gen" ? (
                    <>
                      <div className="batch-out__gen"><div className="spinner"/></div>
                      <div className="batch-out__progress"><span style={{width: c.pct + "%"}}/></div>
                      <div className="batch-out__status">
                        <span className="dot-status dot-status--generating"/>Generating · {c.pct}%
                      </div>
                    </>
                  ) : (
                    <>
                      <Placeholder tone="rose" label="ERR" style={{height:"100%", borderRadius:0, filter:"grayscale(0.5)"}} />
                      <div className="batch-out__status">
                        <span className="dot-status dot-status--failed"/>Failed · retry
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="batch__cta">
            <button className="btn btn--secondary">{I.refresh}<span>Regenerate selected (4)</span></button>
            <button className="btn btn--ghost">{I.eye}<span>Compare grid</span></button>
            <span className="spacer"/>
            <button className="btn btn--secondary">{I.save}<span>Save all</span></button>
            <button className="btn btn--primary">{I.folder}<span>Export to project folder</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BatchMode = BatchMode;
