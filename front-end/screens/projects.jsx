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

const resolveFileUrl = (url) => {
  if (!url) return '';
  if (url.includes('localhost:3001') && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    const apiBaseUrl = (window.apiClient && window.apiClient.baseUrl) || 'https://bt-studio-ai-backend.up.railway.app';
    return url.replace(/http:\/\/localhost:3001/g, apiBaseUrl);
  }
  return url;
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

  // Object URL cache to prevent memory leaks
  const objectUrlsRef = React.useRef([]);

  // New folder modal
  const [folderModalOpen, setFolderModalOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [folderCreating, setFolderCreating] = React.useState(false);
  const [folderError, setFolderError] = React.useState(null);

  // Asset preview / review modal
  const [previewAsset, setPreviewAsset] = React.useState(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewError, setReviewError] = React.useState(null);
  const [reviewComment, setReviewComment] = React.useState('');
  const [addingComment, setAddingComment] = React.useState(false);

  // Signed full preview states
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState(null);

  // Filter and Sorting states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [filterType, setFilterType] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('updatedAt');
  const [sortOrder, setSortOrder] = React.useState('desc');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    return () => {
      // Clean up object URLs on unmount
      objectUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
    };
  }, []);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleOpenFolderModal = () => {
    if (!currentProject) return;
    console.log("[ProjectFiles] New folder clicked");
    setNewFolderName('');
    setFolderError(null);
    setFolderModalOpen(true);
  };

  const hydrateAssetThumbnails = React.useCallback(async (assetsList) => {
    if (!assetsList || assetsList.length === 0) return;

    assetsList.forEach(async (asset) => {
      const thumbFileKey = asset.metadata?.thumbnailFileKey;
      if (thumbFileKey && !asset.metadata?.thumbnailSignedUrl) {
        try {
          const signedUrl = await assetsApi.getSignedUrl(thumbFileKey);
          console.log("[Thumbnail] hydrated", asset.id, signedUrl);
          setAssets((prev) =>
            prev.map((a) =>
              a.id === asset.id
                ? {
                    ...a,
                    metadata: {
                      ...a.metadata,
                      thumbnailSignedUrl: signedUrl,
                    },
                  }
                : a
            )
          );
        } catch (err) {
          console.warn(`[hydrateAssetThumbnails] Failed to hydrate signed URL for asset ${asset.id}:`, err);
        }
      }
    });
  }, []);

  const refreshAssetGrid = React.useCallback(async () => {
    if (!currentProject) return;
    try {
      const statusParam = filterStatus === 'all' ? undefined : filterStatus;
      const typeParam = filterType === 'all' ? undefined : filterType;
      const { data } = await projectsApi.getProjectAssets(currentProject.id, {
        folderId: activeFolderId,
        status: statusParam,
        search: debouncedSearch || undefined,
        type: typeParam,
        sortBy,
        sortOrder,
      });
      setAssets(data);
      hydrateAssetThumbnails(data);
    } catch (e) { console.warn('[refreshAssetGrid] failed:', e); }
  }, [currentProject, activeFolderId, filterStatus, filterType, debouncedSearch, sortBy, sortOrder, hydrateAssetThumbnails]);

  const reloadAssetDetail = async (assetId) => {
    const [fullAsset, versions, reviews, comments] = await Promise.all([
      assetsApi.getAsset(assetId),
      assetsApi.getAssetVersions(assetId),
      assetsApi.getAssetReviews(assetId),
      assetsApi.getAssetComments(assetId),
    ]);
    return {
      ...(fullAsset || {}),
      versions: versions ?? [],
      reviews: reviews ?? [],
      comments: comments ?? [],
      latestVersion: (versions && versions[0]) || null,
    };
  };

  const handleOpenAsset = async (asset) => {
    if (asset.isUploading || (asset.id && asset.id.toString().startsWith('optimistic_'))) {
      console.log("[AssetGrid] Cannot open optimistic asset, upload in progress");
      return;
    }
    console.log("[AssetGrid] Open asset", asset.id);
    setReviewError(null);
    setReviewComment('');
    setPreviewAsset(asset); // show modal immediately with shallow data
    setReviewLoading(true);
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewError(null);
    try {
      const detailed = await reloadAssetDetail(asset.id);
      setPreviewAsset(detailed);

      const fileKey =
        detailed.metadata?.fileKey ||
        detailed.latestVersion?.params?.fileKey ||
        detailed.versions?.[0]?.params?.fileKey ||
        detailed.versions?.[0]?.metadata?.fileKey ||
        asset.metadata?.fileKey ||
        null;

      console.log("[AssetPreview] fileKey", fileKey);

      if (fileKey) {
        try {
          const signedUrl = await assetsApi.getSignedUrl(fileKey);
          console.log("[AssetPreview] signedUrl", signedUrl);
          if (!signedUrl) {
            setPreviewError("Could not generate preview URL for this asset.");
          } else {
            setPreviewUrl(signedUrl);
          }
        } catch (signedErr) {
          console.warn('[handleOpenAsset] Failed to load signed URL:', signedErr);
          const fallback = resolveFileUrl(detailed.fileUrl || asset.fileUrl);
          if (fallback) {
            setPreviewUrl(fallback);
          } else {
            setPreviewError("Could not generate preview URL for this asset.");
          }
        }
      } else if (detailed.fileUrl || asset.fileUrl) {
        const urlToUse = detailed.fileUrl || asset.fileUrl;
        console.log("[AssetPreview] No fileKey, falling back to fileUrl:", urlToUse);
        setPreviewUrl(resolveFileUrl(urlToUse));
      } else {
        setPreviewError("No fileKey or fileUrl found for preview.");
      }
    } catch (err) {
      setReviewError(err?.message || 'Failed to load asset details');
    } finally {
      setReviewLoading(false);
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (reviewBusy || addingComment) return;
    setPreviewAsset(null);
    setReviewError(null);
    setReviewComment('');
    setPreviewUrl(null);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  const handleAddComment = async () => {
    if (!previewAsset || !reviewComment.trim()) return;
    setAddingComment(true);
    setReviewError(null);
    try {
      await assetsApi.addComment(previewAsset.id, reviewComment.trim());
      setReviewComment('');
      const detailed = await reloadAssetDetail(previewAsset.id);
      setPreviewAsset(detailed);
    } catch (err) {
      setReviewError(err?.message || 'Add comment failed');
    } finally {
      setAddingComment(false);
    }
  };

  const handleReviewAction = async (action) => {
    if (!previewAsset) return;
    const versionId = previewAsset.latestVersion?.id;
    if (!versionId) { setReviewError('No asset version available'); return; }

    let comment = '';
    if (action === 'reject' || action === 'request-revision') {
      const prompt = action === 'reject' ? 'Reason for rejection?' : 'What revisions are needed?';
      comment = (window.prompt(prompt) ?? '').trim();
      if (!comment) return; // user cancelled
    }

    setReviewBusy(true);
    setReviewError(null);
    try {
      if (action === 'approve')               await assetsApi.approveVersion(versionId, comment);
      else if (action === 'reject')           await assetsApi.rejectVersion(versionId, comment);
      else if (action === 'request-revision') await assetsApi.requestRevision(versionId, comment);

      const detailed = await reloadAssetDetail(previewAsset.id);
      setPreviewAsset(detailed);
      refreshAssetGrid();
    } catch (err) {
      setReviewError(err?.message || 'Review action failed');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!previewAsset) return;
    if (!window.confirm("Are you sure you want to permanently delete this asset?")) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      await assetsApi.deleteAsset(previewAsset.id);
      setPreviewAsset(null);
      setAssets(prev => prev.filter(a => a.id !== previewAsset.id));
    } catch (err) {
      setReviewError(err?.message || 'Failed to delete asset');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { setFolderError('Folder name is required'); return; }
    if (!currentProject) return;

    setFolderCreating(true);
    setFolderError(null);
    try {
      // Always create at root level — nested folders can be added via UI later
      const { data: newFolder } = await projectsApi.createFolder(currentProject.id, {
        name,
        parentId: undefined,
      });
      // Refetch from backend so we always have the canonical tree (with children + counts)
      const { data: freshFolders } = await projectsApi.getProjectFolders(currentProject.id);
      setFolders(freshFolders);
      setActiveFolderId(newFolder.id);
      setFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      setFolderError(err?.message || 'Failed to create folder');
    } finally {
      setFolderCreating(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setUploading(true);
    setUploadProgress(0);

    let localThumbnailUrl = null;
    if (file.type.startsWith('image/')) {
      localThumbnailUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(localThumbnailUrl);
    }

    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticAsset = {
      id: optimisticId,
      name: file.name,
      status: "DRAFT",
      currentVersion: 1,
      mimeType: file.type,
      fileSizeBytes: file.size,
      localThumbnailUrl,
      isUploading: true,
      comments: 0,
      creator: { name: 'You' },
      createdAt: new Date().toISOString(),
    };

    setAssets((prev) => [optimisticAsset, ...prev]);

    try {
      const newAsset = await assetsApi.uploadAsset(currentProject.id, activeFolderId, file, (pct) => {
        setUploadProgress(pct);
      });

      if (localThumbnailUrl) {
        newAsset.localThumbnailUrl = localThumbnailUrl;
      }

      setAssets((prev) => prev.map(a => a.id === optimisticId ? newAsset : a));
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to upload file");
      setAssets((prev) => prev.filter(a => a.id !== optimisticId));
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

  // 3. Fetch assets whenever active folder, filters, or sorting change
  React.useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    const statusParam = filterStatus === 'all' ? undefined : filterStatus;
    const typeParam = filterType === 'all' ? undefined : filterType;

    projectsApi.getProjectAssets(currentProject.id, {
      folderId: activeFolderId,
      status: statusParam,
      search: debouncedSearch || undefined,
      type: typeParam,
      sortBy,
      sortOrder,
    })
      .then(({ data, fromCache }) => {
        setOffline(fromCache);
        setAssets(data);
        hydrateAssetThumbnails(data);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, [currentProject, activeFolderId, filterStatus, filterType, debouncedSearch, sortBy, sortOrder, hydrateAssetThumbnails]);

  // Build the unified sidebar tree list dynamically
  const dynamicTree = React.useMemo(() => {
    const flattenFolders = (folderNodes, depth) =>
      (folderNodes || []).flatMap(f => [
        {
          id: f.id,
          label: f.name,
          depth,
          icon: I.folder,
          count: f._count?.assets ?? 0,
          active: activeFolderId === f.id,
          type: 'folder',
        },
        ...flattenFolders(f.children || [], depth + 1),
      ]);

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
        list.push(...flattenFolders(folders, 1));
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
          <button
            className="icon-btn"
            type="button"
            onClick={handleOpenFolderModal}
            title="New Folder"
            aria-label="New Folder"
          >
            {I.plus}
          </button>
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

        {/* Premium Filter & Sorting Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--line)', borderRadius: 10, marginBottom: 16,
          fontSize: 13, color: 'var(--ink)'
        }}>
          {/* MimeType Pills */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-canvas)', padding: 3, borderRadius: 8, border: '1px solid var(--line)' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'image', label: 'Images' },
              { id: 'video', label: 'Videos' },
              { id: 'audio', label: 'Audios' },
              { id: 'document', label: 'Docs' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                style={{
                  padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', background: filterType === pill.id ? 'var(--primary)' : 'transparent',
                  color: filterType === pill.id ? '#FFFFFF' : 'var(--ink-3)',
                  transition: 'all 0.15s ease'
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              style={{
                width: '100%', paddingLeft: 30, paddingRight: searchQuery ? 28 : 10,
                height: 32, borderRadius: 8, fontSize: 13, border: '1px solid var(--line)',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-4)',
                  fontSize: 14, padding: 0
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Status Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--ink-4)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</span>
            <select
              className="input"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ height: 32, padding: '0 8px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line)', minWidth: 100 }}
            >
              <option value="all">All</option>
              <option value="DRAFT">Draft</option>
              <option value="WIP">WIP</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--ink-4)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort</span>
            <select
              className="input"
              value={`${sortBy}:${sortOrder}`}
              onChange={e => {
                const [field, order] = e.target.value.split(':');
                setSortBy(field);
                setSortOrder(order);
              }}
              style={{ height: 32, padding: '0 8px', borderRadius: 8, fontSize: 13, border: '1px solid var(--line)', minWidth: 140 }}
            >
              <option value="updatedAt:desc">Newest</option>
              <option value="updatedAt:asc">Oldest</option>
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="fileSizeBytes:desc">Size (Largest)</option>
              <option value="fileSizeBytes:asc">Size (Smallest)</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(filterType !== 'all' || filterStatus !== 'all' || searchQuery || sortBy !== 'updatedAt' || sortOrder !== 'desc') && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterStatus('all');
                setSearchQuery('');
                setSortBy('updatedAt');
                setSortOrder('desc');
              }}
              className="btn btn--secondary"
              style={{ height: 32, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', color: 'var(--st-failed)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              Clear Filters
            </button>
          )}
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
                <div
                  className="asset-card asset-card--clickable"
                  key={a.id || i}
                  onClick={() => handleOpenAsset(a)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenAsset(a); } }}
                  tabIndex={0}
                  role="button"
                  title="Open asset review"
                  style={{ cursor: 'pointer' }}>
                  <div className="asset-card__thumb">
                    {(() => {
                      const thumbSrc = a.localThumbnailUrl || a.thumbnailUrl || a.metadata?.thumbnailUrl || a.metadata?.thumbnailSignedUrl || "";
                      if (thumbSrc) {
                        return <img src={resolveFileUrl(thumbSrc)} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
                      }
                      if ((a.mimeType?.startsWith('video/') || a.name?.endsWith('.mp4') || a.name?.endsWith('.mov') || a.name?.endsWith('.webm')) && a.fileUrl) {
                        return <video src={resolveFileUrl(a.fileUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />;
                      }
                      return <Placeholder tone={toneSet[i % toneSet.length]} label={a.name.split("_")[0]} style={{height:"100%", borderRadius:0}} />;
                    })()}
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
          <AssetList assets={assets} onSelect={handleOpenAsset} />
        ) : (
          <AssetCompare assets={assets} onSelect={handleOpenAsset} />
        )}
      </div>

      {/* ── New Folder Modal ── */}
      {folderModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(13,15,18,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setFolderModalOpen(false)}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '24px 24px 20px',
              width: 380,
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 20px 50px rgba(13,15,18,0.20), 0 2px 6px rgba(13,15,18,0.06)',
            }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>New Folder</h3>
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
              <div style={{ fontSize: 12, color: 'var(--st-failed)' }}>{folderError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
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

      {/* ── Asset Preview / Review Modal ── */}
      {previewAsset && (
        <AssetReviewModal
          asset={previewAsset}
          loading={reviewLoading}
          busy={reviewBusy}
          addingComment={addingComment}
          comment={reviewComment}
          setComment={setReviewComment}
          error={reviewError}
          onClose={handleClosePreview}
          onAddComment={handleAddComment}
          onReviewAction={handleReviewAction}
          onDelete={handleDeleteAsset}
          previewUrl={previewUrl}
          previewLoading={previewLoading}
          previewError={previewError}
        />
      )}
    </div>
  );
}

const SIZES = ["1.2 MB", "3.8 MB", "5.1 MB", "820 KB", "2.4 MB", "7.2 MB", "4.6 MB", "1.9 MB"];
const RES   = ["2048×2048", "1920×1080", "4096×4096", "1024×1024", "1080×1920", "3840×2160"];

function AssetList({ assets, onSelect }) {
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
          <div className="asset-table__row" key={a.id || i} onClick={() => onSelect?.(a)} style={{ cursor: 'pointer' }}>
            <div className="asset-table__thumb">
              {(() => {
                const thumbSrc = a.localThumbnailUrl || a.thumbnailUrl || a.metadata?.thumbnailUrl || a.metadata?.thumbnailSignedUrl || "";
                if (thumbSrc) {
                  return <img src={resolveFileUrl(thumbSrc)} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
                }
                if ((a.mimeType?.startsWith('video/') || a.name?.endsWith('.mp4') || a.name?.endsWith('.mov') || a.name?.endsWith('.webm')) && a.fileUrl) {
                  return <video src={resolveFileUrl(a.fileUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />;
                }
                return <Placeholder tone={toneSet[i % toneSet.length]} label="" style={{height:"100%", borderRadius: 0}} />;
              })()}
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

function AssetCompare({ assets, onSelect }) {
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
        <div
          className="asset-compare__art"
          onClick={() => onSelect?.(asset)}
          tabIndex={0}
          role="button"
          title="Open asset review"
          style={{ cursor: 'pointer' }}
        >
          {(() => {
            const thumbSrc = asset.localThumbnailUrl || asset.thumbnailUrl || asset.metadata?.thumbnailUrl || asset.metadata?.thumbnailSignedUrl || "";
            if (thumbSrc) {
              return <img src={resolveFileUrl(thumbSrc)} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
            }
            if ((asset.mimeType?.startsWith('video/') || asset.name?.endsWith('.mp4') || asset.name?.endsWith('.mov') || asset.name?.endsWith('.webm')) && asset.fileUrl) {
              return <video src={resolveFileUrl(asset.fileUrl)} style={{ width: "100%", height: "100%", objectFit: "contain" }} muted playsInline preload="metadata" />;
            }
            return <Placeholder tone={toneSet[idx % toneSet.length]} label={asset.name.split("_")[0]} style={{height:"100%", borderRadius: 0}} />;
          })()}
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

// ─────────────────────────────────────────────
//  Asset Review Modal
// ─────────────────────────────────────────────
function AssetReviewModal({
  asset, loading, busy, addingComment,
  comment, setComment, error,
  onClose, onAddComment, onReviewAction,
  onDelete,
  previewUrl, previewLoading, previewError,
}) {
  console.log("[AssetReviewModal] render", asset.id);
  const status = asset.status || 'DRAFT';
  const [chipCls, chipLabel] = STATUS[status] ?? ['chip chip--draft', status];
  const canDecide = status === 'IN_REVIEW';

  const fmtBytes = (b) => b ? `${(b / 1024 / 1024).toFixed(2)} MB` : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(13,15,18,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}>
      <div
        style={{
          background: '#FFFFFF', border: '1px solid var(--line)',
          borderRadius: 14, width: '100%', maxWidth: 1180, maxHeight: '92vh',
          display: 'grid', gridTemplateColumns: '1fr 360px',
          overflow: 'hidden', boxShadow: '0 20px 60px rgba(13,15,18,0.30)',
        }}
        onClick={(e) => e.stopPropagation()}>

        {/* ─── Left: full-size preview ─── */}
        <div style={{
          background: 'var(--bg-canvas-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 480, padding: 24, overflow: 'auto',
          position: 'relative',
        }}>
          {previewLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div className="spinner" style={{ width: 28, height: 28, border: '2px solid var(--line)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}></div>
              <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 11 }}>Loading preview…</div>
            </div>
          ) : previewError ? (
            <div style={{ color: 'var(--st-failed)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{previewError}</div>
          ) : previewUrl ? (
            (() => {
              const mime = asset.mimeType || '';
              if (mime.startsWith('video/')) {
                return <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 6, boxShadow: 'var(--sh-md)' }} />;
              } else if (mime.startsWith('audio/')) {
                return <audio src={previewUrl} controls style={{ width: '80%' }} />;
              } else {
                return <img src={previewUrl} alt={asset.name}
                  style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 6, boxShadow: 'var(--sh-md)' }} />;
              }
            })()
          ) : (
            <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>No preview available</div>
          )}
        </div>

        {/* ─── Right: details + review actions ─── */}
        <div style={{
          padding: '20px 22px 18px',
          display: 'flex', flexDirection: 'column', gap: 14,
          borderLeft: '1px solid var(--line)',
          overflow: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>{asset.name}</h3>
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="chip chip--version">v{asset.currentVersion ?? 1}</span>
                <span className={chipCls}>{chipLabel}</span>
                {loading && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>loading…</span>}
              </div>
            </div>
            <button className="icon-btn icon-btn--light" onClick={onClose} title="Close (Esc)" disabled={busy || addingComment}>×</button>
          </div>

          {/* Metadata */}
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '88px 1fr', gap: '6px 12px', fontSize: 12.5 }}>
            <dt style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type</dt>
            <dd style={{ margin: 0, color: 'var(--ink-2)' }}>{asset.mimeType ?? '—'}</dd>
            <dt style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Size</dt>
            <dd style={{ margin: 0, color: 'var(--ink-2)' }}>{fmtBytes(asset.fileSizeBytes)}</dd>
            <dt style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Creator</dt>
            <dd style={{ margin: 0, color: 'var(--ink-2)' }}>{asset.creator?.name ?? '—'}</dd>
            <dt style={{ color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Created</dt>
            <dd style={{ margin: 0, color: 'var(--ink-2)' }}>{fmtDate(asset.createdAt)}</dd>
          </dl>

          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="btn btn--secondary" style={{ justifyContent: 'center' }}>
              Open in new tab
            </a>
          )}

          {(asset.mimeType || '').startsWith('image/') && (previewUrl || asset.metadata?.fileKey) && (
            <button
              className="btn btn--primary"
              style={{ justifyContent: 'center', background: 'var(--primary)', color: '#FFFFFF' }}
              onClick={() => {
                localStorage.setItem("bt_edit_asset", JSON.stringify({
                  assetId: asset.id,
                  assetName: asset.name,
                  fileKey: asset.metadata?.fileKey || null,
                  previewUrl: previewUrl || null,
                  mimeType: asset.mimeType,
                  versionId: asset.latestVersion?.id || asset.versions?.[0]?.id || null,
                }));
                localStorage.setItem("bt_tool", "editor");
                localStorage.setItem("bt_screen", "workspace");
                window.location.reload();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Edit in AI Workspace
            </button>
          )}

          <button
            className="btn btn--secondary"
            style={{ justifyContent: 'center', color: 'var(--st-failed)', borderColor: 'var(--st-failed)', marginTop: 4 }}
            onClick={onDelete}
            disabled={busy || addingComment}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Delete Asset
          </button>

          {/* Versions */}
          {asset.versions && asset.versions.length > 0 && (
            <details style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
              <summary style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.10em', color: 'var(--ink-4)', textTransform: 'uppercase', cursor: 'pointer' }}>
                Versions ({asset.versions.length})
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {asset.versions.map(v => (
                  <div key={v.id} style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span><span className="chip chip--version">v{v.versionNumber}</span> {v.status}</span>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>{fmtDate(v.createdAt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Reviews */}
          {asset.reviews && asset.reviews.length > 0 && (
            <details style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }} open>
              <summary style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.10em', color: 'var(--ink-4)', textTransform: 'uppercase', cursor: 'pointer' }}>
                Reviews ({asset.reviews.length})
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {asset.reviews.map(r => (
                  <div key={r.id} style={{ fontSize: 12, color: 'var(--ink-2)', padding: '6px 8px', background: 'var(--bg-canvas)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <strong>{r.reviewer?.name ?? 'Reviewer'}</strong>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>{r.decision}</span>
                    </div>
                    {r.comment && <div style={{ marginTop: 4, color: 'var(--ink-3)' }}>{r.comment}</div>}
                    <div style={{ marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{fmtDate(r.createdAt)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Comments */}
          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.10em', color: 'var(--ink-4)', textTransform: 'uppercase' }}>
              Comments ({asset.comments?.length ?? 0})
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
              {(Array.isArray(asset.comments) ? asset.comments : []).map(c => (
                <div key={c.id} style={{ fontSize: 12, color: 'var(--ink-2)', padding: '6px 8px', background: 'var(--bg-canvas)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <strong>{c.author?.name ?? 'User'}</strong>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{fmtDate(c.createdAt)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>{c.body}</div>
                </div>
              ))}
              {(!asset.comments || asset.comments.length === 0) && !loading && (
                <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>No comments yet.</div>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="input"
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) onAddComment(); }}
                disabled={addingComment}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn--secondary"
                onClick={onAddComment}
                disabled={addingComment || !comment.trim()}>
                {addingComment ? '…' : 'Post'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: 'var(--st-failed)', padding: '6px 8px', background: 'var(--st-failed-bg)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          {/* Review actions — status-aware */}
          <div style={{
            marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--line-2)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {canDecide ? (
              <>
                <button className="btn btn--primary" disabled={busy} onClick={() => onReviewAction('approve')}>
                  {busy ? '…' : 'Approve'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--secondary" style={{ flex: 1 }} disabled={busy} onClick={() => onReviewAction('request-revision')}>
                    Request revision
                  </button>
                  <button className="btn btn--secondary" style={{ flex: 1, color: 'var(--st-failed)' }} disabled={busy} onClick={() => onReviewAction('reject')}>
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center', padding: '8px 0' }}>
                Status: <strong>{chipLabel}</strong> — {status === 'DRAFT' || status === 'WIP' ? 'Draft asset — no review action available.' : 'no actions available'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ProjectMgmt = ProjectMgmt;
window.AssetList = AssetList;
window.AssetCompare = AssetCompare;
window.AssetReviewModal = AssetReviewModal;