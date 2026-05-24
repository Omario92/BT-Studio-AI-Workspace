import {
  PrismaClient,
  Role,
  ProjectStatus,
  AssetStatus,
  JobStatus,
  JobType,
  ToolCategory,
  ReviewDecision,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding BT Studio database…');

  const password = await bcrypt.hash('password123', 12);
  const now = new Date();

  // ─── Users ───────────────────────────────────

  const alice = await prisma.user.upsert({
    where: { email: 'alice@btstudio.ai' },
    update: {},
    create: { email: 'alice@btstudio.ai', name: 'Alice Chen', passwordHash: password, role: Role.ADMIN },
  });

  const david = await prisma.user.upsert({
    where: { email: 'david@btstudio.ai' },
    update: {},
    create: { email: 'david@btstudio.ai', name: 'David Kim', passwordHash: password, role: Role.ARTIST },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@btstudio.ai' },
    update: {},
    create: { email: 'sarah@btstudio.ai', name: 'Sarah M.', passwordHash: password, role: Role.ART_DIRECTOR },
  });

  const tom = await prisma.user.upsert({
    where: { email: 'tom@btstudio.ai' },
    update: {},
    create: { email: 'tom@btstudio.ai', name: 'Tom L.', passwordHash: password, role: Role.AI_ENGINEER },
  });

  const maria = await prisma.user.upsert({
    where: { email: 'maria@btstudio.ai' },
    update: {},
    create: { email: 'maria@btstudio.ai', name: 'Maria R.', passwordHash: password, role: Role.REVIEWER },
  });

  console.log('  ✓  Users');

  // ─── AI Tools (all from workspace-tools.jsx) ──

  const toolsData = [
    // Image
    { name: 'Image Generator',      slug: 'image-gen',    category: ToolCategory.IMAGE,  icon: 'imageGen',    badge: 'Studio',       badgeKind: 'studio', sortOrder: 1,  description: 'Create images from text prompts and reference assets.' },
    { name: 'Image Upscaler',        slug: 'upscaler',     category: ToolCategory.IMAGE,  icon: 'upscale',     badge: 'New',          badgeKind: 'new',    sortOrder: 2,  description: 'Enhance resolution, recover detail, sharpen output.' },
    { name: 'Image Editor',          slug: 'editor',       category: ToolCategory.IMAGE,  icon: 'edit',        badge: null,           badgeKind: null,     sortOrder: 3,  description: 'Mask, inpaint and locally edit existing images.' },
    { name: 'Variations',            slug: 'variations',   category: ToolCategory.IMAGE,  icon: 'variations',  badge: null,           badgeKind: null,     sortOrder: 4,  description: 'Generate variations of a selected asset, locked seed.' },
    { name: 'Cinematic Shot',        slug: 'cinematic',    category: ToolCategory.IMAGE,  icon: 'cinematic',   badge: 'Beta',         badgeKind: 'beta',   sortOrder: 5,  description: 'Compose with letterbox, lens, and shot-rule presets.' },
    { name: 'Change Camera',         slug: 'camera',       category: ToolCategory.IMAGE,  icon: 'camera',      badge: null,           badgeKind: null,     sortOrder: 6,  description: 'Re-shoot a frame from a new angle, lens, or focal length.' },
    { name: 'Relight',               slug: 'relight',      category: ToolCategory.IMAGE,  icon: 'relight',     badge: 'New',          badgeKind: 'new',    sortOrder: 7,  description: 'Change lighting setup and atmosphere on an existing image.' },
    { name: 'Remove Background',     slug: 'remove-bg',    category: ToolCategory.IMAGE,  icon: 'cutout',      badge: null,           badgeKind: null,     sortOrder: 8,  description: 'Isolate subject from background with refined mask edges.' },
    { name: 'Skin Enhancer',         slug: 'skin',         category: ToolCategory.IMAGE,  icon: 'face',        badge: 'ComfyUI',      badgeKind: 'comfy',  sortOrder: 9,  description: 'Beauty-grade skin retouching with controllable strength.' },
    { name: 'Mockup Generator',      slug: 'mockup',       category: ToolCategory.IMAGE,  icon: 'mockup',      badge: null,           badgeKind: null,     sortOrder: 10, description: 'Place designs on product mockups — bottle, box, garment.' },
    // Video
    { name: 'Video Generator',       slug: 'video-gen',     category: ToolCategory.VIDEO,  icon: 'videoGen',   badge: 'Beta',         badgeKind: 'beta',   sortOrder: 11, description: 'Create videos from text or image prompts.' },
    { name: 'Video Project Editor',  slug: 'video-project', category: ToolCategory.VIDEO,  icon: 'filmstrip',  badge: null,           badgeKind: null,     sortOrder: 12, description: 'Multi-clip timeline editor with cuts and transitions.' },
    { name: 'Clip Editor',           slug: 'clip-editor',   category: ToolCategory.VIDEO,  icon: 'clip',       badge: null,           badgeKind: null,     sortOrder: 13, description: 'Trim, cut and edit single clips with frame precision.' },
    { name: 'Video Upscaler',        slug: 'video-upscale', category: ToolCategory.VIDEO,  icon: 'videoUp',    badge: 'RunPod',       badgeKind: 'runpod', sortOrder: 14, description: 'Enhance video resolution up to 4K with temporal stability.' },
    { name: 'Video Relight',         slug: 'video-relight', category: ToolCategory.VIDEO,  icon: 'sun',        badge: 'Beta',         badgeKind: 'beta',   sortOrder: 15, description: 'Re-light a video clip preserving motion and identity.' },
    { name: 'Speak',                 slug: 'speak',         category: ToolCategory.VIDEO,  icon: 'speak',      badge: 'New',          badgeKind: 'new',    sortOrder: 16, description: 'Generate realistic talking-head videos from a script.' },
    // Audio
    { name: 'Voice Generator',       slug: 'voice-gen',    category: ToolCategory.AUDIO,  icon: 'mic',         badge: null,           badgeKind: null,     sortOrder: 17, description: 'Generate realistic voiceovers from a script and tone.' },
    { name: 'Voice Cloning',         slug: 'voice-clone',  category: ToolCategory.AUDIO,  icon: 'clone',       badge: 'Studio',       badgeKind: 'studio', sortOrder: 18, description: 'Clone approved internal voices for consistent narration.' },
    { name: 'Music Generator',       slug: 'music-gen',    category: ToolCategory.AUDIO,  icon: 'music',       badge: null,           badgeKind: null,     sortOrder: 19, description: 'Compose music from prompts. Stem-aware, BPM-locked.' },
    { name: 'Voice Changer',         slug: 'voice-change', category: ToolCategory.AUDIO,  icon: 'voiceChange', badge: 'Beta',         badgeKind: 'beta',   sortOrder: 20, description: "Transform an existing recording's voice characteristics." },
    { name: 'Sound Effect Generator',slug: 'sfx-gen',      category: ToolCategory.AUDIO,  icon: 'sfx',         badge: null,           badgeKind: null,     sortOrder: 21, description: 'Generate one-shot or looped SFX from a description.' },
    // Spaces
    { name: 'Project Space',         slug: 'project-space',   category: ToolCategory.SPACES, icon: 'folder',   badge: 'Studio',       badgeKind: 'studio', sortOrder: 22, description: 'Open a project-based AI production room with all assets.' },
    { name: 'Brand Space',           slug: 'brand-space',     category: ToolCategory.SPACES, icon: 'shield',   badge: null,           badgeKind: null,     sortOrder: 23, description: 'Manage brand IP presets and reference libraries.' },
    { name: 'Character Space',       slug: 'character-space', category: ToolCategory.SPACES, icon: 'figure',   badge: 'Studio',       badgeKind: 'studio', sortOrder: 24, description: 'Manage character consistency seeds across campaigns.' },
    { name: 'Campaign Space',        slug: 'campaign-space',  category: ToolCategory.SPACES, icon: 'target',   badge: null,           badgeKind: null,     sortOrder: 25, description: 'Group assets, frames and deliverables by campaign.' },
    { name: 'Review Space',          slug: 'review-space',    category: ToolCategory.SPACES, icon: 'review',   badge: null,           badgeKind: null,     sortOrder: 26, description: 'Review, comment, approve, reject assets in one place.' },
    // 3D
    { name: '3D Generator',          slug: '3d-gen',          category: ToolCategory.THREE_D, icon: 'cube',    badge: 'Beta',         badgeKind: 'beta',   sortOrder: 27, description: 'Generate 3D objects and characters from prompts.' },
    { name: '3D Scenes',             slug: '3d-scenes',       category: ToolCategory.THREE_D, icon: 'scene3d', badge: 'Beta',         badgeKind: 'beta',   sortOrder: 28, description: 'Create 3D environments and scenes for camera blocking.' },
    { name: 'Turntable Preview',     slug: 'turntable',       category: ToolCategory.THREE_D, icon: 'turntable',badge: null,          badgeKind: null,     sortOrder: 29, description: 'Preview generated 3D assets with auto turntable.' },
    { name: 'Product Scene Builder', slug: 'product-scene',   category: ToolCategory.THREE_D, icon: 'pedestal', badge: 'ComfyUI',     badgeKind: 'comfy',  sortOrder: 30, description: 'Build product render scenes with PBR materials.' },
  ];

  for (const tool of toolsData) {
    await prisma.aITool.upsert({
      where: { slug: tool.slug },
      update: { ...tool },
      create: { ...tool },
    });
  }

  console.log('  ✓  AI Tools (30)');

  // ─── Templates ───────────────────────────────

  await prisma.template.createMany({
    skipDuplicates: true,
    data: [
      { name: 'KV Hero — Full Bleed',       category: 'Key Visual',   tags: ['hero', 'kv', 'portrait'],  usageCount: 48, description: 'Full-bleed key visual with brand-safe margins.' },
      { name: 'Product Shot — White BG',    category: 'Product',      tags: ['product', 'clean'],        usageCount: 36, description: 'Clean product photo on white background.' },
      { name: 'Character Sheet — 3 Views',  category: 'Character',    tags: ['character', '3-view'],     usageCount: 22, description: 'Front, side, and back character reference sheet.' },
      { name: 'Storyboard 16:9 · 8 Frames', category: 'Storyboard',   tags: ['storyboard', 'narrative'], usageCount: 19, description: '8-frame horizontal storyboard for 16:9 spots.' },
      { name: 'Social Square — 1:1',        category: 'Social Media', tags: ['social', '1:1'],           usageCount: 31, description: '1:1 square format for Instagram and social.' },
      { name: 'Banner — 16:9 Cinematic',    category: 'Banner',       tags: ['banner', 'cinema'],        usageCount: 17, description: 'Letterboxed cinematic banner.' },
      { name: 'Voice Script Template',      category: 'Audio',        tags: ['voice', 'script'],         usageCount: 14, description: 'Standard VO script with cue markers.' },
      { name: 'Batch — Icon Variants',      category: 'Batch',        tags: ['batch', 'icons'],          usageCount: 25, description: 'Generate 20+ icon style variants from one seed.' },
    ],
  });

  console.log('  ✓  Templates');

  // ─── Projects ────────────────────────────────

  const huda = await prisma.project.upsert({
    where: { id: 'proj_huda' },
    update: {},
    create: {
      id: 'proj_huda',
      name: 'Huda Commercial',
      client: 'Beauty / KV',
      description: 'Hero key visual campaign for Huda Beauty commercial.',
      progress: 72,
      tone: 'rose',
      status: ProjectStatus.ACTIVE,
      ownerId: alice.id,
    },
  });

  const halida = await prisma.project.upsert({
    where: { id: 'proj_halida' },
    update: {},
    create: {
      id: 'proj_halida',
      name: 'Halida Fresh Beer',
      client: 'Beverage / Spot',
      description: '60s TVC campaign for Halida Fresh Beer summer edition.',
      progress: 44,
      tone: 'amber',
      status: ProjectStatus.ACTIVE,
      ownerId: david.id,
    },
  });

  const excool = await prisma.project.upsert({
    where: { id: 'proj_excool' },
    update: {},
    create: {
      id: 'proj_excool',
      name: 'Coolmate Excool KV',
      client: 'Apparel / KV',
      description: 'Summer apparel key visual for Coolmate Excool collection.',
      progress: 88,
      tone: 'teal',
      status: ProjectStatus.ACTIVE,
      ownerId: alice.id,
    },
  });

  const obagi = await prisma.project.upsert({
    where: { id: 'proj_obagi' },
    update: {},
    create: {
      id: 'proj_obagi',
      name: 'Obagi Skin Lab',
      client: 'Skincare / Spot',
      description: 'Brand identity and product spot for Obagi Skin Lab.',
      progress: 31,
      tone: 'violet',
      status: ProjectStatus.WIP,
      ownerId: sarah.id,
    },
  });

  const renderProject = await prisma.project.upsert({
    where: { id: 'proj_render' },
    update: {},
    create: {
      id: 'proj_render',
      name: 'Product Render V3',
      client: 'Internal · R&D',
      description: 'Internal R&D for photorealistic product rendering pipeline.',
      progress: 64,
      tone: 'blue',
      isPinned: true,
      status: ProjectStatus.WIP,
      ownerId: tom.id,
    },
  });

  const charModel = await prisma.project.upsert({
    where: { id: 'proj_char' },
    update: {},
    create: {
      id: 'proj_char',
      name: 'Character Model 01',
      client: 'Anim · Pre-prod',
      description: 'Pre-production character model for animated series.',
      progress: 22,
      tone: 'green',
      isPinned: true,
      status: ProjectStatus.WIP,
      ownerId: david.id,
    },
  });

  console.log('  ✓  Projects (6)');

  // ─── Members ─────────────────────────────────

  await prisma.projectMember.createMany({
    skipDuplicates: true,
    data: [
      { projectId: huda.id,         userId: david.id,  role: Role.ARTIST },
      { projectId: huda.id,         userId: sarah.id,  role: Role.ART_DIRECTOR },
      { projectId: huda.id,         userId: maria.id,  role: Role.REVIEWER },
      { projectId: halida.id,       userId: tom.id,    role: Role.AI_ENGINEER },
      { projectId: halida.id,       userId: sarah.id,  role: Role.REVIEWER },
      { projectId: halida.id,       userId: maria.id,  role: Role.REVIEWER },
      { projectId: excool.id,       userId: david.id,  role: Role.ARTIST },
      { projectId: excool.id,       userId: tom.id,    role: Role.AI_ENGINEER },
      { projectId: obagi.id,        userId: alice.id,  role: Role.ART_DIRECTOR },
      { projectId: obagi.id,        userId: david.id,  role: Role.ARTIST },
      { projectId: renderProject.id,userId: alice.id,  role: Role.ART_DIRECTOR },
      { projectId: charModel.id,    userId: alice.id,  role: Role.ART_DIRECTOR },
      { projectId: charModel.id,    userId: tom.id,    role: Role.AI_ENGINEER },
    ],
  });

  // ─── Folders ─────────────────────────────────

  const folderNames = ['Brief', 'Script', 'Sketches', 'References', 'Generated', 'Final Output'];
  const folderMap: Record<string, Record<string, string>> = {};

  for (const proj of [huda, halida, excool, obagi, renderProject, charModel]) {
    folderMap[proj.id] = {};
    for (const fname of folderNames) {
      const existing = await prisma.folder.findFirst({
        where: { projectId: proj.id, name: fname, parentId: null },
      });
      const folder = existing ?? await prisma.folder.create({
        data: { name: fname, projectId: proj.id, depth: 1 },
      });
      folderMap[proj.id][fname] = folder.id;
    }
  }

  console.log('  ✓  Folders');

  // ─── Assets ──────────────────────────────────

  const assetDefs = [
    { name: 'KV_Hero_Image_v4.png',    status: AssetStatus.APPROVED,          currentVersion: 4, projectId: huda.id,         folderKey: 'Generated',    creatorId: alice.id },
    { name: 'Character_Sheet_v2.jpg',  status: AssetStatus.IN_REVIEW,         currentVersion: 2, projectId: huda.id,         folderKey: 'Generated',    creatorId: david.id },
    { name: 'Frame_18_v3.png',         status: AssetStatus.APPROVED,          currentVersion: 3, projectId: huda.id,         folderKey: 'Generated',    creatorId: david.id },
    { name: 'Environment_Ref_v1.png',  status: AssetStatus.WIP,               currentVersion: 1, projectId: huda.id,         folderKey: 'References',   creatorId: david.id },
    { name: 'Product_Render_v3.png',   status: AssetStatus.WIP,               currentVersion: 3, projectId: renderProject.id,folderKey: 'Generated',    creatorId: tom.id },
    { name: 'Bottle_Hero_v1.png',      status: AssetStatus.GENERATING,        currentVersion: 1, projectId: halida.id,       folderKey: 'Generated',    creatorId: tom.id },
    { name: 'Frame_20_v2.png',         status: AssetStatus.REVISION_REQUESTED,currentVersion: 2, projectId: halida.id,       folderKey: 'Generated',    creatorId: tom.id },
  ];

  const assetMap: Record<string, string> = {};
  for (const def of assetDefs) {
    const existing = await prisma.asset.findFirst({
      where: { name: def.name, projectId: def.projectId },
    });
    const folderId = folderMap[def.projectId]?.[def.folderKey] ?? null;
    const asset = existing ?? await prisma.asset.create({
      data: {
        name: def.name,
        status: def.status,
        currentVersion: def.currentVersion,
        projectId: def.projectId,
        folderId,
        creatorId: def.creatorId,
      },
    });
    assetMap[def.name] = asset.id;

    // Create version records for existing asset versions
    for (let v = 1; v <= def.currentVersion; v++) {
      await prisma.assetVersion.upsert({
        where: { assetId_versionNumber: { assetId: asset.id, versionNumber: v } },
        update: {},
        create: {
          assetId: asset.id,
          versionNumber: v,
          status: v < def.currentVersion ? AssetStatus.ARCHIVED : def.status,
          createdById: def.creatorId,
        },
      });
    }
  }

  console.log('  ✓  Assets (7) + versions');

  // ─── Reviews ─────────────────────────────────

  // KV_Hero_Image_v4 approved by Sarah
  const kvVersion = await prisma.assetVersion.findFirst({
    where: { assetId: assetMap['KV_Hero_Image_v4.png'], versionNumber: 4 },
  });
  if (kvVersion) {
    await prisma.review.upsert({
      where: { id: 'rev_kv_v4' },
      update: {},
      create: {
        id: 'rev_kv_v4',
        versionId: kvVersion.id,
        reviewerId: sarah.id,
        decision: ReviewDecision.APPROVED,
        comment: 'Colours are perfect. Good to go.',
      },
    });
  }

  // Frame_18_v3 approved by Maria
  const frame18Version = await prisma.assetVersion.findFirst({
    where: { assetId: assetMap['Frame_18_v3.png'], versionNumber: 3 },
  });
  if (frame18Version) {
    await prisma.review.upsert({
      where: { id: 'rev_f18_v3' },
      update: {},
      create: {
        id: 'rev_f18_v3',
        versionId: frame18Version.id,
        reviewerId: maria.id,
        decision: ReviewDecision.APPROVED,
        comment: null,
      },
    });
  }

  // Frame_20_v2 revision requested
  const frame20Version = await prisma.assetVersion.findFirst({
    where: { assetId: assetMap['Frame_20_v2.png'], versionNumber: 2 },
  });
  if (frame20Version) {
    await prisma.review.upsert({
      where: { id: 'rev_f20_v2' },
      update: {},
      create: {
        id: 'rev_f20_v2',
        versionId: frame20Version.id,
        reviewerId: sarah.id,
        decision: ReviewDecision.REVISION_REQUESTED,
        comment: 'Glass refraction is wrong — re-run with new env ref. See attached.',
      },
    });
  }

  console.log('  ✓  Reviews');

  // ─── Comments ────────────────────────────────

  const charSheetId = assetMap['Character_Sheet_v2.jpg'];
  if (charSheetId) {
    await prisma.comment.createMany({
      skipDuplicates: true,
      data: [
        {
          body: 'Eyes a bit too saturated, can we cool the skin tone? Also the hair highlight on v2 lost some specularity vs v1.',
          assetId: charSheetId,
          authorId: maria.id,
        },
        {
          body: 'Agreed on the eyes. Will re-run with updated skin tone preset.',
          assetId: charSheetId,
          authorId: david.id,
        },
      ],
    });
  }

  // ─── Sample Jobs ─────────────────────────────

  const imageGenTool = await prisma.aITool.findUnique({ where: { slug: 'image-gen' } });
  const upscalerTool = await prisma.aITool.findUnique({ where: { slug: 'upscaler' } });
  const videoGenTool = await prisma.aITool.findUnique({ where: { slug: 'video-gen' } });
  const voiceGenTool = await prisma.aITool.findUnique({ where: { slug: 'voice-gen' } });

  const sampleJobs = [
    {
      id: 'job_frame18',
      name: 'Frame_18_v3 cyberpunk street',
      type: JobType.IMAGE_GENERATION,
      status: JobStatus.RUNNING,
      progress: 64,
      projectId: huda.id,
      userId: alice.id,
      toolId: imageGenTool?.id,
      params: { prompt: 'cyberpunk street, neon lights, dramatic angle' },
      startedAt: new Date(now.getTime() - 60000),
    },
    {
      id: 'job_kv_upscale',
      name: 'KV_Hero_Image upscaled to 4K',
      type: JobType.IMAGE_UPSCALE,
      status: JobStatus.COMPLETED,
      progress: 100,
      projectId: huda.id,
      userId: alice.id,
      toolId: upscalerTool?.id,
      params: { targetWidth: 3840, targetHeight: 2160 },
      startedAt: new Date(now.getTime() - 3 * 60000),
      completedAt: new Date(now.getTime() - 60000),
    },
    {
      id: 'job_halida_video',
      name: 'Halida 60s spot · scene 02',
      type: JobType.VIDEO_GENERATION,
      status: JobStatus.QUEUED,
      progress: 0,
      projectId: halida.id,
      userId: tom.id,
      toolId: videoGenTool?.id,
      params: { prompt: 'beer bottle condensation, slow motion pour' },
    },
    {
      id: 'job_bottle_hero',
      name: 'Bottle_Hero_v1 retouch',
      type: JobType.IMAGE_EDIT,
      status: JobStatus.FAILED,
      progress: 0,
      projectId: halida.id,
      userId: tom.id,
      toolId: imageGenTool?.id,
      params: { prompt: 'retouch glass refraction, correct reflections' },
      errorMsg: 'Provider timeout — retry with updated params',
    },
    {
      id: 'job_maria_vo',
      name: 'Maria_VO narration v2',
      type: JobType.VOICE_GENERATION,
      status: JobStatus.COMPLETED,
      progress: 100,
      projectId: huda.id,
      userId: maria.id,
      toolId: voiceGenTool?.id,
      params: { script: 'Introducing the new Huda Beauty collection...', voice: 'professional-female' },
      startedAt: new Date(now.getTime() - 12 * 60000),
      completedAt: new Date(now.getTime() - 10 * 60000),
    },
  ];

  for (const job of sampleJobs) {
    await prisma.aIJob.upsert({
      where: { id: job.id },
      update: {},
      create: job as any,
    });
  }

  console.log('  ✓  Sample Jobs (5)');

  // ─── Assignments ─────────────────────────────

  await prisma.assignment.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Review Style Transfer — Huda KV v4',
        dueAt: now,
        assigneeId: alice.id,
        projectId: huda.id,
      },
      {
        title: 'Generate 50 Icon Variants — Excool',
        dueAt: new Date(now.getTime() + 86400000),
        assigneeId: david.id,
        projectId: excool.id,
      },
      {
        title: 'Feedback on Model 01 — pass B',
        dueAt: new Date(now.getTime() - 2 * 86400000),
        assigneeId: alice.id,
        projectId: charModel.id,
      },
      {
        title: 'Approve Storyboard — Halida 60s cut',
        dueAt: new Date(now.getTime() + 4 * 86400000),
        assigneeId: sarah.id,
        projectId: halida.id,
      },
    ],
  });

  // ─── Activity Log ─────────────────────────────

  const activityEntries = [
    { action: 'approved',        entityType: 'asset',   entityId: assetMap['Frame_18_v3.png']     ?? 'n/a', detail: 'Frame_18_v3.png on Halida Fresh Beer', userId: maria.id,  projectId: huda.id,   assetId: assetMap['Frame_18_v3.png'],    createdAt: new Date(now.getTime() - 12 * 60000) },
    { action: 'uploaded',        entityType: 'asset',   entityId: assetMap['Environment_Ref_v1.png'] ?? 'n/a', detail: 'Environment_Ref_v1.png to Huda Commercial',userId: david.id, projectId: huda.id, assetId: assetMap['Environment_Ref_v1.png'], createdAt: new Date(now.getTime() - 60 * 60000) },
    { action: 'completed batch', entityType: 'job',     entityId: 'job_kv_upscale',               detail: '32 frames · Excool sketch pack',       userId: tom.id,   projectId: excool.id, jobId: 'job_kv_upscale',                 createdAt: new Date(now.getTime() - 62 * 60000) },
    { action: 'commented on',    entityType: 'asset',   entityId: assetMap['Character_Sheet_v2.jpg'] ?? 'n/a',  detail: 'Eyes a bit too saturated, can we cool the skin tone?', userId: maria.id, projectId: huda.id, assetId: assetMap['Character_Sheet_v2.jpg'], createdAt: new Date(now.getTime() - 2 * 60 * 60000) },
    { action: 'started',         entityType: 'job',     entityId: 'job_frame18',                  detail: 'AI Engine v4.0 — char-consistency model', userId: alice.id, projectId: huda.id, jobId: 'job_frame18',                    createdAt: new Date(now.getTime() - 3 * 60 * 60000) },
    { action: 'regenerated',     entityType: 'asset',   entityId: assetMap['KV_Hero_Image_v4.png'] ?? 'n/a', detail: 'KV_Hero_Image_v4.png',               userId: tom.id,   projectId: huda.id, assetId: assetMap['KV_Hero_Image_v4.png'], createdAt: new Date(now.getTime() - 24 * 60 * 60000) },
    { action: 'approved',        entityType: 'asset',   entityId: assetMap['KV_Hero_Image_v4.png'] ?? 'n/a', detail: 'KV_Hero_Image_v4.png approved v4',   userId: sarah.id, projectId: huda.id, assetId: assetMap['KV_Hero_Image_v4.png'], createdAt: new Date(now.getTime() - 30 * 60000) },
    { action: 'sent to review',  entityType: 'asset',   entityId: assetMap['Character_Sheet_v2.jpg'] ?? 'n/a', detail: 'Character_Sheet_v2.jpg',           userId: david.id, projectId: huda.id, assetId: assetMap['Character_Sheet_v2.jpg'], createdAt: new Date(now.getTime() - 32 * 60000) },
    { action: 'requested revision on', entityType: 'asset', entityId: assetMap['Frame_20_v2.png'] ?? 'n/a', detail: 'Glass refraction is wrong — re-run with new env ref.', userId: sarah.id, projectId: halida.id, assetId: assetMap['Frame_20_v2.png'], createdAt: new Date(now.getTime() - 88 * 60000) },
  ];

  for (const entry of activityEntries) {
    await prisma.activityLog.create({ data: entry as any });
  }

  console.log('  ✓  Activity log');

  // ─── Done ─────────────────────────────────────

  console.log('');
  console.log('✅  Seed complete.');
  console.log('');
  console.log('   Login credentials (all passwords: password123)');
  console.log('   alice@btstudio.ai   → ADMIN');
  console.log('   david@btstudio.ai   → ARTIST');
  console.log('   sarah@btstudio.ai   → ART_DIRECTOR');
  console.log('   tom@btstudio.ai     → AI_ENGINEER');
  console.log('   maria@btstudio.ai   → REVIEWER');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
