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

function ProjectMgmt({ searchQuery = "" }) {
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

  // Frame.io selection states (v6.0)
  const [selectedAssetIds, setSelectedAssetIds] = React.useState(new Set());
  const [lastSelectedAssetId, setLastSelectedAssetId] = React.useState(null);
  const [bulkActionBusy, setBulkActionBusy] = React.useState(false);
  const [bulkActionError, setBulkActionError] = React.useState(null);
  const [moveModalOpen, setMoveModalOpen] = React.useState(false);
  const [copyModalOpen, setCopyModalOpen] = React.useState(false);
  const [aiActionMenuOpen, setAiActionMenuOpen] = React.useState(false);
  const [targetFolderId, setTargetFolderId] = React.useState(null);

  // Rename states (v7.0)
  const [renameModalOpen, setRenameModalOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");
  const [renamingAsset, setRenamingAsset] = React.useState(false);
  const [renameError, setRenameError] = React.useState(null);

  // Filter states (v7.0)
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [assetFilters, setAssetFilters] = React.useState({
    status: "all",
    type: "all",
    hasComments: "all",
  });

  // Clear selection when project or folder changes
  React.useEffect(() => {
    setSelectedAssetIds(new Set());
    setLastSelectedAssetId(null);
    setAiActionMenuOpen(false);
  }, [currentProject, activeFolderId]);

  // Keyboard shortcuts (Escape, Ctrl+A)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedAssetIds(new Set());
        setLastSelectedAssetId(null);
        setAiActionMenuOpen(false);
        setFilterOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        if (
          document.activeElement &&
          (document.activeElement.tagName === "INPUT" ||
            document.activeElement.tagName === "TEXTAREA" ||
            document.activeElement.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (filteredAssets.length > 0) {
          setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredAssets]);

  const filterContainerRef = React.useRef(null);
  React.useEffect(() => {
    const clickOutside = (e) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // Shift-click support for multi-selection
  const handleToggleSelect = (assetId, event) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
        if (lastSelectedAssetId === assetId) {
          setLastSelectedAssetId(null);
        }
      } else {
        if (event && event.shiftKey && lastSelectedAssetId) {
          const visibleIds = filteredAssets.map((a) => a.id);
          const startIdx = visibleIds.indexOf(lastSelectedAssetId);
          const endIdx = visibleIds.indexOf(assetId);
          if (startIdx !== -1 && endIdx !== -1) {
            const min = Math.min(startIdx, endIdx);
            const max = Math.max(startIdx, endIdx);
            for (let i = min; i <= max; i++) {
              next.add(visibleIds[i]);
            }
          }
        } else {
          next.add(assetId);
        }
        setLastSelectedAssetId(assetId);
      }
      return next;
    });
  };

  // Object URL cache to prevent memory leaks
  const objectUrlsRef = React.useRef([]);

  // Create menu and new project states
  const [createMenuOpen, setCreateMenuOpen] = React.useState(false);
  const createMenuRef = React.useRef(null);
  const [menuPos, setMenuPos] = React.useState(null);

  const [projectModalOpen, setProjectModalOpen] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState('');
  const [newProjectClient, setNewProjectClient] = React.useState('');
  const [newProjectDescription, setNewProjectDescription] = React.useState('');
  const [newProjectTone, setNewProjectTone] = React.useState('blue');
  const [projectCreating, setProjectCreating] = React.useState(false);
  const [projectError, setProjectError] = React.useState(null);

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

  React.useEffect(() => {
    return () => {
      // Clean up object URLs on unmount
      objectUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
    };
  }, []);

  React.useEffect(() => {
    const clickOutside = (e) => {
      if (createMenuRef.current && createMenuRef.current.contains(e.target)) {
        return;
      }
      if (e.target.closest && e.target.closest('.tree-create-menu__popover')) {
        return;
      }
      setCreateMenuOpen(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleOpenCreateMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setCreateMenuOpen(v => !v);
  };

  const handleOpenProjectModal = () => {
    setCreateMenuOpen(false);
    setNewProjectName('');
    setNewProjectClient('');
    setNewProjectDescription('');
    setNewProjectTone('blue');
    setProjectError(null);
    setProjectModalOpen(true);
  };

  const handleOpenFolderModal = () => {
    setCreateMenuOpen(false);
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
      const { data } = await projectsApi.getProjectAssets(currentProject.id, { folderId: activeFolderId });
      setAssets(data);
      hydrateAssetThumbnails(data);
    } catch (e) { console.warn('[refreshAssetGrid] failed:', e); }
  }, [currentProject, activeFolderId, hydrateAssetThumbnails]);

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

  // Bulk action handlers (v6.0)
  const handleBulkDelete = async () => {
    if (selectedAssetIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedAssetIds.size} assets?`)) return;
    setBulkActionBusy(true);
    setBulkActionError(null);
    try {
      const ids = Array.from(selectedAssetIds);
      await assetsApi.bulkDelete(ids);
      setAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)));
      setSelectedAssetIds(new Set());
      setLastSelectedAssetId(null);
    } catch (err) {
      setBulkActionError(err?.message || 'Failed to delete assets');
      alert(err?.message || 'Failed to delete assets');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkMove = async () => {
    if (selectedAssetIds.size === 0 || !targetFolderId) return;
    setBulkActionBusy(true);
    setBulkActionError(null);
    try {
      const ids = Array.from(selectedAssetIds);
      await assetsApi.bulkMove(ids, targetFolderId);
      setAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)));
      setSelectedAssetIds(new Set());
      setLastSelectedAssetId(null);
      setMoveModalOpen(false);
      setTargetFolderId(null);
    } catch (err) {
      setBulkActionError(err?.message || 'Failed to move assets');
      alert(err?.message || 'Failed to move assets');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkCopy = async () => {
    if (selectedAssetIds.size === 0 || !targetFolderId) return;
    setBulkActionBusy(true);
    setBulkActionError(null);
    try {
      const ids = Array.from(selectedAssetIds);
      await assetsApi.bulkCopy(ids, targetFolderId);
      if (targetFolderId === activeFolderId) {
        refreshAssetGrid();
      }
      setSelectedAssetIds(new Set());
      setLastSelectedAssetId(null);
      setCopyModalOpen(false);
      setTargetFolderId(null);
      alert(`Copied ${ids.length} assets successfully!`);
    } catch (err) {
      setBulkActionError(err?.message || 'Failed to copy assets');
      alert(err?.message || 'Failed to copy assets');
    } finally {
      setBulkActionBusy(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedAssetIds.size === 0) return;
    setBulkActionBusy(true);
    setBulkActionError(null);
    try {
      const ids = Array.from(selectedAssetIds);
      const files = await assetsApi.bulkDownload(ids);
      if (files && files.length > 0) {
        files.forEach((file, index) => {
          setTimeout(() => {
            const link = document.createElement('a');
            link.href = resolveFileUrl(file.url);
            link.download = file.name || 'asset';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }, index * 400);
        });
      } else {
        throw new Error("No files found for download");
      }
    } catch (err) {
      setBulkActionError(err?.message || 'Failed to download assets');
      alert(err?.message || 'Failed to download assets');
    } finally {
      setBulkActionBusy(false);
    }
  };

  function resolveAssetSourceRefs(asset, detailedAsset) {
    const d = detailedAsset || {};
    const latestVersion = d.latestVersion || d.versions?.[0] || asset.latestVersion || asset.versions?.[0] || null;

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

  const handleUseWithAI = async (toolId, jobType) => {
    // If no assets are selected, open workspace with current project context only
    if (selectedAssetIds.size === 0) {
      localStorage.setItem("bt_tool", toolId || "upscaler");
      localStorage.setItem("bt_screen", "workspace");
      if (currentProject?.id) {
        localStorage.setItem("bt_active_proj", currentProject.id);
      }
      window.location.reload();
      return;
    }
    setBulkActionBusy(true);
    setBulkActionError(null);
    try {
      const selectedAssets = assets.filter(a => selectedAssetIds.has(a.id));

      // V0.6: For Upscaler, require an image as the source.
      if (toolId === "upscaler") {
        const firstAsset = selectedAssets[0];
        if (!firstAsset || !(firstAsset.mimeType || "").startsWith("image/")) {
          alert("Image Upscaler only accepts image assets. Please select an image.");
          setBulkActionBusy(false);
          setAiActionMenuOpen(false);
          return;
        }
      }

      // Pre-resolve signed preview URL for assets that have a fileKey so the
      // workbench can render the source image instantly.
      const enriched = await Promise.all(selectedAssets.map(async (a) => {
        let assetDetail = {};
        let versions = [];
        try {
          if (typeof assetsApi !== "undefined" && assetsApi.getAsset) {
            assetDetail = await assetsApi.getAsset(a.id);
          }
        } catch (e) {
          console.warn("[UseWithAI] Failed to fetch asset detail for", a.id, e);
        }
        try {
          if (typeof assetsApi !== "undefined" && assetsApi.getAssetVersions) {
            versions = await assetsApi.getAssetVersions(a.id);
          }
        } catch (e) {
          console.warn("[UseWithAI] Failed to fetch versions for", a.id, e);
        }

        const detailed = {
          ...assetDetail,
          versions,
          latestVersion: versions?.[0] || assetDetail?.versions?.[0] || null
        };

        const { fileKey, fileUrl, latestVersion } = resolveAssetSourceRefs(a, detailed);

        let signedUrl = null;
        if (fileKey && typeof assetsApi !== "undefined" && assetsApi.getSignedUrl) {
          try {
            signedUrl = await assetsApi.getSignedUrl(fileKey);
          } catch (e) {
            console.warn("[UseWithAI] Failed to get signed URL for", fileKey, e);
          }
        }

        const previewUrl = signedUrl || resolveFileUrl(fileUrl) || null;
        const sourceFileUrl = signedUrl || resolveFileUrl(fileUrl) || null;
        const finalFileUrl = resolveFileUrl(fileUrl) || null;
        const currentVersion = latestVersion?.versionNumber || latestVersion?.version || detailed?.currentVersion || a.currentVersion || 1;

        console.log("[UseWithAI] enriched asset", { id: a.id, name: a.name, fileKey, hasPreviewUrl: !!previewUrl });

        return {
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          fileKey,
          fileUrl: finalFileUrl,
          previewUrl,
          sourceFileUrl,
          projectId: a.projectId || currentProject.id,
          currentVersion
        };
      }));

      const ctx = {
        version: "0.6",
        source: "projects",
        projectId: currentProject.id,
        toolId,
        jobType: jobType === "upscale" ? "IMAGE_UPSCALE" : jobType,
        mode: "single",
        selectedAssetIds: enriched.map(a => a.id),
        assets: enriched,
      };

      localStorage.setItem("bt_selected_assets_for_ai", JSON.stringify(ctx));
      localStorage.setItem("bt_tool", toolId || "image-gen");
      localStorage.setItem("bt_screen", "workspace");
      window.location.reload();
    } catch (err) {
      setBulkActionError(err?.message || 'Failed to send assets to AI Workspace');
      alert(err?.message || 'Failed to send assets to AI Workspace');
    } finally {
      setBulkActionBusy(false);
      setAiActionMenuOpen(false);
    }
  };

  function openRenameModal() {
    const selected = selectedAssets[0];
    if (!selected || selectedAssets.length !== 1) return;
    setRenameValue(selected.name || "");
    setRenameError(null);
    setRenameModalOpen(true);
  }

  async function handleRenameAsset() {
    const selected = selectedAssets[0];
    const name = renameValue.trim();

    if (!selected) return;
    if (!name) {
      setRenameError("Asset name is required");
      return;
    }

    setRenamingAsset(true);
    setRenameError(null);

    try {
      const updated = await assetsApi.renameAsset(selected.id, { name });
      setAssets(prev => prev.map(a => a.id === selected.id ? { ...a, name: updated.name || updated.asset?.name || name } : a));
      setRenameModalOpen(false);
    } catch (err) {
      setRenameError(err?.message || "Failed to rename asset");
    } finally {
      setRenamingAsset(false);
    }
  }

  async function handleDuplicateSelected() {
    if (selectedAssetIds.size === 0) return;

    setBulkActionBusy(true);
    setBulkActionError(null);

    try {
      const ids = Array.from(selectedAssetIds);
      const result = await assetsApi.bulkDuplicate(ids);

      const copiedAssets = result.copiedAssets || result.assets || [];
      if (copiedAssets.length > 0) {
        setAssets(prev => [...copiedAssets, ...prev]);
      } else {
        await refreshAssetGrid();
      }

      setSelectedAssetIds(new Set());
      setLastSelectedAssetId(null);
    } catch (err) {
      setBulkActionError(err?.message || "Failed to duplicate assets");
      alert(err?.message || "Failed to duplicate assets");
    } finally {
      setBulkActionBusy(false);
    }
  }

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    const client = newProjectClient.trim();

    if (!name) {
      setProjectError('Project name is required');
      return;
    }

    if (!client) {
      setProjectError('Client / Brand is required');
      return;
    }

    setProjectCreating(true);
    setProjectError(null);

    try {
      const { data: project } = await projectsApi.createProject({
        name,
        client,
        description: newProjectDescription.trim() || undefined,
        tone: newProjectTone || undefined,
      });

      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      localStorage.setItem('bt_active_proj', project.id);

      const { data: freshFolders } = await projectsApi.getProjectFolders(project.id);
      setFolders(freshFolders || []);

      const genFolder = (freshFolders || []).find(f => f.name === 'Generated' || f.name === 'gen');
      const defaultFolder = genFolder || (freshFolders || [])[0] || null;
      setActiveFolderId(defaultFolder ? defaultFolder.id : null);

      setProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectClient('');
      setNewProjectDescription('');
      setNewProjectTone('blue');
    } catch (err) {
      setProjectError(err?.message || 'Failed to create project');
    } finally {
      setProjectCreating(false);
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

  // 3. Fetch assets whenever active folder changes
  React.useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    projectsApi.getProjectAssets(currentProject.id, { folderId: activeFolderId })
      .then(({ data, fromCache }) => {
        setOffline(fromCache);
        setAssets(data);
        hydrateAssetThumbnails(data);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, [currentProject, activeFolderId, hydrateAssetThumbnails]);

  // V0.6: Focus an asset by id after returning from AI Workspace.
  React.useEffect(() => {
    if (!assets || assets.length === 0) return;
    let focusId = null;
    try { focusId = localStorage.getItem("bt_focus_asset"); } catch (e) {}
    if (!focusId) return;
    const target = assets.find(a => a.id === focusId);
    if (!target) return;
    try {
      const el = document.querySelector(`[data-asset-id="${focusId}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {}
    handleOpenAsset(target);
    try {
      localStorage.removeItem("bt_focus_asset");
      // bt_focus_version is read inside the modal; left as-is until AssetReviewModal mounts.
    } catch (e) {}
  }, [assets]);

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

  const normalizedSearch = (searchQuery || "").trim().toLowerCase();

  const filteredAssets = React.useMemo(() => {
    return assets.filter(asset => {
      if (assetFilters.status !== "all") {
        const s = assetFilters.status.toLowerCase();
        const assetStatus = (asset.status || "").toLowerCase();
        if (s === "in review" || s === "in_review") {
          if (assetStatus !== "in_review" && assetStatus !== "in review") return false;
        } else if (s === "failed") {
          if (assetStatus !== "failed" && assetStatus !== "rejected" && assetStatus !== "revision_requested") return false;
        } else {
          if (assetStatus !== s) return false;
        }
      }

      const mime = asset.mimeType || "";
      if (assetFilters.type === "image" && !mime.startsWith("image/")) return false;
      if (assetFilters.type === "video" && !mime.startsWith("video/")) return false;
      if (assetFilters.type === "audio" && !mime.startsWith("audio/")) return false;

      const commentsCount = asset._count?.comments ?? asset.comments ?? 0;
      if (assetFilters.hasComments === "yes" && commentsCount <= 0) return false;
      if (assetFilters.hasComments === "no" && commentsCount > 0) return false;

      if (normalizedSearch) {
        const haystack = [
          asset.name,
          asset.mimeType,
          asset.status,
          asset.creator?.name,
          asset.metadata?.originalFileName,
          asset.metadata?.fileKey,
        ].filter(Boolean).join(" ").toLowerCase();

        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [assets, assetFilters, normalizedSearch]);

  React.useEffect(() => {
    const handleGlobalSearchSubmit = (e) => {
      const q = e.detail?.query || "";
      if (!q.trim()) return;

      const normalizedQ = q.trim().toLowerCase();
      const matches = filteredAssets.filter(asset => {
        const haystack = [
          asset.name,
          asset.mimeType,
          asset.status,
          asset.creator?.name,
          asset.metadata?.originalFileName,
          asset.metadata?.fileKey,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedQ);
      });

      if (matches.length > 0) {
        const firstMatchId = matches[0].id;
        setTimeout(() => {
          const targetEl = document.getElementById(`asset-card-${firstMatchId}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            targetEl.classList.add("asset-card--search-hit");
            setTimeout(() => {
              targetEl.classList.remove("asset-card--search-hit");
            }, 1500);
          }
        }, 100);
      }
    };
    window.addEventListener("bt:global-search-submit", handleGlobalSearchSubmit);
    return () => window.removeEventListener("bt:global-search-submit", handleGlobalSearchSubmit);
  }, [filteredAssets]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (assetFilters.status !== "all") count++;
    if (assetFilters.type !== "all") count++;
    if (assetFilters.hasComments !== "all") count++;
    return count;
  }, [assetFilters]);

  const selectedAssets = React.useMemo(() => {
    return assets.filter(a => selectedAssetIds.has(a.id));
  }, [assets, selectedAssetIds]);

  const selectedAssetsTotalSize = React.useMemo(() => {
    return selectedAssets.reduce((sum, asset) => {
      return sum + Number(asset.fileSizeBytes || asset.sizeBytes || asset.metadata?.fileSizeBytes || 0);
    }, 0);
  }, [selectedAssets]);

  const flattenedFoldersForPicker = React.useMemo(() => {
    const flatten = (folderNodes, depth) =>
      (folderNodes || []).flatMap(f => [
        { id: f.id, name: f.name, depth },
        ...flatten(f.children || [], depth + 1),
      ]);
    return [
      { id: "root", name: "Root Folder", depth: 0 },
      ...flatten(folders, 1)
    ];
  }, [folders]);

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
          <div className="tree-create-menu" ref={createMenuRef}>
            <button
              className={`icon-btn ${createMenuOpen ? 'active' : ''}`}
              type="button"
              onClick={handleOpenCreateMenu}
              title="Create"
              aria-label="Create project or folder"
              aria-expanded={createMenuOpen}
            >
              {I.plus}
            </button>

            {createMenuOpen && menuPos && ReactDOM.createPortal(
              <div
                className="tree-create-menu__popover tree-create-menu__popover--fixed"
                style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              >
                <button
                  type="button"
                  className="tree-create-menu__item"
                  onClick={handleOpenProjectModal}
                >
                  <span className="tree-create-menu__icon">{I.folder}</span>
                  <span>
                    <strong>New Project</strong>
                    <small>Create a new workspace project</small>
                  </span>
                </button>

                <button
                  type="button"
                  className="tree-create-menu__item"
                  onClick={handleOpenFolderModal}
                  disabled={!currentProject}
                  title={!currentProject ? 'Select a project first' : 'Create folder in current project'}
                >
                  <span className="tree-create-menu__icon">{I.folder}</span>
                  <span>
                    <strong>New Folder</strong>
                    <small>Add folder to current project</small>
                  </span>
                </button>
              </div>,
              document.body
            )}
          </div>
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
          
          <div style={{ position: "relative" }} ref={filterContainerRef}>
            <button
              className={`btn btn--secondary ${activeFiltersCount > 0 ? "btn--active" : ""}`}
              onClick={() => setFilterOpen(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {I.filter}
              <span>Filter</span>
              {activeFiltersCount > 0 && (
                <span className="filter-badge" style={{
                  background: "var(--accent, #3b82f6)",
                  color: "#ffffff",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  fontSize: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  marginLeft: 4
                }}>{activeFiltersCount}</span>
              )}
            </button>

            {filterOpen && (
              <div className="asset-filter-popover" onClick={(e) => e.stopPropagation()}>
                <label className="asset-filter-field">
                  <span className="asset-filter-label">Status</span>
                  <select
                    value={assetFilters.status}
                    onChange={(e) => setAssetFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="asset-filter-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="WIP">WIP</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>

                <label className="asset-filter-field">
                  <span className="asset-filter-label">Type</span>
                  <select
                    value={assetFilters.type}
                    onChange={(e) => setAssetFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="asset-filter-select"
                  >
                    <option value="all">All Types</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </label>

                <label className="asset-filter-field">
                  <span className="asset-filter-label">Comments</span>
                  <select
                    value={assetFilters.hasComments}
                    onChange={(e) => setAssetFilters(prev => ({ ...prev, hasComments: e.target.value }))}
                    className="asset-filter-select"
                  >
                    <option value="all">All</option>
                    <option value="yes">Has comments</option>
                    <option value="no">No comments</option>
                  </select>
                </label>

                <div className="asset-filter-actions">
                  <button
                    className="asset-filter-clear"
                    onClick={() => setAssetFilters({ status: "all", type: "all", hasComments: "all" })}
                  >
                    Clear
                  </button>
                  <button
                    className="asset-filter-close"
                    onClick={() => setFilterOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="btn btn--primary" onClick={() => handleUseWithAI("upscaler", "upscale")}>{I.spark}<span>Open in AI Workspace</span></button>
        </div>
        <p className="page-sub">
          {activeFiltersCount > 0 ? `${filteredAssets.length} of ${assets.length}` : assets.length} generated files · {loading ? "loading updates..." : "synced with database"}
        </p>

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
          {searchQuery && (
            <span className="search-result-label" style={{ marginLeft: 16, fontSize: 13, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}>
              Search: <strong>“{searchQuery}”</strong> · {filteredAssets.length} {filteredAssets.length === 1 ? "result" : "results"}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("bt:clear-global-search"));
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent, #3b82f6)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: "bold",
                  padding: "0 4px",
                  textDecoration: "underline"
                }}
              >
                [Clear]
              </button>
            </span>
          )}
          <span className="spacer" />
          <div className="segmented">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
            <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>Compare</button>
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="card card--pad" style={{padding: 48, textAlign: "center", color:"var(--ink-3)"}}>
            <div style={{fontSize: 32, marginBottom: 12}}>{I.folder}</div>
            <h3 style={{margin: "0 0 6px"}}>{assets.length === 0 ? "No assets found" : "No assets match active filters"}</h3>
            <p style={{margin: 0, color: "var(--ink-4)"}}>
              {assets.length === 0
                ? "Generate new frames in the AI Workspace or upload assets to begin."
                : "Try clearing your filters to see all assets."}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="asset-grid">
            {filteredAssets.map((a, i) => {
              const statusKey = a.status || "DRAFT";
              const [cls, label] = STATUS[statusKey] ?? ["chip chip--draft", "Draft"];
              const commentsCount = a._count?.comments ?? a.comments ?? 0;
              const versionNumber = a.currentVersion ?? a.v ?? 1;
              const creatorName = a.creator?.name ?? "System";
              const creatorInitials = creatorName.split(" ").map(s => s[0]).join("").slice(0,2);
              return (
                <div
                  id={`asset-card-${a.id}`}
                  className={`asset-card asset-card--clickable ${selectedAssetIds.has(a.id) ? 'asset-card--selected' : ''}`}
                  key={a.id || i}
                  data-asset-id={a.id}
                  onClick={() => handleOpenAsset(a)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenAsset(a); } }}
                  tabIndex={0}
                  role="button"
                  title="Open asset review"
                  style={{ cursor: 'pointer' }}>
                  <div
                    className={`asset-checkbox ${selectedAssetIds.has(a.id) ? 'asset-checkbox--checked' : ''}`}
                    onClick={(e) => handleToggleSelect(a.id, e)}
                    title="Select asset"
                  />
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
          <AssetList
            assets={filteredAssets}
            onSelect={handleOpenAsset}
            selectedAssetIds={selectedAssetIds}
            onToggleSelect={handleToggleSelect}
          />
        ) : (
          <AssetCompare
            assets={filteredAssets}
            onSelect={handleOpenAsset}
            selectedAssetIds={selectedAssetIds}
            onToggleSelect={handleToggleSelect}
          />
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
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '24px 24px 20px',
              width: 380,
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: 'var(--sh-lg)',
            }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>New Folder</h3>
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

      {/* ── New Project Modal ── */}
      {projectModalOpen && (
        <div
          className="move-copy-modal"
          onClick={() => {
            if (!projectCreating) setProjectModalOpen(false);
          }}
        >
          <div
            className="move-copy-modal__card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420 }}
          >
            <div className="move-copy-modal__head">
              <h3>New Project</h3>
              <button
                className="icon-btn icon-btn--light"
                onClick={() => setProjectModalOpen(false)}
                disabled={projectCreating}
              >
                ×
              </button>
            </div>

            <div className="move-copy-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="asset-filter-field">
                <span className="asset-filter-label">Project Name</span>
                <input
                  autoFocus
                  type="text"
                  className="input"
                  placeholder="e.g. Huda Summer Campaign"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setProjectModalOpen(false);
                  }}
                />
              </label>

              <label className="asset-filter-field">
                <span className="asset-filter-label">Client / Brand</span>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Huda / Carlsberg"
                  value={newProjectClient}
                  onChange={(e) => setNewProjectClient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setProjectModalOpen(false);
                  }}
                />
              </label>

              <label className="asset-filter-field">
                <span className="asset-filter-label">Description</span>
                <textarea
                  className="textarea"
                  placeholder="Optional project description..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  style={{ minHeight: 72 }}
                />
              </label>

              <label className="asset-filter-field">
                <span className="asset-filter-label">Tone</span>
                <select
                  className="asset-filter-select"
                  value={newProjectTone}
                  onChange={(e) => setNewProjectTone(e.target.value)}
                >
                  <option value="blue">Blue</option>
                  <option value="rose">Rose</option>
                  <option value="amber">Amber</option>
                  <option value="teal">Teal</option>
                  <option value="violet">Violet</option>
                  <option value="green">Green</option>
                </select>
              </label>

              {projectError && (
                <div style={{ fontSize: 12, color: 'var(--st-failed)' }}>
                  {projectError}
                </div>
              )}
            </div>

            <div className="move-copy-modal__foot">
              <button
                className="btn btn--ghost"
                onClick={() => setProjectModalOpen(false)}
                disabled={projectCreating}
              >
                Cancel
              </button>

              <button
                className="btn btn--primary"
                onClick={handleCreateProject}
                disabled={projectCreating || !newProjectName.trim() || !newProjectClient.trim()}
              >
                {projectCreating ? 'Creating…' : 'Create Project'}
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

      {/* ── Fixed Bottom Selection Bar (v6.0) ── */}
      {selectedAssetIds.size > 0 && selectedAssets.length > 0 && (
        <AssetSelectionBar
          selectedAssets={selectedAssets}
          totalSizeBytes={selectedAssetsTotalSize}
          onClear={() => { setSelectedAssetIds(new Set()); setLastSelectedAssetId(null); }}
          onUseWithAI={() => handleUseWithAI("upscaler", "upscale")}
          onRename={openRenameModal}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onDuplicate={handleDuplicateSelected}
          onMoveTo={() => setMoveModalOpen(true)}
          onCopyTo={() => setCopyModalOpen(true)}
        />
      )}

      {/* ── Move / Copy Folder Modal ── */}
      {(moveModalOpen || copyModalOpen) && (
        <div className="move-copy-modal" onClick={() => { setMoveModalOpen(false); setCopyModalOpen(false); setTargetFolderId(null); }}>
          <div className="move-copy-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="move-copy-modal__head">
              <h3>{moveModalOpen ? "Move Assets" : "Copy Assets"}</h3>
              <button
                className="icon-btn icon-btn--light"
                onClick={() => { setMoveModalOpen(false); setCopyModalOpen(false); setTargetFolderId(null); }}
              >×</button>
            </div>
            <div className="move-copy-modal__body">
              <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "var(--ink-3)" }}>
                Select a target folder to {moveModalOpen ? "move" : "copy"} the {selectedAssetIds.size} selected assets:
              </p>
              {flattenedFoldersForPicker.map((item) => {
                const isItemSel = (targetFolderId === null && item.id === "root") || (targetFolderId === item.id);
                return (
                  <div
                    key={item.id}
                    className={`folder-tree-picker__item ${isItemSel ? "folder-tree-picker__item--selected" : ""}`}
                    style={{ paddingLeft: 12 + item.depth * 16 }}
                    onClick={() => setTargetFolderId(item.id === "root" ? null : item.id)}
                  >
                    <span style={{ display: "inline-flex", color: isItemSel ? "var(--accent)" : "var(--ink-4)", marginRight: 8 }}>
                      {I.folder}
                    </span>
                    <span>{item.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="move-copy-modal__foot">
              <button
                className="btn btn--ghost"
                onClick={() => { setMoveModalOpen(false); setCopyModalOpen(false); setTargetFolderId(null); }}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                disabled={bulkActionBusy || targetFolderId === undefined}
                onClick={moveModalOpen ? handleBulkMove : handleBulkCopy}
              >
                {bulkActionBusy ? "Processing..." : (moveModalOpen ? "Move Assets" : "Copy Assets")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Rename Asset Modal ── */}
      {renameModalOpen && (
        <div
          className="move-copy-modal"
          onClick={() => setRenameModalOpen(false)}
        >
          <div
            className="move-copy-modal__card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380 }}
          >
            <div className="move-copy-modal__head">
              <h3>Rename Asset</h3>
              <button
                className="icon-btn icon-btn--light"
                onClick={() => setRenameModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="move-copy-modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                autoFocus
                type="text"
                className="input"
                placeholder="Asset name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameAsset();
                  if (e.key === 'Escape') setRenameModalOpen(false);
                }}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {renameError && (
                <div style={{ fontSize: 12, color: 'var(--st-failed)' }}>{renameError}</div>
              )}
            </div>
            <div className="move-copy-modal__foot" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                className="btn btn--ghost"
                onClick={() => setRenameModalOpen(false)}
                disabled={renamingAsset}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleRenameAsset}
                disabled={renamingAsset || !renameValue.trim()}
              >
                {renamingAsset ? 'Renaming…' : 'Rename'}
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

function AssetList({ assets, onSelect, selectedAssetIds, onToggleSelect }) {
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
        const isSelected = selectedAssetIds?.has(a.id);
        const statusKey = a.status || "DRAFT";
        const [cls, label] = STATUS[statusKey] ?? ["chip chip--draft", "Draft"];
        const commentsCount = a._count?.comments ?? a.comments ?? 0;
        const versionNumber = a.currentVersion ?? a.v ?? 1;
        const creatorName = a.creator?.name ?? "System";
        const creatorInitials = creatorName.split(" ").map(s => s[0]).join("").slice(0,2);
        return (
          <div
            id={`asset-card-${a.id}`}
            className={`asset-table__row ${isSelected ? "asset-table__row--selected" : ""}`}
            key={a.id || i}
            onClick={() => onSelect?.(a)}
            style={{
              cursor: 'pointer',
              position: 'relative',
              background: isSelected ? 'rgba(59, 130, 246, 0.05)' : undefined,
              borderLeft: isSelected ? '3px solid var(--accent, #3b82f6)' : undefined,
            }}
          >
            <div className="asset-table__thumb" style={{ position: 'relative', overflow: 'visible' }}>
              <div
                className={`asset-checkbox ${isSelected ? 'asset-checkbox--checked' : ''}`}
                onClick={(e) => onToggleSelect?.(a.id, e)}
                title="Select asset"
                style={{
                  opacity: isSelected ? 1 : undefined,
                  top: -4,
                  left: -4,
                  width: 14,
                  height: 14,
                }}
              />
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

function AssetCompare({ assets, onSelect, selectedAssetIds, onToggleSelect }) {
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
      <div className="asset-compare__col" id={`asset-card-${asset.id}`}>
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
            className={`asset-compare__filmstrip-item ${left === i ? "active" : ""} ${selectedAssetIds?.has(a.id) ? "asset-card--selected" : ""}`}
            onClick={() => setLeft(i)}
            style={{ position: 'relative', overflow: 'visible' }}>
            <div
              className={`asset-checkbox ${selectedAssetIds?.has(a.id) ? 'asset-checkbox--checked' : ''}`}
              onClick={(e) => onToggleSelect?.(a.id, e)}
              title="Select asset"
              style={{
                opacity: selectedAssetIds?.has(a.id) ? 1 : undefined,
                top: -4,
                left: -4,
                width: 14,
                height: 14,
              }}
            />
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
            className={`asset-compare__filmstrip-item ${right === i ? "active" : ""} ${selectedAssetIds?.has(a.id) ? "asset-card--selected" : ""}`}
            onClick={() => setRight(i)}
            style={{ position: 'relative', overflow: 'visible' }}>
            <div
              className={`asset-checkbox ${selectedAssetIds?.has(a.id) ? 'asset-checkbox--checked' : ''}`}
              onClick={(e) => onToggleSelect?.(a.id, e)}
              title="Select asset"
              style={{
                opacity: selectedAssetIds?.has(a.id) ? 1 : undefined,
                top: -4,
                left: -4,
                width: 14,
                height: 14,
              }}
            />
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
          background: 'var(--bg-card)', border: '1px solid var(--line)',
          borderRadius: 14, width: '100%', maxWidth: 1180, maxHeight: '92vh',
          display: 'grid', gridTemplateColumns: '1fr 360px',
          overflow: 'hidden', boxShadow: 'var(--sh-lg)',
          color: 'var(--ink)',
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

const formatFileSize = (bytes) => {
  if (!bytes) return "0.0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${mb.toFixed(2)} MB`;
};

function AssetSelectionBar({
  selectedAssets,
  totalSizeBytes,
  onClear,
  onUseWithAI,
  onRename,
  onDownload,
  onDelete,
  onDuplicate,
  onMoveTo,
  onCopyTo,
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Close dropdown on click outside
  const ref = React.useRef(null);
  React.useEffect(() => {
    const clickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  return (
    <div className="asset-selection-bar">
      <div className="asset-selection-bar__left">
        <button className="asset-selection-bar__clear" onClick={onClear} aria-label="Clear selection">
          ×
        </button>
        <span className="asset-selection-bar__summary">
          {selectedAssets.length} {selectedAssets.length === 1 ? "asset" : "assets"} selected
        </span>
        <span className="asset-selection-bar__meta">
          · {formatFileSize(totalSizeBytes)}
        </span>
      </div>

      <div className="asset-selection-bar__actions">
        <button className="selection-action" onClick={onUseWithAI}>Use with AI</button>

        {selectedAssets.length === 1 ? (
          <button className="selection-action" onClick={onRename}>Rename</button>
        ) : (
          <button className="selection-action" disabled title="Rename is only available for one asset">
            Rename
          </button>
        )}

        <button className="selection-action" onClick={onDownload}>Download</button>

        <div className="selection-more" ref={ref}>
          <button className="selection-action selection-action--icon" onClick={() => setMoreOpen(v => !v)}>
            …
          </button>

          {moreOpen && (
            <div className="selection-more-menu">
              <button className="selection-action--danger" onClick={() => { onDelete(); setMoreOpen(false); }}>Delete</button>
              <button onClick={() => { onDuplicate(); setMoreOpen(false); }}>Duplicate</button>
              <button onClick={() => { onMoveTo(); setMoreOpen(false); }}>Move to</button>
              <button onClick={() => { onCopyTo(); setMoreOpen(false); }}>Copy to</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ProjectMgmt = ProjectMgmt;
window.AssetList = AssetList;
window.AssetCompare = AssetCompare;
window.AssetReviewModal = AssetReviewModal;