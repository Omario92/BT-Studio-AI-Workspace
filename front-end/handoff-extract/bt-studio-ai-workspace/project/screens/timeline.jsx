// Build 24 frames with grouped statuses across two rows
const FRAMES = (() => {
  const groups = [
    { count: 2, status: "draft" },
    { count: 4, status: "wip"   },
    { count: 4, status: "approved" },
    { count: 2, status: "draft" },
    { count: 2, status: "draft" },
    { count: 3, status: "wip"   },
    { count: 3, status: "approved" },
    { count: 2, status: "wip"   },
    { count: 2, status: "draft" },
  ];
  const tones = ["mono","neutral","mono","mono","amber","green","mono","mono","neutral","neutral","amber","mono","mono","green","mono","neutral","amber","amber","amber","mono","neutral","neutral","mono","mono"];
  let arr = [], n = 1;
  groups.forEach(g => {
    const start = n;
    for (let i = 0; i < g.count; i++, n++) arr.push({ n, status: g.status, tone: tones[(n-1) % tones.length], groupStart: i === 0, groupEnd: i === g.count - 1, groupSize: g.count });
    arr[arr.length-1].groupRange = `${start}–${n-1}`;
  });
  return arr;
})();

function groupConsecutive(frames) {
  // Group adjacent same-status frames into chunks
  const out = []; let cur = null;
  frames.forEach((f, i) => {
    if (!cur || cur.status !== f.status) {
      cur = { status: f.status, items: [] };
      out.push(cur);
    }
    cur.items.push(f);
  });
  return out;
}

function StoryboardView() {
  const [selected, setSelected] = React.useState(7);
  const sel = FRAMES[selected];

  const rows = [FRAMES.slice(0, 12), FRAMES.slice(12, 24)];

  const statusLabels = {
    draft: "Draft", wip: "Work-in-progress", approved: "Approved", failed: "Failed"
  };

  return (
    <div className="story">
      <div className="story__top">
        <div>
          <div className="crumbs">PROJECTS / <strong>HALIDA FRESH BEER</strong> / STORYBOARD</div>
          <h1 className="page-title" style={{marginTop:4}}>Timeline Storyboard</h1>
          <p className="page-sub" style={{marginBottom:0}}>Act 02 · 24 frames · 18 / 24 reviewed · last update 9 min ago</p>
        </div>
        <div className="spacer"/>
        <div className="segmented">
          <button className="active">All</button>
          <button>Draft</button>
          <button>WIP</button>
          <button>Approved</button>
        </div>
        <button className="btn btn--secondary">{I.download}<span>Export PDF</span></button>
        <button className="btn btn--primary">{I.plus}<span>Add frame</span></button>
      </div>

      <div className="story__strip-wrap">
        {rows.map((row, r) => {
          const groups = groupConsecutive(row);
          return (
            <div key={r} style={{display:"flex", flexDirection:"column", gap:6, marginBottom: r === 0 ? 18 : 0}}>
              {/* Frames row */}
              <div style={{display:"flex"}}>
                {row.map((f, i) => (
                  <div key={i}
                    className={`frame ${selected === FRAMES.indexOf(f) ? "active" : ""}`}
                    onClick={() => setSelected(FRAMES.indexOf(f))}>
                    <span className="frame__no">{String(f.n).padStart(2,"0")}</span>
                    <div className="frame__art"><FramePh tone={f.tone} /></div>
                    {f.status === "approved" ? (
                      <span style={{
                        position:"absolute", top:4, right:4,
                        background:"var(--st-approved)", color:"#fff",
                        borderRadius:999, width:14, height:14,
                        display:"grid", placeItems:"center"
                      }}>
                        <span style={{display:"inline-flex"}}>
                          <Icon size={10} d={<path d="M3 8.5 6.5 12 13 4.5" />} stroke={2.6} />
                        </span>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Status track row */}
              <div style={{display:"flex"}}>
                {groups.map((g, i) => {
                  const w = g.items.length * 160; // 152 + 8 gap
                  return (
                    <div key={i} className={`status-track status-track--${g.status}`}
                      style={{width: w - 8, marginRight: 8}}>
                      <span style={{flex:1}}>{statusLabels[g.status]}</span>
                      <span style={{fontSize:9, opacity:0.7}}>{g.items.length} frames</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="story__detail">
        <div className="story__detail-art">
          <FramePh tone={sel.tone} />
        </div>
        <div className="detail-meta">
          <div>
            <div className="detail-h">Selected frame detail</div>
            <h2 className="detail-title">Frame {sel.n}: "Hero's Arrival"</h2>
            <div className="detail-num">FRAME_{String(sel.n).padStart(2,"0")} · SHOT 04A · INT/EXT</div>
          </div>
          <p className="detail-desc">
            Scene opens with the protagonist entering the city gates at dawn. Long
            shot establishing the scale of the metropolis. Warm rim-light from the
            rising sun, cool tones in the shadow side. Slow dolly-in on camera 1.
          </p>
          <dl className="detail-kv">
            <dt>Artist</dt><dd>Alice Chen <span style={{color:"var(--ink-4)", marginLeft:6, fontFamily:"var(--f-mono)", fontSize:11}}>· AC</span></dd>
            <dt>Date</dt><dd>Oct 26, 2024 · 14:42</dd>
            <dt>Lens</dt><dd>35mm · f/2.8</dd>
            <dt>Status</dt><dd><span className={`chip chip--${sel.status === "wip" ? "wip" : sel.status}`}>{statusLabels[sel.status]}</span></dd>
            <dt>Version</dt><dd><span className="chip chip--version">v3</span> · 4 prior</dd>
            <dt>Reviewers</dt><dd>
              <div className="avatar-stack" style={{display:"inline-flex"}}>
                <div className="avatar avatar--a sm">AC</div>
                <div className="avatar avatar--b sm">DK</div>
                <div className="avatar avatar--c sm">SM</div>
              </div>
            </dd>
          </dl>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          <button className="btn btn--primary btn--lg" style={{width:"100%", justifyContent:"center"}}>
            {I.spark}<span>Open Frame in AI Workspace</span>
          </button>
          <button className="btn btn--secondary" style={{width:"100%", justifyContent:"center"}}>
            {I.comment}<span>Open comments (8)</span>
          </button>
          <button className="btn btn--secondary" style={{width:"100%", justifyContent:"center"}}>
            {I.refresh}<span>View version history</span>
          </button>
          <div style={{
            padding:"12px 14px",
            border:"1px solid var(--line)",
            borderRadius:10,
            background:"var(--bg-card)",
            display:"flex", flexDirection:"column", gap:8
          }}>
            <div className="detail-h">Pre-vis notes</div>
            <p style={{margin:0, fontSize:12, color:"var(--ink-3)", lineHeight:1.5}}>
              Match camera-rule preset “Wide Establishing 03”. Hold on this beat 2.4s before cut.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

window.StoryboardView = StoryboardView;
