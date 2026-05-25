const STATUS = {
  DRAFT:      ["chip chip--draft",     "Draft"],
  WIP:        ["chip chip--wip",       "WIP"],
  APPROVED:   ["chip chip--approved",  "Approved"],
  REJECTED:   ["chip chip--failed",    "Rejected"],
  REVISION_REQUESTED: ["chip chip--failed", "Revision Req."],
  GENERATING: ["chip chip--generating","Generating"],
  // Backwards compatibility for static mock data
  draft:      ["chip chip--draft",     "Draft"],
  wip:        ["chip chip--wip",       "WIP"],
  approved:   ["chip chip--approved",  "Approved"],
  failed:     ["chip chip--failed",    "Failed"],
  generating: ["chip chip--generating","Generating"],
};

function ProjectMgmt() {
  const [projects, setProjects] = React.useState([]);
  const [currentProject, setCurrentProject] = React.useState(null);
  const [folders, setFolders] = React.useState([]);
  const [activeFolderId, setActiveFolderId] = React.useState(null);
  const [assets, setAssets] = React.useState([]);
  const [view, setView] = React.useState("grid");
  const [loading, setLoading] = React.useState(true);
  const [offline, setOffline] = React.useState(false);
  const [treeCollapsed, setTreeCollapsed] = React.useState(() => {
    try { return localStorage.getItem("bt_pm_tree") === "1"; } catch (e) { return false; }
  });
  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  // New folder modal
  const [folderModalOpen, setFolderModalOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [folderCreating, setFolderCreating] = React.useState(false);
  const [folderError, setFolderError] = React.useState(null);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleOpenFolderModal = () => {
    if (!currentProject) return;
    setNewFolderName('');
    setFolderError(null);
    setFolderModalOpen(true);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { setFolderError('Folder name is required'); return; }
    if (!currentProject) return;

    setFolderCreating(true);
    setFolderError(null);
    try {
      const { data: newFolder } = await projectsApi.createFolder(currentProject.id, {
        name,
        parentId: activeFolderId || undefined,
      });
      setFolders((prev) => [...prev, newFolder]);
      setActiveFolderId(newFolder.id);
      setFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      setFolderError(err?.response?.data?.error?.message || err?.message || 'Failed to create folder');
    } finally {
      setFolderCreating(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const newAsset = await assetsApi.uploadAsset(currentProject.id, activeFolderId, file, (pct) => {
        setUploadProgress(pct);
      });
      setAssets((prev) => [newAsset, ...prev]);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = "";
    }
  };

  React.useEffect(() => {
    try { localStorage.setItem("bt_pm_tree", treeCollapsed ? "1" : "0"); } catch (e) {}
  }, [treeCollapsed]);

  // 1. Fetch projects on mount
  React.useEffect(() => {
    setLoading(true);
    projectsApi.listProjects()
      .then(({ data, fromCache }) => {
        setOffline(fromCache);
        setProjects(data);
        if (data.length > 0) {
          // Attempt to restore stored active project or default to first
          const storedProjId = localStorage.getItem("bt_active_proj");
          const found = data.find(p => p.id === storedProjId);
          setCurrentProject(found || data[0]);
        }
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, []);

  // 2. Fetch project details & folders when active project changes
  React.useEffect(() => {
    if (!currentProject) return;
    try { localStorage.setItem("bt_active_proj", currentProject.id); } catch (e) {}
    
    setLoading(true);
    Promise.all([
      projectsApi.getProject(currentProject.id),
      projectsApi.getProjectFolders(currentProject.id)
    ])
      .then(([projRes, foldRes]) => {
        setOffline(projRes.fromCache || foldRes.fromCache);
        setFolders(foldRes.data);
        
        // Find 'Generated' folder, or default to first folder, or null
        const genFolder = foldRes.data.find(f => f.name === "Generated" || f.name === "gen");
        const defaultFolder = genFolder || foldRes.data[0] || null;
        
        if (defaultFolder) {
          setActiveFolderId(defaultFolder.id);
        } else {
          setActiveFolderId(null);
        }
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, [currentProject]);

  // 3. Fetch assets whenever active folder changes
  React.useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    projectsApi.getProjectAssets(currentProject.id, { folderId: activeFolderId })
      .then(({ data, fromCache }) => {
        setOffline(fromCache);
        setAssets(data);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, [currentProject, activeFolderId]);

  // Build the unified sidebar tree list dynamically
  const dynamicTree = React.useMemo(() => {
    const list = [];
    projects.forEach(p => {
      const isActiveProject = currentProject && p.id === currentProject.id;
      list.push({
        id: p.id,
        label: p.name,
        open: isActiveProject,
        depth: 0,
        icon: I.folder,
        count: p._count?.assets ?? 0,
        type: 'project',
      });
      
      if (isActiveProject) {
        folders.forEach(f => {
          list.push({
            id: f.id,
            label: f.name,
            depth: 1,
            icon: I.folder,
            count: f._count?.assets ?? 0,
            active: activeFolderId === f.id,
            type: 'folder',
          });
        });
      }
    });
    return list;
  }, [projects, currentProject, folders, activeFolderId]);

  const handleTreeClick = (node) => {
    if (node.type === 'project') {
      const found = projects.find(p => p.id === node.id);
      if (found) setCurrentProject(found);
    } else if (node.type === 'folder') {
      setActiveFolderId(node.id);
    }
  };

  const activeFolderName = React.useMemo(() => {
    const activeFold = folders.find(f => f.id === activeFolderId);
    return activeFold ? activeFold.name.toUpperCase() : "ROOT";
  }, [folders, activeFolderId]);

  if (!currentProject && loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)" }}>
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>LOADING PROJECTS...</div>
      </div>
    );
  }

  const projName = currentProject?.name ?? "No Project Selected";
  const projClient = currentProject?.client ?? "N/A";
  const projStatus = currentProject?.status ?? "DRAFT";
  const projProgress = currentProject?.progress ?? 0;
  const projectMembers = currentProject?.members ?? [];

  return (
    <div className={`pm ${treeCollapsed ? "pm--collapsed" : ""}`}>
      {treeCollapsed ? (
        <button
          className="pm__reopen"
          onClick={() => setTreeCollapsed(false)}
          title="Show file tree"
          aria-label="Show file tree">
          {I.panelLeft}
        </button>
      ) : null}
      <aside className="pm__tree">
        <div className="tree__header">
          <h3>Project Files</h3>
          <button className="icon-btn icon-btn--light" title="New folder" onClick={handleOpenFolderModal}>{I.plus}</button>
          <button
            className="icon-btn icon-btn--light"
            title="Hide file tree"
            onClick={() => setTreeCollapsed(true)}>{I.panelLeft}</button>
        </div>

        {dynamicTree.map((node, i) => (
          <button
            key={node.id + "_" + i}
            className={`tree__row ${node.active || (node.type === 'project' && currentProject && node.id === currentProject.id && !activeFolderId) ? "active" : ""}`}
            style={{paddingLeft: 18 + node.depth * 16, fontWeight: node.depth === 0 ? "600" : "400"}}
            onClick={() => handleTreeClick(node)}>
            <span className="tree__caret">
              {node.type === 'project' ? (node.open ? I.chevDownTiny : I.chevRightTiny) : null}
            </span>
            <span style={{color: node.type === 'project' ? "var(--accent)" : "var(--ink-3)", display: "inline-flex"}}>{node.icon}</span>
            <span style={{flex:1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{node.label}</span>
            {node.count ? <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--ink-4)"}}>{node.count}</span> : null}
          </button>
        ))}
      </aside>

      <div className="pm__main">
        {offline && (
          <div style={{ background: "var(--amber, #f59e0b)", color: "#000", padding: "6px 12px", borderRadius: 6, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡</span> Showing mock data — backend offline
          </div>
        )}

        {uploading && (
          <div style={{ background: "var(--accent-tint)", color: "var(--accent)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
              <span className="dot-status dot-status--generating" style={{ width: 10, height: 10, display: "inline-block" }} />
              Uploading file... <strong>{uploadProgress}%</strong>
            </div>
            <div style={{ flex: 1, height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${uploadProgress}%`, height: "100%", background: "var(--accent)", transition: "width 100ms ease" }} />
            </div>
          </div>
        )}

        <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:6}}>
          <div>
            <div className="crumbs">PROJECTS / <strong>{projName.toUpperCase()}</strong> / {activeFolderName}</div>
            <h1 className="page-title" style={{marginTop:4}}>{projName}</h1>
          </div>
          <div style={{flex:1}} />
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button className="btn btn--secondary" onClick={handleUploadClick} disabled={uploading}>
            {I.upload}<span>Upload</span>
          </button>
          <button className="btn btn--secondary">{I.filter}<span>Filter</span></button>
          <button className="btn btn--primary">{I.spark}<span>Open in AI Workspace</span></button>
        </div>
        <p className="page-sub">{assets.length} generated files · {loading ? "loading updates..." : "synced with database"}</p>

        {/* Project info card */}
        <div className="project-card-info">
          <div className="info-cell">
            <div className="k">Project Name</div>
            <div className="v">{projName}</div>
          </div>
          <div className="info-cell">
            <div className="k">Client / Brand</div>
            <div className="v">{projClient}</div>
          </div>
          <div className="info-cell">
            <div className="k">Deadline</div>
            <div className="v">Oct 25, 2026 <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--st-wip)", marginLeft:8}}>· active</span></div>
          </div>
          <div className="info-cell">
            <div className="k">Status</div>
            <div className="v">
              <span className={STATUS[projStatus]?.[0] ?? "chip chip--wip"}>
                <span className="dot-status dot-status--wip"/>
                {STATUS[projStatus]?.[1] ?? projStatus}
              </span>
            </div>
          </div>

          <div className="info-cell info-cell--full" style={{display:"flex", alignItems:"center", gap:32, paddingTop:18, borderTop:"1px solid var(--line-2)"}}>
            <div>
              <div className="k">Assigned Team</div>
              <div style={{display:"flex", alignItems:"center", gap:8, marginTop:8}}>
                <div className="avatar-stack">
                  {projectMembers.slice(0, 5).map((m, idx) => (
                    <div key={idx} className={`avatar avatar--${"abcdef"[idx%6]} sm`}>
                      {(m.user?.name || "??").split(" ").map(s => s[0]).join("").slice(0, 2)}
                    </div>
                  ))}
                  {projectMembers.length === 0 && (
                    <>
                      <div className="avatar avatar--a sm">AC</div>
                      <div className="avatar avatar--b sm">DK</div>
                      <div className="avatar avatar--c sm">SM</div>
                    </>
                  )}
                </div>
                <span style={{fontSize:12, color:"var(--ink-3)", marginLeft:6}}>
                  {projectMembers.length > 0 
                    ? projectMembers.map(m => m.user?.name).join(", ") 
                    : "Alice Chen, David Kim, Sarah M."}
                </span>
              </div>
            </div>
            <div style={{marginLeft:"auto", display:"flex", gap:28}}>
              <div className="info-cell">
                <div className="k">Files</div>
                <div className="v tabular">{assets.length}</div>
              </div>
              <div className="info-cell">
                <div className="k">Approval Rate</div>
                <div className="v tabular">
                  {assets.length > 0 
                    ? Math.round((assets.filter(a => a.status === "APPROVED").length / assets.length) * 100) + "%"
                    : "0%"}
                </div>
              </div>
              <div className="info-cell">
                <div className="k">Last Edit</div>
                <div className="v">Just now</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-title" style={{marginTop:0}}>
          <h2>Generated Files</h2>
          <span className="count">{assets.length} TOTAL</span>
          <span className="spacer" />
          <div className="segmented">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
            <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>Compare</button>
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="card card--pad" style={{padding: 48, textAlign: "center", color:"var(--ink-3)"}}>
            <div style={{fontSize: 32, marginBottom: 12}}>{I.folder}</div>
            <h3 style={{margin: "0 0 6px"}}>No assets found</h3>
            <p style={{margin: 0, color: "var(--ink-4)"}}>Generate new frames in the AI Workspace or upload assets to begin.</p>
          </div>
        ) : view === "grid" ? (
          <div className="asset-grid">
            {assets.map((a, i) => {
              const statusKey = a.status || "DRAFT";
              const [cls, label] = STATUS[statusKey] ?? ["chip chip--draft", "Draft"];
              const commentsCount = a._count?.comments ?? a.comments ?? 0;
              const versionNumber = a.currentVersion ?? a.v ?? 1;
              const creatorName = a.creator?.name ?? "System";
              const creatorInitials = creatorName.split(" ").map(s => s[0]).join("").slice(0,2);
              return (
                <div className="asset-card" key={a.id || i}>
                  <div className="asset-card__thumb">
                    {a.fileUrl ? (
                      <img src={a.fileUrl} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Placeholder tone={toneSet[i % toneSet.length]} label={a.name.split("_")[0]} style={{height:"100%", borderRadius:0}} />
                    )}
                  </div>
                  <div className="asset-card__body">
                    <div className="asset-card__title-row">
                      <span className="asset-card__name" title={a.name}>{a.name}</span>
                      <span className="chip chip--version">v{versionNumber}</span>
                    </div>
                    <div className="asset-card__meta-row">
                      <span className="asset-card__meta">{I.comment}<span>{commentsCount}</span></span>
                      <span className={cls}>{label}</span>
                    </div>
                    <div className="asset-card__meta-row">
                      <div className="avatar-stack">
                        <div className={`avatar avatar--${"abcdef"[i%6]} sm`}>{creatorInitials}</div>
                      </div>
                      <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--ink-4)"}}>synced</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "list" ? (
          <AssetList assets={assets} />
        ) : (
          <AssetCompare assets={assets} />
        )}
      </div>

      {/* ── New Folder Modal ── */}
      {folderModalOpen && (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => setFolderModalOpen(false)}>
        <div
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '28px 28px 24px', width: 360,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}
          onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: 0, fontSize: 15 }}>New Folder</h3>
          <input
            autoFocus
            type="text"
            className="input"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setFolderModalOpen(false); }}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          {folderError && (
            <div style={{ fontSize: 12, color: 'var(--st-rejected, #f87171)' }}>{folderError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost" onClick={() => setFolderModalOpen(false)} disabled={folderCreating}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={handleCreateFolder} disabled={folderCreating || !newFolderName.trim()}>
              {folderCreating ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

const SIZES = ["1.2 MB", "3.8 MB", "5.1 MB", "820 KB", "2.4 MB", "7.2 MB", "4.6 MB", "1.9 MB"];
const RES   = ["2048×2048", "1920×1080", "4096×4096", "1024×1024", "1080×1920", "3840×2160"];

function AssetList({ assets }) {
  return (
    <div className="asset-table">
      <div className="asset-table__head">
        <span>Preview</span>
        <span>File name</span>
        <span>Version</span>
        <span>Status</span>
        <span>Size</span>
        <span>Resolution</span>
        <span className="col-modified">Last modified</span>
        <span></span>
      </div>
      {assets.map((a, i) => {
        const statusKey = a.status || "DRAFT";
        const [cls, label] = STATUS[statusKey] ?? ["chip chip--draft", "Draft"];
        const commentsCount = a._count?.comments ?? a.comments ?? 0;
        const versionNumber = a.currentVersion ?? a.v ?? 1;
        const creatorName = a.creator?.name ?? "System";
        const creatorInitials = creatorName.split(" ").map(s => s[0]).join("").slice(0,2);
        return (
          <div className="asset-table__row" key={a.id || i}>
            <div className="asset-table__thumb">
              {a.fileUrl ? (
                <img src={a.fileUrl} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Placeholder tone={toneSet[i % toneSet.length]} label="" style={{height:"100%", borderRadius: 0}} />
              )}
            </div>
            <div style={{display:"flex", flexDirection:"column", gap: 2, minWidth: 0}}>
              <span className="asset-table__name" title={a.name}>{a.name}</span>
              <span className="asset-table__meta">{I.comment}<span style={{marginLeft:4}}>{commentsCount}</span> · synced</span>
            </div>
            <span><span className="chip chip--version">v{versionNumber}</span></span>
            <span><span className={cls}>{label}</span></span>
            <span className="asset-table__size">{SIZES[i % SIZES.length]}</span>
            <span className="asset-table__size">{RES[i % RES.length]}</span>
            <span className="asset-table__date col-modified" style={{display:"flex", alignItems:"center", gap: 8}}>
              <span className={`avatar avatar--${"abcdef"[i%6]} sm`}>{creatorInitials}</span>
              <span>Just now</span>
            </span>
            <button className="icon-btn icon-btn--light" onClick={e => e.stopPropagation()}>{I.more}</button>
          </div>
        );
      })}
    </div>
  );
}

function AssetCompare({ assets }) {
  const [left, setLeft]   = React.useState(0);
  const [right, setRight] = React.useState(Math.min(assets.length - 1, 1));
  
  // Safe bounds guard
  React.useEffect(() => {
    if (left >= assets.length) setLeft(0);
    if (right >= assets.length) setRight(Math.min(assets.length - 1, 1));
  }, [assets]);

  const A = assets[left] || assets[0], B = assets[right] || assets[1] || assets[0];

  if (!A) return null;

  const renderCol = (asset, side, idx) => {
    const statusKey = asset.status || "DRAFT";
    const [cls, label] = STATUS[statusKey] ?? ["chip chip--draft", "Draft"];
    const versionNumber = asset.currentVersion ?? asset.v ?? 1;
    const commentsCount = asset._count?.comments ?? asset.comments ?? 0;
    const creatorName = asset.creator?.name ?? "System";
    return (
      <div className="asset-compare__col">
        <div className="asset-compare__col-head">
          <span style={{fontFamily:"var(--f-mono)", fontSize: 10.5, letterSpacing:"0.12em", color:"var(--ink-4)"}}>{side}</span>
          <span style={{fontFamily:"var(--f-mono)", fontSize: 12.5, color:"var(--ink)", flex: 1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{asset.name}</span>
          <span className="chip chip--version">v{versionNumber}</span>
          <span className={cls}>{label}</span>
        </div>
        <div className="asset-compare__art">
          {asset.fileUrl ? (
            <img src={asset.fileUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <Placeholder tone={toneSet[idx % toneSet.length]} label={asset.name.split("_")[0]} style={{height:"100%", borderRadius: 0}} />
          )}
        </div>
        <dl className="asset-compare__meta">
          <dt>Resolution</dt><dd>{RES[idx % RES.length]}</dd>
          <dt>Size</dt><dd>{SIZES[idx % SIZES.length]}</dd>
          <dt>Comments</dt><dd>{commentsCount}</dd>
          <dt>Creator</dt><dd>{creatorName}</dd>
        </dl>
      </div>
    );
  };

  return (
    <div className="asset-compare">
      <div className="asset-compare__head">
        <span style={{fontFamily:"var(--f-mono)", fontSize: 11, letterSpacing:"0.10em", color:"var(--ink-4)"}}>SIDE-BY-SIDE COMPARE</span>
        <span style={{flex: 1}}/>
        <button className="btn btn--ghost" onClick={() => { const t = left; setLeft(right); setRight(t); }}>{I.refresh}<span>Swap</span></button>
        <button className="btn btn--secondary">{I.download}<span>Download both</span></button>
        <button className="btn btn--primary">{I.spark}<span>Open in Workspace</span></button>
      </div>

      <div className="asset-compare__cols">
        {renderCol(A, "Left", left)}
        {B && renderCol(B, "Right", right)}
      </div>

      <div style={{
        marginTop: 16,
        fontFamily:"var(--f-mono)", fontSize: 10.5,
        letterSpacing:"0.10em", color:"var(--ink-4)", textTransform:"uppercase"
      }}>Pick from set · Left</div>
      <div className="asset-compare__filmstrip">
        {assets.map((a, i) => (
          <div key={i}
            className={`asset-compare__filmstrip-item ${left === i ? "active" : ""}`}
            onClick={() => setLeft(i)}>
            <Placeholder tone={toneSet[i % toneSet.length]} label="" style={{height:"100%", borderRadius: 0}} />
            <span className="badge-mini">v{a.currentVersion ?? a.v ?? 1}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10,
        fontFamily:"var(--f-mono)", fontSize: 10.5,
        letterSpacing:"0.10em", color:"var(--ink-4)", textTransform:"uppercase"
      }}>Pick from set · Right</div>
      <div className="asset-compare__filmstrip">
        {assets.map((a, i) => (
          <div key={i}
            className={`asset-compare__filmstrip-item ${right === i ? "active" : ""}`}
            onClick={() => setRight(i)}>
            <Placeholder tone={toneSet[i % toneSet.length]} label="" style={{height:"100%", borderRadius: 0}} />
            <span className="badge-mini">v{a.currentVersion ?? a.v ?? 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ProjectMgmt = ProjectMgmt;
window.AssetList = AssetList;
window.AssetCompare = AssetCompare;