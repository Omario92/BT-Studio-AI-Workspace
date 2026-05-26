function App() {
  const [screen, setScreen] = React.useState(() => {
    const stored = (() => { try { return localStorage.getItem("bt_screen"); } catch(e) { return null; } })();
    return stored || "login";
  });
  const [activeToolId, setActiveToolId] = React.useState(() => {
    try { return localStorage.getItem("bt_tool") || null; } catch (e) { return null; }
  });
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem("bt_theme") || "light"; } catch (e) { return "light"; }
  });
  const [currentUser, setCurrentUser] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);

  const [globalSearch, setGlobalSearch] = React.useState("");
  const [notifications, setNotifications] = React.useState([
    {
      id: "upload-complete",
      title: "Upload completed",
      description: "Your asset was synced to Cloudflare storage.",
      time: "Just now",
      unread: true,
      type: "upload"
    },
    {
      id: "batch-ready",
      title: "Batch job ready",
      description: "4 assets are waiting for review.",
      time: "12m ago",
      unread: true,
      type: "job"
    }
  ]);

  React.useEffect(() => {
    const handleClear = () => setGlobalSearch("");
    window.addEventListener("bt:clear-global-search", handleClear);
    return () => window.removeEventListener("bt:clear-global-search", handleClear);
  }, []);

  React.useEffect(() => {
    const token = apiClient.auth.getToken();
    if (!token) {
      setScreen("login");
      setLoadingProfile(false);
      return;
    }
    apiClient.auth.getMe()
      .then(user => {
        setCurrentUser(user);
        if (screen === "login") setScreen("dashboard");
      })
      .catch(() => {
        apiClient.auth.logout();
        setScreen("login");
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem("bt_theme", theme); } catch (e) {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  React.useEffect(() => {
    try { localStorage.setItem("bt_screen", screen); } catch (e) {}
  }, [screen]);

  const onChange = (id) => {
    if (id === "login") {
      apiClient.auth.logout();
      setCurrentUser(null);
    }
    setScreen(id);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setScreen("dashboard");
  };

  if (loadingProfile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg-canvas)", color: "var(--ink)" }}>
        <div style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot-status dot-status--generating" style={{ width: 12, height: 12, display: "inline-block" }} />
          Loading BT Studio Workspace...
        </div>
      </div>
    );
  }

  // Login is its own full-bleed view
  if (screen === "login" || !currentUser) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  const crumbsMap = {
    dashboard:  ["BT Studio", "Dashboard"],
    projects:   ["BT Studio", "Projects", "Huda Commercial"],
    workspace:  (() => {
      const base = ["BT Studio", "AI Workspace"];
      if (activeToolId && window.TOOLS) {
        const t = window.TOOLS.find(x => x.id === activeToolId);
        if (t) return [...base, t.name];
      }
      return base;
    })(),
    batch:      ["BT Studio", "Batch Mode", "Job EX-2487"],
    timeline:   ["BT Studio", "Storyboard", "Halida · Act 02"],
    templates:  ["BT Studio", "Template Library"],
    activity:   ["BT Studio", "Activity Log"],
    assets:     ["BT Studio", "Asset DB"],
    team:       ["BT Studio", "Team"],
    settings:   ["BT Studio", "Admin Settings"],
  };

  const titles = {
    dashboard: "Dashboard",
    projects: "Project Management",
    workspace: "AI Workspace",
    batch: "Batch Mode",
    timeline: "Storyboard",
    templates: "Template Library",
    activity: "Activity Log",
  };

  const content = (() => {
    switch (screen) {
      case "dashboard": return <Dashboard />;
      case "projects":  return <ProjectMgmt searchQuery={globalSearch} />;
      case "workspace": return <AIWorkspace onSwitchScreen={setScreen} onActiveToolChange={setActiveToolId} />;
      case "batch":     return <BatchMode />;
      case "timeline":  return <StoryboardView />;
      case "templates": return <TemplateLibrary />;
      case "activity":  return <ActivityLog />;
      default:
        return (
          <div className="page">
            <div className="crumbs">BT STUDIO / <strong>{(titles[screen] || screen).toUpperCase()}</strong></div>
            <h1 className="page-title" style={{marginTop:4}}>{titles[screen] || screen}</h1>
            <p className="page-sub">This area is part of the prototype but not yet wired up.</p>
            <div className="card card--pad" style={{padding: 32, textAlign: "center", color:"var(--ink-3)"}}>
              <div style={{fontFamily:"var(--f-mono)", letterSpacing:"0.10em", fontSize:11, color:"var(--ink-4)", marginBottom:10}}>PLACEHOLDER</div>
              <div>Pick another module from the sidebar to continue exploring.</div>
            </div>
          </div>
        );
    }
  })();

  // For canvas-heavy screens (workspace / batch / timeline / activity / projects)
  // we want the topbar visible but content fills the rest tightly.
  const wantsTight = ["workspace","batch","timeline","activity","projects"].includes(screen);

  return (
    <div className="app">
      <Sidebar active={screen} onChange={onChange} />
      <main className="workspace">
        <Topbar
          crumbs={crumbsMap[screen] || []}
          theme={theme}
          onToggleTheme={toggleTheme}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          onSearchSubmit={(q) => {
            if (!q.trim()) return;
            if (screen !== "projects") {
              setScreen("projects");
            }
            window.dispatchEvent(new CustomEvent("bt:global-search-submit", { detail: { query: q } }));
          }}
          onClearSearch={() => setGlobalSearch("")}
          notifications={notifications}
          onNotificationOpen={(action) => {
            if (action === "activity") setScreen("activity");
            if (action === "mark-all-read") {
              setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
            }
          }}
        />
        {wantsTight
          ? <div style={{flex:1, overflow:"hidden", display:"flex", flexDirection:"column"}}>{content}</div>
          : content}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
