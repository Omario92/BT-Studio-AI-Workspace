const TREE = [
  { id: "huda",   label: "Huda Commercial", open: true, depth: 0, icon: I.folder, count: "32" },
  { id: "brief",  label: "Brief",       depth: 1, icon: I.folder, count: "4" },
  { id: "script", label: "Script.md",   depth: 1, icon: I.doc },
  { id: "sketch", label: "Sketches",    depth: 1, icon: I.folder, count: "18" },
  { id: "ref",    label: "References",  depth: 1, icon: I.folder, count: "26" },
  { id: "gen",    label: "Generated",   depth: 1, icon: I.folder, count: "84", active: true },
  { id: "final",  label: "Final Output",depth: 1, icon: I.folder, count: "6" },
  { id: "halida", label: "Halida Fresh Beer", depth: 0, icon: I.folder, count: "47" },
  { id: "excool", label: "Coolmate Excool KV",depth: 0, icon: I.folder, count: "29" },
  { id: "obagi",  label: "Obagi Skin Lab",    depth: 0, icon: I.folder, count: "18" },
];

const ASSETS = [
  { name: "KV_Hero_Image_v4.png",     v: "v4", status: "approved",  comments: 8, tone: "rose"    },
  { name: "Character_Sheet_v2.jpg",   v: "v2", status: "wip",       comments: 4, tone: "amber"   },
  { name: "Frame_18_v3.png",          v: "v3", status: "approved",  comments: 12,tone: "neutral" },
  { name: "Environment_Ref_v1.png",   v: "v1", status: "wip",       comments: 4, tone: "teal"    },
  { name: "Environment_Ref_v2.png",   v: "v2", status: "draft",     comments: 1, tone: "green"   },
  { name: "Product_Render_v3.png",    v: "v3", status: "approved",  comments: 6, tone: "violet"  },
  { name: "Style_Sheet_Final.png",    v: "v6", status: "wip",       comments: 9, tone: "mono"    },
  { name: "Frame_19_v1.png",          v: "v1", status: "draft",     comments: 0, tone: "rose"    },
  { name: "Frame_20_v2.png",          v: "v2", status: "failed",    comments: 3, tone: "neutral" },
  { name: "Bottle_Hero_v1.png",       v: "v1", status: "generating",comments: 0, tone: "blue"    },
  { name: "Lab_Interior_v2.png",      v: "v2", status: "approved",  comments: 5, tone: "rose"    },
  { name: "Skin_Closeup_v1.png",      v: "v1", status: "draft",     comments: 2, tone: "amber"   },
  { name: "KV_Composite_v5.png",      v: "v5", status: "wip",       comments: 11,tone: "violet"  },
  { name: "Frame_21_v1.png",          v: "v1", status: "approved",  comments: 4, tone: "teal"    },
  { name: "Bottle_Pour_v2.png",       v: "v2", status: "wip",       comments: 7, tone: "green"   },
];

const STATUS = {
  draft:      ["chip chip--draft",     "Draft"],
  wip:        ["chip chip--wip",       "WIP"],
  approved:   ["chip chip--approved",  "Approved"],
  failed:     ["chip chip--failed",    "Failed"],
  generating: ["chip chip--generating","Generating"],
};

