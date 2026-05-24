// Placeholder visuals — stylized hatched gradients with monospace labels.
// We do NOT hand-draw AI art SVGs; we make it clear these are stand-ins for real assets.

const Placeholder = ({ tone = "neutral", label, dark = false, className = "", style }) => (
  <div className={`ph ${dark ? "ph--dark" : ""} ph--${tone} ${className}`} style={style}>
    {label ? <span className="ph__label">{label}</span> : null}
  </div>
);

// Tones we use across project + asset placeholders, by category
const tones = ["neutral", "blue", "amber", "green", "rose", "violet", "teal", "mono"];

// A tiny pseudo-storyboard frame placeholder — just a tonal gradient
// with the "frame" label hidden so frame numbers can sit on top.
const FramePh = ({ tone = "mono", dark = false, label }) => (
  <div className={`ph ${dark ? "ph--dark" : ""} ph--${tone}`} style={{ width: "100%", height: "100%" }}>
    {label ? <span className="ph__label" style={{ fontSize: 9 }}>{label}</span> : null}
  </div>
);

window.Placeholder = Placeholder;
window.FramePh = FramePh;
window.toneSet = tones;
