// Tool catalog for the AI Workspace launcher.
// Categories: image / video / audio / spaces / 3d

const TOOLS = [
  // ─── Image ───────────────────────────────────────────────
  { id: "image-gen",   cat: "image",  name: "Image Generator",     desc: "Create images from text prompts and reference assets.",        icon: I.imageGen,  badge: { kind: "studio", text: "Studio" } },
  { id: "upscaler",    cat: "image",  name: "Image Upscaler",      desc: "Enhance resolution, recover detail, sharpen output.",          icon: I.upscale,   badge: { kind: "new",    text: "New" } },
  { id: "editor",      cat: "image",  name: "Image Editor",        desc: "Mask, inpaint and locally edit existing images.",              icon: I.edit },
  { id: "variations",  cat: "image",  name: "Variations",          desc: "Generate variations of a selected asset, locked seed.",        icon: I.variations },
  { id: "cinematic",   cat: "image",  name: "Cinematic Shot",      desc: "Compose with letterbox, lens, and shot-rule presets.",         icon: I.cinematic, badge: { kind: "beta",   text: "Beta" } },
  { id: "camera",      cat: "image",  name: "Change Camera",       desc: "Re-shoot a frame from a new angle, lens, or focal length.",    icon: I.camera },
  { id: "relight",     cat: "image",  name: "Relight",             desc: "Change lighting setup and atmosphere on an existing image.",   icon: I.relight,   badge: { kind: "new",    text: "New" } },
  { id: "remove-bg",   cat: "image",  name: "Remove Background",   desc: "Isolate subject from background with refined mask edges.",     icon: I.cutout },
  { id: "skin",        cat: "image",  name: "Skin Enhancer",       desc: "Beauty-grade skin retouching with controllable strength.",     icon: I.face,      badge: { kind: "comfy",  text: "ComfyUI" } },
  { id: "mockup",      cat: "image",  name: "Mockup Generator",    desc: "Place designs on product mockups — bottle, box, garment.",     icon: I.mockup },

  // ─── Video ───────────────────────────────────────────────
  { id: "video-gen",     cat: "video", name: "Video Generator",     desc: "Create videos from text or image prompts.",                   icon: I.videoGen,  badge: { kind: "beta",   text: "Beta" } },
  { id: "video-project", cat: "video", name: "Video Project Editor",desc: "Multi-clip timeline editor with cuts and transitions.",       icon: I.filmstrip },
  { id: "clip-editor",   cat: "video", name: "Clip Editor",         desc: "Trim, cut and edit single clips with frame precision.",       icon: I.clip },
  { id: "video-upscale", cat: "video", name: "Video Upscaler",      desc: "Enhance video resolution up to 4K with temporal stability.",  icon: I.videoUp,   badge: { kind: "runpod", text: "RunPod" } },
  { id: "video-relight", cat: "video", name: "Video Relight",       desc: "Re-light a video clip preserving motion and identity.",        icon: I.sun,       badge: { kind: "beta",   text: "Beta" } },
  { id: "speak",         cat: "video", name: "Speak",               desc: "Generate realistic talking-head videos from a script.",        icon: I.speak,     badge: { kind: "new",    text: "New" } },

  // ─── Audio ───────────────────────────────────────────────
  { id: "voice-gen",   cat: "audio",  name: "Voice Generator",     desc: "Generate realistic voiceovers from a script and tone.",        icon: I.mic },
  { id: "voice-clone", cat: "audio",  name: "Voice Cloning",       desc: "Clone approved internal voices for consistent narration.",     icon: I.clone,     badge: { kind: "studio", text: "Studio" } },
  { id: "music-gen",   cat: "audio",  name: "Music Generator",     desc: "Compose music from prompts. Stem-aware, BPM-locked.",          icon: I.music },
  { id: "voice-change",cat: "audio",  name: "Voice Changer",       desc: "Transform an existing recording's voice characteristics.",     icon: I.voiceChange, badge: { kind: "beta", text: "Beta" } },
  { id: "sfx-gen",     cat: "audio",  name: "Sound Effect Generator", desc: "Generate one-shot or looped SFX from a description.",       icon: I.sfx },

  // ─── Spaces ──────────────────────────────────────────────
  { id: "project-space",   cat: "spaces", name: "Project Space",   desc: "Open a project-based AI production room with all assets.",     icon: I.folder,    badge: { kind: "studio", text: "Studio" } },
  { id: "brand-space",     cat: "spaces", name: "Brand Space",     desc: "Manage brand IP presets and reference libraries.",             icon: I.shield },
  { id: "character-space", cat: "spaces", name: "Character Space", desc: "Manage character consistency seeds across campaigns.",         icon: I.figure,    badge: { kind: "studio", text: "Studio" } },
  { id: "campaign-space",  cat: "spaces", name: "Campaign Space",  desc: "Group assets, frames and deliverables by campaign.",           icon: I.target },
  { id: "review-space",    cat: "spaces", name: "Review Space",    desc: "Review, comment, approve, reject assets in one place.",        icon: I.review },

  // ─── 3D ──────────────────────────────────────────────────
  { id: "3d-gen",          cat: "3d", name: "3D Generator",          desc: "Generate 3D objects and characters from prompts.",          icon: I.cube,      badge: { kind: "beta",   text: "Beta" } },
  { id: "3d-scenes",       cat: "3d", name: "3D Scenes",             desc: "Create 3D environments and scenes for camera blocking.",    icon: I.scene3d,   badge: { kind: "beta",   text: "Beta" } },
  { id: "turntable",       cat: "3d", name: "Turntable Preview",     desc: "Preview generated 3D assets with auto turntable.",          icon: I.turntable },
  { id: "product-scene",   cat: "3d", name: "Product Scene Builder", desc: "Build product render scenes with PBR materials.",           icon: I.pedestal,  badge: { kind: "comfy",  text: "ComfyUI" } },
];

const CAT_LABELS = {
  image:  "Image",
  video:  "Video",
  audio:  "Audio",
  spaces: "Spaces",
  "3d":   "3D",
};

const CAT_COLORS = {
  image:  "image",
  video:  "video",
  audio:  "audio",
  spaces: "spaces",
  "3d":   "3d",
};

window.TOOLS = TOOLS;
window.CAT_LABELS = CAT_LABELS;
window.CAT_COLORS = CAT_COLORS;
