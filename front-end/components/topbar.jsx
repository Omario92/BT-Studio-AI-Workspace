function Topbar({ crumbs = [], onLogout, hideSearch = false, right, theme = "light", onToggleTheme }) {
  const isDark = theme === "dark";
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <span style={{margin: "0 8px", color: "var(--ink-5)"}}>/</span> : null}
            {i === crumbs.length - 1
              ? <strong>{c}</strong>
              : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>

      {hideSearch ? <div style={{flex:1}} /> : (
        <div className="topbar__search">
          <span style={{color: "var(--ink-4)"}}>{I.search}</span>
          <input placeholder="Search projects, assets, prompts…" />
          <kbd>⌘K</kbd>
        </div>
      )}

      <div className="topbar__actions">
        {right}
        <button className="icon-btn icon-btn--light notif-btn" title="Notifications">
          {I.bell}<span className="dot" />
        </button>
        <button
          className="icon-btn icon-btn--light"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
          onClick={onToggleTheme}>
          {isDark ? I.sun : I.moon}
        </button>
        <div style={{width:1, height:24, background: "var(--line)", margin: "0 6px"}} />
        <div className="avatar avatar--a" style={{width:34, height:34, fontSize: 12}}>AC</div>
      </div>
    </div>
  );
}

window.Topbar = Topbar;
