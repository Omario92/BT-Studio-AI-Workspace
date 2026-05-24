const TEMPLATES = [
  {
    cat: "Key Visual",
    name: "KV Commercial",
    desc: "High-impact product key visuals — hero shot, supporting cuts, and platform crops.",
    tone: "amber", presets: 6, uses: "284 runs", lockable: true
  },
  {
    cat: "Storyboard",
    name: "Storyboard Cinematic",
    desc: "Narrative-driven storyboard frames with shot-list, lens, and lighting metadata.",
    tone: "mono", presets: 12, uses: "612 runs", lockable: true
  },
  {
    cat: "Character",
    name: "Character Style Sheet",
    desc: "Define consistent character models, turnarounds and expression sheets.",
    tone: "rose", presets: 9, uses: "147 runs", lockable: true
  },
  {
    cat: "Color",
    name: "Color Palette Preset",
    desc: "Pre-defined color harmonies for consistent branding across campaign assets.",
    tone: "violet", presets: 24, uses: "1.2k runs", lockable: false
  },
  {
    cat: "Camera",
    name: "Camera Rule Preset",
    desc: "Predefined camera angles, focal lengths and shot rules. Hooks into shot-list.",
    tone: "teal", presets: 18, uses: "412 runs", lockable: false
  },
  {
    cat: "Environment",
    name: "Environment Pack — Urban",
    desc: "City exteriors, interiors and weather variants. Pairs with character refs.",
    tone: "blue", presets: 22, uses: "208 runs", lockable: true
  },
  {
    cat: "Product",
    name: "Product Render Studio",
    desc: "Bottle, packaging and accessory render presets with seamless backgrounds.",
    tone: "green", presets: 14, uses: "346 runs", lockable: true
  },
  {
    cat: "Lighting",
    name: "Lighting Setup Library",
    desc: "Soft-box, rim, hard-light and golden hour configurations as one-click presets.",
    tone: "amber", presets: 8, uses: "182 runs", lockable: false
  },
];

function TemplateLibrary() {
  const [cat, setCat] = React.useState("All");
  const categories = ["All", "Key Visual", "Storyboard", "Character", "Color", "Camera", "Environment", "Product", "Lighting"];

  const shown = cat === "All" ? TEMPLATES : TEMPLATES.filter(t => t.cat === cat);

  return (
    <div className="page">
      <div style={{display:"flex", alignItems:"flex-end", gap:14, marginBottom: 6}}>
        <div>
          <div className="crumbs">STUDIO / <strong>TEMPLATE LIBRARY</strong></div>
          <h1 className="page-title" style={{marginTop:4}}>Template Library</h1>
        </div>
        <div style={{flex:1}} />
        <button className="btn btn--secondary">{I.upload}<span>Import preset</span></button>
        <button className="btn btn--primary">{I.plus}<span>New template</span></button>
      </div>
      <p className="page-sub">Reusable production templates for creative workflows. Studio-wide, shared across all projects.</p>

      <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", margin:"22px 0 18px"}}>
        {categories.map(c => (
          <button key={c}
            className={`btn ${cat === c ? "btn--dark" : "btn--secondary"}`}
            style={{padding:"6px 12px", fontSize:12}}
            onClick={() => setCat(c)}>{c}</button>
        ))}
        <span style={{flex:1}} />
        <span style={{fontFamily:"var(--f-mono)", fontSize:11, color:"var(--ink-4)"}}>{shown.length} TEMPLATES</span>
      </div>

      <div className="grid-cards cards-3">
        {shown.map((t, i) => (
          <div className="template-card" key={i}>
            <div className="template-card__thumb">
              <Placeholder tone={t.tone} label={t.cat.toUpperCase()} style={{height:"100%", borderRadius:0}} />
            </div>
            <div className="template-card__body">
              <div className="template-card__cat">{t.cat}</div>
              <div className="template-card__title">{t.name}</div>
              <p className="template-card__desc">{t.desc}</p>
              <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
                <span className="chip chip--version">{t.presets} presets</span>
                {t.lockable ? <span className="chip chip--approved" style={{textTransform:"none"}}><span style={{display:"inline-flex"}}>{I.lock}</span>Lockable</span> : null}
              </div>
              <div className="template-card__foot">
                <span>{t.uses}</span>
                <span className="spacer" />
                <button className="btn btn--secondary" style={{padding:"6px 10px", fontSize:12}}>Preview</button>
                <button className="btn btn--primary" style={{padding:"6px 12px", fontSize:12}}>Apply</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.TemplateLibrary = TemplateLibrary;
