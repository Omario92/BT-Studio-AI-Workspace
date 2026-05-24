function BatchMode() {
  const tones = ["rose", "amber", "green", "violet", "teal", "blue", "mono", "neutral"];

  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [currentBatchId, setCurrentBatchId] = React.useState(null);
  const [batchStatus, setBatchStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [offline, setOffline] = React.useState(false);

  const fileInputRef = React.useRef(null);

  const handleBrowseClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newFiles = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      rawFile: file,
      previewUrl: URL.createObjectURL(file)
    }));

    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 30));
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
  };

  const runBatch = async () => {
    if (!selectedFiles.length) return;

    const projectId = localStorage.getItem("bt_active_proj") || "proj_default";
    const toolId = "image-gen";
    const inputs = selectedFiles.map(f => ({
      name: f.name,
      params: {
        prompt: "cyberpunk street with neon signs, highly detailed",
        filename: f.name
      }
    }));

    setLoading(true);
    try {
      const { data, fromCache } = await jobsApi.createBatch({ projectId, toolId, inputs });
      setOffline(fromCache);
      setCurrentBatchId(data.batchId);
    } catch (err) {
      console.error(err);
      alert("Failed to start batch job: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll for status
  React.useEffect(() => {
    if (!currentBatchId) return;

    let timer;
    const poll = async () => {
      try {
        const { data, fromCache } = await jobsApi.getBatchStatus(currentBatchId);
        setOffline(fromCache);
        setBatchStatus(data);

        // Stop polling if completed or failed equals total
        const isDone = data.completed + data.failed === data.total && data.total > 0;
        if (isDone) {
          clearInterval(timer);
        }
      } catch (err) {
        console.error(err);
      }
    };

    poll();
    timer = setInterval(poll, 2500);

    return () => clearInterval(timer);
  }, [currentBatchId]);

  const handleRetryFailed = async () => {
    if (!currentBatchId) return;
    try {
      await jobsApi.retryBatch(currentBatchId);
      const { data } = await jobsApi.getBatchStatus(currentBatchId);
      setBatchStatus(data);
    } catch (err) {
      alert("Failed to retry batch: " + err.message);
    }
  };

  const handleCancelBatch = async () => {
    if (!currentBatchId) return;
    try {
      await jobsApi.cancelBatch(currentBatchId);
      const { data } = await jobsApi.getBatchStatus(currentBatchId);
      setBatchStatus(data);
    } catch (err) {
      alert("Failed to cancel batch: " + err.message);
    }
  };

  // Build 30 slots: selected files first, then empty slots
  const slots = React.useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      if (i < selectedFiles.length) {
        return { filled: true, file: selectedFiles[i], tone: tones[i % tones.length] };
      }
      return { filled: false };
    });
  }, [selectedFiles]);

  // Output cells map
  const outputCells = React.useMemo(() => {
    if (!batchStatus) {
      // Gorgeous initial mock fallback
      const seed = [
        "c", "c", "c", "c", "g", "g",
        "g", "g", "g", "g", "c", "c",
        "c", "c", "c", "c", "f", "f",
        "c", "c", "c", "c", "c", "c",
        "c", "c", "c", "c", "f", "f"
      ];
      return seed.map((s, i) => ({
        id: `mock_${i}`,
        status: s === "c" ? "complete" : s === "g" ? "gen" : "fail",
        tone: tones[i % tones.length],
        pct: 30 + ((i * 13) % 60),
        name: `Frame_${i}_v3`
      }));
    }

    return batchStatus.jobs.map((job, i) => {
      const apiStatus = job.status.toLowerCase();
      let status = "gen";
      if (apiStatus === "completed") status = "complete";
      else if (apiStatus === "failed") status = "fail";

      const fileUrl = job.assets?.[0]?.fileUrl;
      return {
        id: job.id,
        status,
        tone: tones[i % tones.length],
        pct: job.progress ?? (status === "complete" ? 100 : status === "gen" ? 64 : 0),
        name: job.name,
        fileUrl
      };
    });
  }, [batchStatus]);

  const stats = React.useMemo(() => {
    if (!batchStatus) {
      return { completed: 22, running: 4, failed: 4 };
    }
    return {
      completed: batchStatus.completed,
      running: batchStatus.running,
      failed: batchStatus.failed
    };
  }, [batchStatus]);

  return (
    <div className="batch">
      <div className="batch__col">
        {offline && (
          <div style={{ background: "var(--amber, #f59e0b)", color: "#000", padding: "6px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡</span> Showing mock data — backend offline
          </div>
        )}

        <div className="batch__panel" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <header className="batch__panel-head">
            <span style={{ display: "inline-flex", color: "var(--accent)" }}>{I.layers}</span>
            <span className="batch__panel-title">Batch Input</span>
            <span className="batch__panel-meta">{selectedFiles.length} / 30 SLOTS</span>
            {selectedFiles.length > 0 && (
              <button onClick={handleClearFiles} style={{ marginLeft: "auto", fontSize: 11, background: "none", border: "none", color: "var(--st-failed)", cursor: "pointer" }}>
                Clear
              </button>
            )}
          </header>
          <div className="batch__panel-body" style={{ flex: 1, overflow: "auto" }}>
            <div className="batch-input-grid">
              {slots.map((s, i) => (
                s.filled ? (
                  <div className="batch-slot batch-slot--filled" key={i} title={s.file.name}>
                    {s.file.previewUrl ? (
                      <img src={s.file.previewUrl} alt={s.file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Placeholder tone={s.tone} label="" style={{ height: "100%", borderRadius: 0 }} />
                    )}
                  </div>
                ) : (
                  <div className="batch-slot" key={i} onClick={handleBrowseClick} style={{ cursor: "pointer" }}>
                    {I.upload}
                  </div>
                )
              ))}
            </div>

            <div style={{
              marginTop: 14, padding: "10px 12px",
              border: "1px dashed var(--line-strong)",
              borderRadius: 8, background: "var(--bg-canvas)",
              display: "flex", alignItems: "center", gap: 10
            }}>
              <span style={{ color: "var(--accent)", display: "inline-flex" }}>{I.upload}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Upload sketches (20 – 40 files)</div>
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
                  JPG · PNG · WEBP · SVG · MAX 30MB EACH
                </div>
              </div>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button className="btn btn--secondary" onClick={handleBrowseClick}>Browse</button>
              <button className="btn btn--primary" onClick={handleBrowseClick}>{I.plus}<span>Add</span></button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="batch__panel">
          <header className="batch__panel-head">
            <span className="batch__panel-title">Generation Options</span>
            <span className="batch__panel-meta">APPLIED TO ALL</span>
          </header>
          <div className="batch__panel-body" style={{ padding: "8px 18px" }}>
            <div className="options-row">
              <div className="options-row__label">
                Apply Style
                <em>2D / 3D / Realistic / Custom</em>
              </div>
              <div className="dropdown">Realistic {I.chevDown}</div>
            </div>
            <div className="options-row" style={{ borderTop: "1px solid var(--line-2)" }}>
              <div className="options-row__label">
                Character consistency
                <em>Use locked seed across batch</em>
              </div>
              <button className="toggle toggle--on" />
            </div>
            <div className="options-row" style={{ borderTop: "1px solid var(--line-2)" }}>
              <div className="options-row__label">
                Environment Reference
                <em>Single image applied to all frames</em>
              </div>
              <button className="btn btn--secondary" style={{ padding: "6px 10px", fontSize: 12 }}>{I.upload}<span>Upload Ref</span></button>
            </div>
            <div className="options-row" style={{ borderTop: "1px solid var(--line-2)" }}>
              <div className="options-row__label">
                IP Preset
                <em>Brand IP applied to outputs</em>
              </div>
              <div className="dropdown">IP1 · HUDA {I.chevDown}</div>
            </div>
            <div className="options-row" style={{ borderTop: "1px solid var(--line-2)" }}>
              <div className="options-row__label">
                Output resolution
                <em>1024 · 1920 · 2560 px</em>
              </div>
              <div className="dropdown">1920 × 1080 {I.chevDown}</div>
            </div>
          </div>
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line-2)", display: "flex", gap: 10 }}>
            <button className="btn btn--secondary" style={{ flex: 1, justifyContent: "center" }}>Save preset</button>
            <button
              className="btn btn--primary"
              style={{ flex: 1.4, justifyContent: "center" }}
              disabled={selectedFiles.length === 0 || loading}
              onClick={runBatch}
            >
              {I.spark}<span>{loading ? "Starting..." : `Run batch (${selectedFiles.length})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Output column */}
      <div className="batch__col">
        <div className="batch__panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <header className="batch__panel-head">
            <span style={{ display: "inline-flex", color: "var(--st-approved)" }}>{I.layers}</span>
            <span className="batch__panel-title">Batch Output</span>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="chip chip--approved">{stats.completed} done</span>
              <span className="chip chip--generating">{stats.running} running</span>
              <span className="chip chip--failed">{stats.failed} failed</span>
            </div>
            <span style={{ flex: 1 }} />
            <span className="batch__panel-meta">{currentBatchId ? `BATCH · ${currentBatchId.slice(0, 12)}` : "MOCK · BATCH"}</span>
          </header>

          <div className="batch__panel-body" style={{ flex: 1, overflow: "auto" }}>
            <div className="batch-output-grid">
              {outputCells.map((c, i) => (
                <div key={c.id || i} className={`batch-out batch-out--${c.status}`}>
                  {c.status === "complete" ? (
                    <>
                      {c.fileUrl ? (
                        <img src={c.fileUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Placeholder tone={c.tone} label="" style={{ height: "100%", borderRadius: 0 }} />
                      )}
                      <div className="batch-out__status">
                        <span className="dot-status dot-status--approved" />Completed
                      </div>
                    </>
                  ) : c.status === "gen" ? (
                    <>
                      <div className="batch-out__gen"><div className="spinner" /></div>
                      <div className="batch-out__progress"><span style={{ width: c.pct + "%" }} /></div>
                      <div className="batch-out__status">
                        <span className="dot-status dot-status dot-status--generating" />Generating · {c.pct}%
                      </div>
                    </>
                  ) : (
                    <>
                      <Placeholder tone="rose" label="ERR" style={{ height: "100%", borderRadius: 0, filter: "grayscale(0.5)" }} />
                      <div className="batch-out__status">
                        <span className="dot-status dot-status--failed" />Failed · retry
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="batch__cta">
            {stats.failed > 0 && currentBatchId && (
              <button className="btn btn--secondary" onClick={handleRetryFailed}>
                {I.refresh}<span>Regenerate failed ({stats.failed})</span>
              </button>
            )}
            {stats.running > 0 && currentBatchId && (
              <button className="btn btn--ghost" onClick={handleCancelBatch} style={{ color: "var(--st-failed)" }}>
                {I.close}<span>Cancel running</span>
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn--secondary">{I.save}<span>Save all</span></button>
            <button className="btn btn--primary">{I.folder}<span>Export to project folder</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BatchMode = BatchMode;
