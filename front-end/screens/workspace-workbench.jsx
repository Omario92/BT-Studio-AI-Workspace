const resolveFileUrl = (url) => {
  if (!url) return '';
  if (url.includes('localhost:3001') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    const apiBaseUrl = (window.apiClient && window.apiClient.baseUrl) || 'https://bt-studio-ai-backend.up.railway.app';
    return url.replace(/http:\/\/localhost:3001/g, apiBaseUrl);
  }
  return url;
};

function ControlSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="slider-row">
      <div className="slider-row__head">
        {label}
        <span className="v">{value}{suffix}</span>
      </div>

      <div className="slider-track">
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="thumb" style={{ left: `${pct}%` }} />

        <input
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
    </div>
  );
}

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

function getAssetPreviewCandidate(asset) {
  return (
    asset?.previewUrl ||
    asset?.sourceFileUrl ||
    asset?.fileUrl ||
    asset?.thumbnailUrl ||
    asset?.metadata?.thumbnailSignedUrl ||
    asset?.metadata?.thumbnailUrl ||
    null
  );
}

function resolveAssetSourceRefs(asset, detailedAsset, versions) {
  const d = detailedAsset || {};
  const latestVersion =
    versions?.[0] ||
    d.latestVersion ||
    d.versions?.[0] ||
    asset.latestVersion ||
    asset.versions?.[0] ||
    null;

  const fileKey =
    d.metadata?.fileKey ||
    latestVersion?.params?.fileKey ||
    latestVersion?.metadata?.fileKey ||
    asset.metadata?.fileKey ||
    asset.fileKey ||
    null;

  const fileUrl =
    latestVersion?.fileUrl ||
    d.fileUrl ||
    asset.fileUrl ||
    asset.previewUrl ||
    asset.thumbnailUrl ||
    asset.metadata?.thumbnailSignedUrl ||
    asset.metadata?.thumbnailUrl ||
    null;

  return { fileKey, fileUrl, latestVersion };
}

async function hydrateWorkspaceSourceAsset(asset, projectId) {
  if (!asset?.id) return null;

  let detailed = null;
  let versions = [];

  try {
    if (window.assetsApi?.getAsset) {
      detailed = await window.assetsApi.getAsset(asset.id);
    }
  } catch (err) {
    console.warn("[SourcePicker] getAsset failed:", err);
  }

  try {
    if (window.assetsApi?.getAssetVersions) {
      versions = await window.assetsApi.getAssetVersions(asset.id);
    }
  } catch (err) {
    console.warn("[SourcePicker] getAssetVersions failed:", err);
  }

  const { fileKey, fileUrl, latestVersion } = resolveAssetSourceRefs(asset, detailed, versions);

  let signedUrl = null;
  if (fileKey && window.assetsApi?.getSignedUrl) {
    try {
      signedUrl = await window.assetsApi.getSignedUrl(fileKey);
    } catch (err) {
      console.warn("[SourcePicker] getSignedUrl failed:", err);
    }
  }

  const previewUrl = signedUrl || (fileUrl ? resolveFileUrl(fileUrl) : null) || (getAssetPreviewCandidate(asset) ? resolveFileUrl(getAssetPreviewCandidate(asset)) : null);
  const sourceFileUrl = signedUrl || (fileUrl ? resolveFileUrl(fileUrl) : null) || (getAssetPreviewCandidate(asset) ? resolveFileUrl(getAssetPreviewCandidate(asset)) : null);
  const finalFileUrl = fileUrl ? resolveFileUrl(fileUrl) : null;

  return {
    id: asset.id,
    name: detailed?.name || asset.name || "Untitled asset",
    mimeType: detailed?.mimeType || asset.mimeType || "image/png",
    fileKey,
    fileUrl: finalFileUrl,
    previewUrl,
    sourceFileUrl,
    projectId: detailed?.projectId || asset.projectId || projectId || null,
    currentVersion:
      detailed?.currentVersion ||
      latestVersion?.versionNumber ||
      asset.currentVersion ||
      1,
  };
}

