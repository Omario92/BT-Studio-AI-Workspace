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

  React.useEffect(() => {
    try { localStorage.setItem("bt_theme", theme); } catch (e) {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  React.useEffect(() => {
    try { localStorage.setItem("bt_screen", screen); } catch (e) {}
  }, [screen]);

  const onChange = (id) => setScreen(id);

  // Login is its own full-bleed view
  if (screen === "login") return <Login onLogin={() => setScreen("dashboard")} />;

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
      case "projects":  return <ProjectMgmt />;
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
        <Topbar crumbs={crumbsMap[screen] || []} theme={theme} onToggleTheme={toggleTheme} />
        {wantsTight
          ? <div style={{flex:1, overflow:"hidden", display:"flex", flexDirection:"column"}}>{content}</div>
          : content}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