function ProjectMgmt() {
  const [active, setActive] = React.useState("gen");
  const [view, setView] = React.useState("grid");
  const [treeCollapsed, setTreeCollapsed] = React.useState(() => {
    try { return localStorage.getItem("bt_pm_tree") === "1"; } catch (e) { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("bt_pm_tree", treeCollapsed ? "1" : "0"); } catch (e) {}
  }, [treeCollapsed]);

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
          <button className="icon-btn icon-btn--light" title="New folder">{I.plus}</button>
          <button
            className="icon-btn icon-btn--light"
            title="Hide file tree"
            onClick={() => setTreeCollapsed(true)}>{I.panelLeft}</button>
        </div>

        {TREE.map(node => (
          <button
            key={node.id}
            className={`tree__row ${active === node.id ? "active" : ""}`}
            style={{paddingLeft: 18 + node.depth * 16}}
            onClick={() => setActive(node.id)}>
            <span className="tree__caret">
              {node.count ? (node.open ? I.chevDownTiny : I.chevRightTiny) : null}
            </span>
            <span style={{color:"var(--ink-3)", display: "inline-flex"}}>{node.icon}</span>
            <span style={{flex:1}}>{node.label}</span>
            {node.count ? <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--ink-4)"}}>{node.count}</span> : null}
          </button>
        ))}
      </aside>

      <div className="pm__main">
        <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:6}}>
          <div>
            <div className="crumbs">PROJECTS / <strong>HUDA COMMERCIAL</strong> / GENERATED</div>
            <h1 className="page-title" style={{marginTop:4}}>Huda Commercial</h1>
          </div>
          <div style={{flex:1}} />
          <button className="btn btn--secondary">{I.upload}<span>Upload</span></button>
          <button className="btn btn--secondary">{I.filter}<span>Filter</span></button>
          <button className="btn btn--primary">{I.spark}<span>Open in AI Workspace</span></button>
        </div>
        <p className="page-sub">84 generated files · last activity 12 minutes ago</p>

        {/* Project info card */}
        <div className="project-card-info">
          <div className="info-cell">
            <div className="k">Project Name</div>
            <div className="v">Huda Commercial</div>
          </div>
          <div className="info-cell">
            <div className="k">Client / Brand</div>
            <div className="v">Beauty Lab Studios</div>
          </div>
          <div className="info-cell">
            <div className="k">Deadline</div>
            <div className="v">Oct 25, 2024 <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--st-wip)", marginLeft:8}}>· 8d left</span></div>
          </div>
          <div className="info-cell">
            <div className="k">Status</div>
            <div className="v"><span className="chip chip--wip"><span className="dot-status dot-status--wip"/>Work in progress</span></div>
          </div>

          <div className="info-cell info-cell--full" style={{display:"flex", alignItems:"center", gap:32, paddingTop:18, borderTop:"1px solid var(--line-2)"}}>
            <div>
              <div className="k">Assigned Team</div>
              <div style={{display:"flex", alignItems:"center", gap:8, marginTop:8}}>
                <div className="avatar-stack">
                  <div className="avatar avatar--a sm">AC</div>
                  <div className="avatar avatar--b sm">DK</div>
                  <div className="avatar avatar--c sm">SM</div>
                  <div className="avatar avatar--d sm">MR</div>
                  <div className="avatar avatar--e sm">TL</div>
                </div>
                <span style={{fontSize:12, color:"var(--ink-3)", marginLeft:6}}>Alice Chen, David Kim, Sarah M., Maria R., Tom L.</span>
              </div>
            </div>
            <div style={{marginLeft:"auto", display:"flex", gap:28}}>
              <div className="info-cell">
                <div className="k">Frames</div>
                <div className="v tabular">84 / 120</div>
              </div>
              <div className="info-cell">
                <div className="k">Approval Rate</div>
                <div className="v tabular">76%</div>
              </div>
              <div className="info-cell">
                <div className="k">Last Edit</div>
                <div className="v">12 min ago · Sarah M.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-title" style={{marginTop:0}}>
          <h2>Generated Files</h2>
          <span className="count">{ASSETS.length} OF 84</span>
          <span className="spacer" />
          <div className="segmented">
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Grid</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
            <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>Compare</button>
          </div>
        </div>

        {view === "grid" ? (
          <div className="asset-grid">
            {ASSETS.map((a, i) => {
              const [cls, label] = STATUS[a.status];
              return (
                <div className="asset-card" key={i}>
                  <div className="asset-card__thumb">
                    <Placeholder tone={a.tone} label={a.name.split("_")[0]} style={{height:"100%", borderRadius:0}} />
                  </div>
                  <div className="asset-card__body">
                    <div className="asset-card__title-row">
                      <span className="asset-card__name">{a.name}</span>
                      <span className="chip chip--version">{a.v}</span>
                    </div>
                    <div className="asset-card__meta-row">
                      <span className="asset-card__meta">{I.comment}<span>{a.comments}</span></span>
                      <span className={cls}>{label}</span>
                    </div>
                    <div className="asset-card__meta-row">
                      <div className="avatar-stack">
                        <div className={`avatar avatar--${"abcdef"[i%6]} sm`}>{"ABCDEF"[i%6]}</div>
                        <div className={`avatar avatar--${"abcdef"[(i+1)%6]} sm`}>{"ABCDEF"[(i+1)%6]}</div>
                      </div>
                      <span style={{fontFamily:"var(--f-mono)", fontSize:10, color:"var(--ink-4)"}}>2h ago</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "list" ? (
          <AssetList assets={ASSETS} />
        ) : (
          <AssetCompare assets={ASSETS} />
        )}
      </div>
    </div>
  );
}

// Generate richer rows by combining the ASSETS list with synthesized fields
const SIZES = ["1.2 MB", "3.8 MB", "5.1 MB", "820 KB", "2.4 MB", "7.2 MB", "4.6 MB", "1.9 MB"];
const RES   = ["2048×2048", "1920×1080", "4096×4096", "1024×1024", "1080×1920", "3840×2160"];
const AUTHORS = [
  { i: "AC", c: "a", n: "Alice Chen"   },
  { i: "DK", c: "b", n: "David Kim"    },
  { i: "SM", c: "c", n: "Sarah M."     },
  { i: "MR", c: "d", n: "Maria R."     },
  { i: "TL", c: "e", n: "Tom L."       },
];

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
        const [cls, label] = STATUS[a.status];
        const author = AUTHORS[i % AUTHORS.length];
        return (
          <div className="asset-table__row" key={i}>
            <div className="asset-table__thumb">
              <Placeholder tone={a.tone} label="" style={{height:"100%", borderRadius: 0}} />
            </div>
            <div style={{display:"flex", flexDirection:"column", gap: 2, minWidth: 0}}>
              <span className="asset-table__name">{a.name}</span>
              <span className="asset-table__meta">{I.comment}<span style={{marginLeft:4}}>{a.comments}</span> · seed 0xA{(7+i).toString(16).toUpperCase()}F4</span>
            </div>
            <span><span className="chip chip--version">{a.v}</span></span>
            <span><span className={cls}>{label}</span></span>
            <span className="asset-table__size">{SIZES[i % SIZES.length]}</span>
            <span className="asset-table__size">{RES[i % RES.length]}</span>
            <span className="asset-table__date col-modified" style={{display:"flex", alignItems:"center", gap: 8}}>
              <span className={`avatar avatar--${author.c} sm`}>{author.i}</span>
              <span>{i % 3 === 0 ? "12m" : i % 3 === 1 ? "2h" : "Yesterday"}</span>
            </span>
            <button className="icon-btn icon-btn--light" onClick={e => e.stopPropagation()}>{I.more}</button>
          </div>
        );
      })}
    </div>
  );
}

