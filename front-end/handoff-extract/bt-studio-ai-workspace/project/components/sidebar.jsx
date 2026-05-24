const NAV_PRIMARY = [
  { id: "dashboard", label: "Dashboard", icon: I.dashboard },
  { id: "projects",  label: "Projects",  icon: I.folder, count: "24" },
  { id: "workspace", label: "AI Workspace", icon: I.spark },
  { id: "batch",     label: "Batch Mode",   icon: I.layers, count: "3" },
  { id: "timeline",  label: "Storyboard",   icon: I.brush },
];

const NAV_SECONDARY = [
  { id: "templates", label: "Template Library", icon: I.book },
  { id: "activity",  label: "Activity Log",     icon: I.clock, count: "12" },
  { id: "assets",    label: "Asset DB",         icon: I.database },
  { id: "team",      label: "Team",             icon: I.team },
];

function Sidebar({ active, onChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img className="brand-logo" src="assets/brand-logo.webp" alt="BT Studio" />
        <div className="brand-tag">BT · AI Workspace</div>
      </div>

      <div className="nav-section-label">Production</div>
      {NAV_PRIMARY.map(item => (
        <button key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}>
          <span className="nav-ico">{item.icon}</span>
          <span>{item.label}</span>
          {item.count ? <span className="nav-count">{item.count}</span> : null}
        </button>
      ))}

      <div className="nav-section-label">Studio</div>
      {NAV_SECONDARY.map(item => (
        <button key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}>
          <span className="nav-ico">{item.icon}</span>
          <span>{item.label}</span>
          {item.count ? <span className="nav-count">{item.count}</span> : null}
        </button>
      ))}

      <div className="sidebar__divider" />

      <button className="nav-item" onClick={() => onChange("settings")}>
        <span className="nav-ico">{I.settings}</span>
        <span>Admin Settings</span>
      </button>

      <div className="sidebar__profile">
        <div className="avatar avatar--a">AC</div>
        <div className="sidebar__profile-meta">
          <div className="sidebar__profile-name">Alice Chen</div>
          <div className="sidebar__profile-role">Art Director</div>
        </div>
        <div className="sidebar__profile-actions">
          <button className="icon-btn" title="Log out" onClick={() => onChange("login")}>{I.logout}</button>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
