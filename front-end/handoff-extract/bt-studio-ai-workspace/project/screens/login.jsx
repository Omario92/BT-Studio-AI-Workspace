function Login({ onLogin }) {
  const [email, setEmail] = React.useState("a.chen@btstudio.io");
  const [pwd, setPwd]   = React.useState("••••••••••");
  const [remember, setRemember] = React.useState(true);

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
        <div className="login__form">
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use your studio SSO credentials.</p>

          <div className="field">
            <label className="field__label">Work email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@btstudio.io" />
          </div>

          <div className="field">
            <label className="field__label">
              Password
              <span className="field__hint" style={{marginLeft: "auto"}}>SSO · OKTA</span>
            </label>
            <input className="input" type="password" value={pwd} onChange={e => setPwd(e.target.value)} />
          </div>

          <div className="login__remember">
            <button
              className={`checkbox ${remember ? "checkbox--on" : ""}`}
              onClick={() => setRemember(r => !r)}
            >
              <span className="checkbox__box" />
              Remember me on this device
            </button>
            <a className="link-blue">Forgot password?</a>
          </div>

          <button className="btn btn--primary btn--lg btn--full" onClick={onLogin}>
            Sign in to studio
            <span style={{display:"inline-flex"}}>{I.arrowRight}</span>
          </button>

          <div className="divider-or">or</div>

          <button className="btn btn--secondary btn--full" onClick={onLogin}>
            <span style={{display:"inline-flex"}}>{I.lock}</span>
            Continue with Studio SSO
          </button>

          <div className="login__footer">
            BT Studio · Internal Use Only · Build 4.2.1
          </div>
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