function AssetCompare({ assets }) {
  const [left, setLeft]   = React.useState(2);
  const [right, setRight] = React.useState(5);
  const A = assets[left], B = assets[right];

  const renderCol = (asset, side, onPick) => {
    const [cls, label] = STATUS[asset.status];
    return (
      <div className="asset-compare__col">
        <div className="asset-compare__col-head">
          <span style={{fontFamily:"var(--f-mono)", fontSize: 10.5, letterSpacing:"0.12em", color:"var(--ink-4)"}}>{side}</span>
          <span style={{fontFamily:"var(--f-mono)", fontSize: 12.5, color:"var(--ink)", flex: 1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{asset.name}</span>
          <span className="chip chip--version">{asset.v}</span>
          <span className={cls}>{label}</span>
        </div>
        <div className="asset-compare__art">
          <Placeholder tone={asset.tone} label={asset.name.split("_")[0]} style={{height:"100%", borderRadius: 0}} />
        </div>
        <dl className="asset-compare__meta">
          <dt>Resolution</dt><dd>{RES[(side === "Left" ? left : right) % RES.length]}</dd>
          <dt>Size</dt><dd>{SIZES[(side === "Left" ? left : right) % SIZES.length]}</dd>
          <dt>Comments</dt><dd>{asset.comments}</dd>
          <dt>Modified</dt><dd>{side === "Left" ? "2h ago · Alice Chen" : "12m ago · Sarah M."}</dd>
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
        {renderCol(A, "Left")}
        {renderCol(B, "Right")}
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
            <Placeholder tone={a.tone} label="" style={{height:"100%", borderRadius: 0}} />
            <span className="badge-mini">{a.v}</span>
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
            <Placeholder tone={a.tone} label="" style={{height:"100%", borderRadius: 0}} />
            <span className="badge-mini">{a.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ProjectMgmt = ProjectMgmt;
window.AssetList = AssetList;
window.AssetCompare = AssetCompare;