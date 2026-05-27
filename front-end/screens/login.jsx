function Login({ onLogin }) {
  const [email, setEmail] = React.useState("alice@btstudio.ai");
  const [pwd, setPwd]   = React.useState("password123");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !pwd) {
      setErrorMsg("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiClient.auth.login(email, pwd);
      onLogin(data.user);
    } catch (err) {
      if (err.offline) {
        // Backend offline — fall back to mock user so preview still works
        onLogin({
          id: 'usr_alice',
          name: 'Alice Chen',
          email: email || 'alice@btstudio.ai',
          role: 'ADMIN',
          avatarUrl: null,
        });
        return;
      }
      setErrorMsg(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      {/* Left — brand panel */}
      <div className="login__art">
        <div className="login__brand">
          <img className="brand-logo" src="assets/brand-logo.webp" alt="BT Studio" />
          <div className="login__brand-sub">BT · AI Workspace · v4.2</div>
        </div>

        <div className="login__hero">
          <h1>
            The internal OS for<br/>AI creative production.
            <em>// references → prompts → frames → approvals</em>
          </h1>
          <p>Generate, version, review, and ship AI-assisted assets without ever
             leaving the studio. Character consistency, batch generation, and
             approval pipelines built in.</p>

          <div className="login__stats">
            <div className="login__stat">
              <div className="v">24</div>
              <div className="k">Active Projects</div>
            </div>
            <div className="login__stat">
              <div className="v">1,287</div>
              <div className="k">Frames This Week</div>
            </div>
            <div className="login__stat">
              <div className="v">98.4<span style={{fontSize:14, color: "var(--ink-on-dark-3)"}}>%</span></div>
              <div className="k">Gen Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="login__form-wrap">
        <form className="login__form" onSubmit={handleSubmit}>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use your studio SSO credentials.</p>

          {errorMsg && (
            <div style={{ background: "var(--st-failed-bg)", color: "var(--st-failed)", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {errorMsg}
            </div>
          )}

          <div className="field">
            <label className="field__label">Work email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@btstudio.io" required />
          </div>

          <div className="field">
            <label className="field__label">
              Password
              <span className="field__hint" style={{marginLeft: "auto"}}>SSO · OKTA</span>
            </label>
            <input className="input" type="password" value={pwd} onChange={e => setPwd(e.target.value)} required />
          </div>

          <div className="login__remember">
            <button
              type="button"
              className={`checkbox ${remember ? "checkbox--on" : ""}`}
              onClick={() => setRemember(r => !r)}
            >
              <span className="checkbox__box" />
              Remember me on this device
            </button>
            <a className="link-blue">Forgot password?</a>
          </div>

          <button className="btn btn--primary btn--lg btn--full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to studio"}
            <span style={{display:"inline-flex"}}>{I.arrowRight}</span>
          </button>

          <div className="divider-or">or</div>

          <button className="btn btn--secondary btn--full" type="button" onClick={handleSubmit} disabled={loading}>
            <span style={{display:"inline-flex"}}>{I.lock}</span>
            {loading ? "Authenticating..." : "Continue with Studio SSO"}
          </button>

          <div className="login__footer">
            BT Studio · Internal Use Only · Build 4.2.1
          </div>
        </form>
      </div>
    </div>
  );
}

window.Login = Login;
