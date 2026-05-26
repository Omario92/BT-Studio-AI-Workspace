function Topbar({
  crumbs = [],
  onLogout,
  hideSearch = false,
  right,
  theme = "light",
  onToggleTheme,
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  notifications = [],
  onNotificationOpen,
}) {
  const isDark = theme === "dark";
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const notifRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  React.useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    const clickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      onSearchSubmit?.(searchQuery);
    } else if (e.key === "Escape") {
      onClearSearch?.();
      searchInputRef.current?.blur();
    }
  };

  const hasUnread = notifications.some(n => n.unread);

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
        <div className="topbar__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{color: "var(--ink-4)", marginRight: 8}}>{I.search}</span>
          <input
            ref={searchInputRef}
            placeholder="Search projects, assets, prompts…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--ink)' }}
          />
          {searchQuery ? (
            <button
              onClick={onClearSearch}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-4)',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 'bold',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Clear search"
            >
              ×
            </button>
          ) : (
            <kbd style={{ userSelect: 'none' }}>⌘K</kbd>
          )}
        </div>
      )}

      <div className="topbar__actions">
        {right}
        
        {/* Notifications (v7.0) */}
        <div className="topbar-notification" ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="icon-btn icon-btn--light notification-button"
            title="Notifications"
            onClick={() => setNotificationOpen(v => !v)}
          >
            {I.bell}
            {hasUnread && <span className="notification-dot" />}
          </button>

          {notificationOpen && (
            <div className="notification-popover">
              <div className="notification-popover__header">
                <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn--ghost sm"
                    style={{ padding: "4px 8px", fontSize: 11, height: "auto" }}
                    onClick={() => { onNotificationOpen?.("mark-all-read"); }}
                  >
                    Mark all read
                  </button>
                  <button
                    className="btn btn--primary sm"
                    style={{ padding: "4px 8px", fontSize: 11, height: "auto" }}
                    onClick={() => { onNotificationOpen?.("activity"); setNotificationOpen(false); }}
                  >
                    View Activity
                  </button>
                </div>
              </div>
              <div className="notification-popover__body" style={{ maxHeight: 320, overflowY: "auto" }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 12.5 }}>
                    No new notifications.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notification-item ${n.unread ? "notification-item--unread" : ""}`}
                      onClick={() => {}}
                    >
                      <div className="notification-item__title">
                        {n.title}
                      </div>
                      <div className="notification-item__description">{n.description}</div>
                      <div className="notification-item__time">{n.time}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