function saveWorkspaceSourceContext(sourceAsset, {
  toolId = "upscaler",
  jobType = "IMAGE_UPSCALE",
  mode = "single",
} = {}) {
  if (!sourceAsset) return;

  const ctx = {
    version: "0.6",
    source: "workspace-picker",
    projectId: sourceAsset.projectId,
    toolId,
    jobType,
    mode,
    selectedAssetIds: [sourceAsset.id],
    assets: [sourceAsset],
  };

  localStorage.setItem("bt_selected_assets_for_ai", JSON.stringify(ctx));
}

function ProjectAssetPickerModal({
  open,
  onClose,
  onSelect,
  title = "Pick Source from Projects",
  accept = "image",
}) {
  const [projects, setProjects] = React.useState([]);
  const [activeProjectId, setActiveProjectId] = React.useState(null);
  const [assets, setAssets] = React.useState([]);
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const [loadingAssets, setLoadingAssets] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState(null);
  const [selectingId, setSelectingId] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingProjects(true);
    setError(null);

    window.projectsApi.listProjects()
      .then(({ data }) => {
        if (cancelled) return;
        const list = data || [];
        setProjects(list);

        const stored = localStorage.getItem("bt_active_proj");
        const found = list.find(p => p.id === stored);
        const first = found || list[0] || null;
        setActiveProjectId(first?.id || null);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || "Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });

    return () => { cancelled = true; };
  }, [open]);

  React.useEffect(() => {
    if (!open || !activeProjectId) return;

    let cancelled = false;
    setLoadingAssets(true);
    setError(null);

    window.projectsApi.getProjectAssets(activeProjectId, {
      search: search.trim() || undefined,
      type: accept === "image" ? "image" : undefined,
      limit: 100,
    })
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data || []).filter(asset => {
          if (accept === "image") {
            return (asset.mimeType || "").startsWith("image/");
          }
          return true;
        });
        setAssets(list);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || "Failed to load assets");
      })
      .finally(() => {
        if (!cancelled) setLoadingAssets(false);
      });

    return () => { cancelled = true; };
  }, [open, activeProjectId, search, accept]);

  if (!open) return null;

  const handleSelect = async (asset) => {
    setSelectingId(asset.id);
    setError(null);

    try {
      const source = await hydrateWorkspaceSourceAsset(asset, activeProjectId);

      if (!source) throw new Error("Could not resolve selected source asset");
      if (accept === "image" && !(source.mimeType || "").startsWith("image/")) {
        throw new Error("Only image assets are supported as source in V0.6");
      }

      onSelect(source);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to select source asset");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="source-picker" onClick={onClose}>
      <div className="source-picker__card" onClick={(e) => e.stopPropagation()}>
        <div className="source-picker__head">
          <div>
            <h3>{title}</h3>
            <p>Select an image asset from an existing project.</p>
          </div>
          <button className="icon-btn icon-btn--light" onClick={onClose}>×</button>
        </div>

        <div className="source-picker__toolbar">
          <select
            className="asset-filter-select"
            value={activeProjectId || ""}
            onChange={(e) => setActiveProjectId(e.target.value)}
            disabled={loadingProjects}
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search image assets..."
          />
        </div>

        {error && (
          <div className="source-picker__error">
            {error}
          </div>
        )}

        <div className="source-picker__body">
          {loadingAssets ? (
            <div className="source-picker__empty">Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="source-picker__empty">No image assets found in this project.</div>
          ) : (
            <div className="source-picker__grid">
              {assets.map(asset => {
                const thumb =
                  asset.localThumbnailUrl ||
                  asset.thumbnailUrl ||
                  asset.metadata?.thumbnailSignedUrl ||
                  asset.metadata?.thumbnailUrl ||
                  asset.fileUrl ||
                  "";

                return (
                  <button
                    key={asset.id}
                    className="source-picker__asset"
                    onClick={() => handleSelect(asset)}
                    disabled={selectingId === asset.id}
                  >
                    <div className="source-picker__thumb">
                      {thumb ? (
                        <img
                          src={resolveFileUrl(thumb)}
                          alt={asset.name}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Placeholder tone="violet" label="" style={{height:"100%", borderRadius: 0}} />
                      )}
                    </div>

                    <div className="source-picker__meta">
                      <strong title={asset.name}>{asset.name}</strong>
                      <small>
                        {asset.mimeType || "image"} · v{asset.currentVersion || 1}
                      </small>
                    </div>

                    {selectingId === asset.id && (
                      <span className="source-picker__selecting">Selecting…</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
      const first = ctx?.assets?.[0];
      if (!first) return null;
      // If a tool was specified, only accept upscaler context; otherwise pass through.
      if (ctx.toolId && ctx.toolId !== "upscaler" && ctx.jobType !== "IMAGE_UPSCALE") return null;
      return { ...first, projectId: ctx.projectId || first.projectId };
    } catch (e) { return null; }
  });

  const [sourcePreviewError, setSourcePreviewError] = React.useState(false);
  const [hasRehydrated, setHasRehydrated] = React.useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = React.useState(false);

  const [previewMode, setPreviewMode] = React.useState("compare"); // "compare" | "before" | "after"
  const [comparePct, setComparePct] = React.useState(50);
  const [isComparing, setIsComparing] = React.useState(false);

  const compareRef = React.useRef(null);

  const clampPercent = (value) => {
    return Math.max(0, Math.min(100, value));
  };

  const getPercentFromPointerEvent = (event, element) => {
    const rect = element.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    if (clientX == null) return 50;
    return clampPercent(((clientX - rect.left) / rect.width) * 100);
  };

  const updateCompareFromEvent = (event) => {
    if (!compareRef.current) return;
    const pct = getPercentFromPointerEvent(event, compareRef.current);
    setComparePct(pct);
  };

  const handleComparePointerDown = (event) => {
    event.preventDefault();
    setIsComparing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateCompareFromEvent(event);
  };

  const handleComparePointerMove = (event) => {
    if (!isComparing) return;
    updateCompareFromEvent(event);
  };

  const handleComparePointerUp = (event) => {
    setIsComparing(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCompareKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setComparePct(v => clampPercent(v - 2));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setComparePct(v => clampPercent(v + 2));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setComparePct(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setComparePct(100);
    }
  };

  const handlePickSource = (source) => {
    setSourceAsset(source);
    setSourcePreviewError(false);
    setOutputResult(null);
    setSubmitError(null);
    saveWorkspaceSourceContext(source, {
      toolId: "upscaler",
      jobType: "IMAGE_UPSCALE",
      mode: "single",
    });
    if (source.projectId) {
      localStorage.setItem("bt_active_proj", source.projectId);
    }
  };

  const getSourcePreviewUrl = (asset) => {
    const url = asset?.previewUrl || asset?.sourceFileUrl || asset?.fileUrl || asset?.thumbnailUrl || null;
    console.log("[Upscaler] source preview url", url);
    return url;
  };

  React.useEffect(() => {
    let active = true;
    const loadFullSourceAsset = async () => {
      if (!sourceAsset?.id) return;
      
      const missingUrls = !sourceAsset.previewUrl && !sourceAsset.sourceFileUrl && !sourceAsset.fileUrl;
      const needsRehydrate = missingUrls || (sourcePreviewError && !hasRehydrated);

      if (!needsRehydrate) return;

      try {
        console.log("[Upscaler] Lazy hydrating source asset:", sourceAsset.id);
        let assetDetail = {};
        let versions = [];

        if (typeof assetsApi !== "undefined" && assetsApi.getAsset) {
          assetDetail = await assetsApi.getAsset(sourceAsset.id);
        }
        if (typeof assetsApi !== "undefined" && assetsApi.getAssetVersions) {
          versions = await assetsApi.getAssetVersions(sourceAsset.id);
        }

        if (!active) return;

        const detailed = {
          ...assetDetail,
          versions,
          latestVersion: versions?.[0] || assetDetail?.versions?.[0] || null
        };

        const latestVersion = detailed.latestVersion;
        const fileKey =
          detailed.metadata?.fileKey ||
          latestVersion?.params?.fileKey ||
          latestVersion?.metadata?.fileKey ||
          sourceAsset.metadata?.fileKey ||
          sourceAsset.fileKey ||
          null;

        const fileUrl =
          latestVersion?.fileUrl ||
          detailed.fileUrl ||
          sourceAsset.fileUrl ||
          sourceAsset.previewUrl ||
          sourceAsset.thumbnailUrl ||
          sourceAsset.metadata?.thumbnailSignedUrl ||
          sourceAsset.metadata?.thumbnailUrl ||
          null;

        let signedUrl = null;
        if (fileKey && typeof assetsApi !== "undefined" && assetsApi.getSignedUrl) {
          try {
            signedUrl = await assetsApi.getSignedUrl(fileKey);
          } catch (e) {
            console.warn("[Upscaler] Failed to get signed URL during hydration:", e);
          }
        }

        const previewUrl = signedUrl || resolveFileUrl(fileUrl) || null;
        const sourceFileUrl = signedUrl || resolveFileUrl(fileUrl) || null;
        const finalFileUrl = resolveFileUrl(fileUrl) || null;
        const currentVersion = latestVersion?.versionNumber || latestVersion?.version || detailed?.currentVersion || sourceAsset.currentVersion || 1;

        const updatedAsset = {
          ...sourceAsset,
          fileKey,
          fileUrl: finalFileUrl,
          previewUrl,
          sourceFileUrl,
          currentVersion
        };

        if (active) {
          setSourceAsset(updatedAsset);
          if (sourcePreviewError) {
            setSourcePreviewError(false);
            setHasRehydrated(true);
          }

          // update localStorage
          try {
            const raw = localStorage.getItem("bt_selected_assets_for_ai");
            if (raw) {
              const ctx = JSON.parse(raw);
              if (ctx?.assets?.[0]?.id === sourceAsset.id) {
                ctx.assets[0] = updatedAsset;
                localStorage.setItem("bt_selected_assets_for_ai", JSON.stringify(ctx));
              }
            }
          } catch (e) {
            console.warn("[Upscaler] Failed to update localStorage context:", e);
          }
        }
      } catch (err) {
        console.warn("[Upscaler] Hydration failed:", err);
      }
    };

    loadFullSourceAsset();

    return () => {
      active = false;
    };
  }, [sourceAsset?.id, sourcePreviewError, hasRehydrated]);

  const [currentJob, setCurrentJob] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const [outputResult, setOutputResult] = React.useState(null); // { fileUrl, assetId, assetVersionId, provider, mockFallback, displayUrl }
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
                  {(getSourcePreviewUrl(sourceAsset) && !sourcePreviewError) ? (
                    <img src={getSourcePreviewUrl(sourceAsset)} alt={sourceAsset.name || "Source Asset"} style={{width: "100%", height: "100%", objectFit: "cover"}} onError={() => setSourcePreviewError(true)} />
                  ) : (
                    <Placeholder tone="violet" label={sourceAsset ? "NO PREVIEW" : ""} style={{height:"100%", borderRadius: 0}} />
                  )}
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 11, color:"#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap"}} title={sourceAsset?.name || "No source"}>
                    {sourceAsset?.name || "No source selected"}
                  </div>
                  <div style={{fontFamily:"var(--f-mono)", fontSize: 10, color:"var(--ink-on-dark-3)", marginTop: 2}}>
                    {sourceAsset ? `${sourceAsset.mimeType || "image/png"} · v${sourceAsset.currentVersion ?? 1}` : "Pick from Projects → Use with AI"}
                  </div>
                </div>
                {sourceAsset && (
                  <button className="icon-btn" onClick={clearSource} title="Clear source">{I.x}</button>
                )}
              </div>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => setSourcePickerOpen(true)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  justifyContent: "center",
                  background: "var(--bg-input-dark)",
                  color: "var(--ink-on-dark)",
                  borderColor: "var(--line-on-dark-2)"
                }}
              >
                {I.folder}<span>{sourceAsset ? "Change Source" : "Pick Source from Projects"}</span>
              </button>
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

            <ControlSlider
              label="Detail enhancement"
              value={detail}
              onChange={setDetail}
            />

            <ControlSlider
              label="Denoise"
              value={denoise}
              onChange={setDenoise}
            />

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
            <button
              className="btn btn--secondary"
              style={{flex:1, justifyContent:"center", background:"var(--bg-input-dark)", color:"var(--ink-on-dark)", borderColor:"var(--line-on-dark-2)"}}
              disabled={isGenerating}
              onClick={() => { setFactor("4x"); setFace(true); setDetail(72); setDenoise(45); }}>Reset</button>
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
              <button type="button" className={previewMode === "compare" ? "active" : ""} onClick={() => setPreviewMode("compare")}>Compare</button>
              <button type="button" className={previewMode === "before" ? "active" : ""} onClick={() => setPreviewMode("before")}>Before</button>
              <button type="button" className={previewMode === "after" ? "active" : ""} onClick={() => setPreviewMode("after")}>After</button>
            </div>
          </header>
          <div className="up-canvas__stage">
            <div
              ref={compareRef}
              className={`compare compare--${previewMode}`}
              onPointerDown={previewMode === "compare" ? handleComparePointerDown : undefined}
              onPointerMove={previewMode === "compare" ? handleComparePointerMove : undefined}
              onPointerUp={previewMode === "compare" ? handleComparePointerUp : undefined}
              onPointerCancel={previewMode === "compare" ? handleComparePointerUp : undefined}
            >
              <div className="compare__layer compare__layer--before">
                {(getSourcePreviewUrl(sourceAsset) && !sourcePreviewError) ? (
                  <img src={getSourcePreviewUrl(sourceAsset)} alt={sourceAsset.name || "Source Asset"} style={{width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none"}} draggable={false} onError={() => setSourcePreviewError(true)} />
                ) : (
                  <Placeholder tone="violet" label={sourceAsset ? "NO PREVIEW" : ""} />
                )}
                <span className="compare__tag compare__tag--before">BEFORE · {sourceAsset?.name || "no source"}</span>
              </div>

              <div
                className="compare__layer compare__layer--after"
                style={{
                  clipPath: previewMode === "compare"
                    ? `inset(0 ${100 - comparePct}% 0 0)`
                    : "none",
                  opacity: previewMode === "before" ? 0 : 1
                }}
              >
                {outputResult?.displayUrl ? (
                  <img src={outputResult.displayUrl} alt="Upscaled output" style={{width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none"}} draggable={false} />
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
                <span className="compare__tag compare__tag--after">AFTER · {factor === "2x" ? "2048" : factor === "4x" ? "4096" : "8192"}px</span>
              </div>

              {previewMode === "compare" && (
                <button
                  type="button"
                  className="compare__handle"
                  style={{ left: `${comparePct}%` }}
                  aria-label="Before after comparison slider"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(comparePct)}
                  role="slider"
                  tabIndex={0}
                  onKeyDown={handleCompareKeyDown}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsComparing(true);
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!isComparing) return;
                    e.stopPropagation();
                    updateCompareFromEvent(e);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setIsComparing(false);
                    e.currentTarget.releasePointerCapture?.(e.pointerId);
                  }}
                />
              )}
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
              {submitError && <span style={{color: "var(--st-failed)"}}>⚠ {submitError}</span>}
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

      <ProjectAssetPickerModal
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        onSelect={handlePickSource}
        title="Pick Source for Upscaler"
        accept="image"
      />
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

  const [sourcePickerOpen, setSourcePickerOpen] = React.useState(false);

  const handlePickEditSource = (source) => {
    const editSource = {
      ...source,
      previewUrl: source.previewUrl || source.sourceFileUrl || source.fileUrl,
      assetName: source.name,
    };

    setEditAsset(editSource);

    localStorage.setItem("bt_edit_asset", JSON.stringify(editSource));
    saveWorkspaceSourceContext(source, {
      toolId: "editor",
      jobType: "IMAGE_EDIT",
      mode: "single",
    });
  };

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
              <button
                className="btn btn--secondary"
                type="button"
                onClick={() => setSourcePickerOpen(true)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  justifyContent: "center",
                  background: "var(--bg-input-dark)",
                  color: "var(--ink-on-dark)",
                  borderColor: "var(--line-on-dark-2)"
                }}
              >
                {I.folder}<span>{editAsset ? "Change Source" : "Pick Source from Projects"}</span>
              </button>
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

      <ProjectAssetPickerModal
        open={sourcePickerOpen}
        onClose={() => setSourcePickerOpen(false)}
        onSelect={handlePickEditSource}
        title="Pick Source for Editor"
        accept="image"
      />
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
window.ProjectAssetPickerModal = ProjectAssetPickerModal;
