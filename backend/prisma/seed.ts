import { PrismaClient, Role, ProjectStatus, AssetStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding BT Studio database…');

  // ─── Users ───────────────────────────────────
  const password = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@btstudio.ai' },
    update: {},
    create: { email: 'admin@btstudio.ai', name: 'Alice Chen', passwordHash: password, role: Role.ADMIN },
  });

  const artist1 = await prisma.user.upsert({
    where: { email: 'david@btstudio.ai' },
    update: {},
    create: { email: 'david@btstudio.ai', name: 'David Kim', passwordHash: password, role: Role.ARTIST },
  });

  const artist2 = await prisma.user.upsert({
    where: { email: 'tom@btstudio.ai' },
    update: {},
    create: { email: 'tom@btstudio.ai', name: 'Tom L.', passwordHash: password, role: Role.ARTIST },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: 'sarah@btstudio.ai' },
    update: {},
    create: { email: 'sarah@btstudio.ai', name: 'Sarah M.', passwordHash: password, role: Role.REVIEWER },
  });

  // ─── AI Tools ────────────────────────────────
  await prisma.aITool.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Image Generation', slug: 'image-gen', category: 'Generation', provider: 'openai', modelId: 'dall-e-3', description: 'Generate images from text prompts' },
      { name: 'Style Transfer', slug: 'style-transfer', category: 'Editing', provider: 'replicate', description: 'Apply artistic style to images' },
      { name: 'Character Consistency', slug: 'char-consistency', category: 'Generation', provider: 'stability', description: 'Generate consistent character frames' },
      { name: 'Upscale', slug: 'upscale', category: 'Editing', provider: 'replicate', description: 'Upscale and enhance image resolution' },
      { name: 'Batch Frame Render', slug: 'batch-render', category: 'Generation', provider: 'openai', description: 'Render sequences of frames in batch' },
    ],
  });

  // ─── Projects ────────────────────────────────
  const huda = await prisma.project.upsert({
    where: { id: 'proj_huda' },
    update: {},
    create: {
      id: 'proj_huda',
      name: 'Huda Commercial',
      client: 'Beauty / KV',
      progress: 72,
      tone: 'rose',
      status: ProjectStatus.ACTIVE,
      ownerId: admin.id,
    },
  });

  const halida = await prisma.project.upsert({
    where: { id: 'proj_halida' },
    update: {},
    create: {
      id: 'proj_halida',
      name: 'Halida Fresh Beer',
      client: 'Beverage / Spot',
      progress: 44,
      tone: 'amber',
      status: ProjectStatus.ACTIVE,
      ownerId: artist1.id,
    },
  });

  // Add members
  await prisma.projectMember.createMany({
    skipDuplicates: true,
    data: [
      { projectId: huda.id, userId: artist1.id, role: Role.ARTIST },
      { projectId: huda.id, userId: reviewer.id, role: Role.REVIEWER },
      { projectId: halida.id, userId: artist2.id, role: Role.ARTIST },
      { projectId: halida.id, userId: reviewer.id, role: Role.REVIEWER },
    ],
  });

  // ─── Folders for Huda ────────────────────────
  const genFolder = await prisma.folder.create({
    data: { name: 'Generated', projectId: huda.id, depth: 1 },
  });
  await prisma.folder.createMany({
    data: [
      { name: 'Brief',       projectId: huda.id, depth: 1 },
      { name: 'Sketches',    projectId: huda.id, depth: 1 },
      { name: 'References',  projectId: huda.id, depth: 1 },
      { name: 'Final Output',projectId: huda.id, depth: 1 },
    ],
  });

  // ─── Assets ──────────────────────────────────
  await prisma.asset.createMany({
    data: [
      { name: 'KV_Hero_Image_v4.png',    status: AssetStatus.APPROVED,  version: 4, projectId: huda.id,   folderId: genFolder.id, creatorId: admin.id },
      { name: 'Character_Sheet_v2.jpg',  status: AssetStatus.WIP,       version: 2, projectId: huda.id,   folderId: genFolder.id, creatorId: artist1.id },
      { name: 'Frame_18_v3.png',         status: AssetStatus.APPROVED,  version: 3, projectId: huda.id,   folderId: genFolder.id, creatorId: artist1.id },
      { name: 'Environment_Ref_v1.png',  status: AssetStatus.WIP,       version: 1, projectId: huda.id,   folderId: genFolder.id, creatorId: artist1.id },
      { name: 'Bottle_Hero_v1.png',      status: AssetStatus.GENERATING,version: 1, projectId: halida.id, folderId: null,        creatorId: artist2.id },
    ],
  });

  // ─── Assignments ─────────────────────────────
  const now = new Date();
  await prisma.assignment.createMany({
    data: [
      { title: 'Review Style Transfer — Huda KV v4',     dueAt: now,                          assigneeId: admin.id,   projectId: huda.id },
      { title: 'Generate 50 Icon Variants — Excool',      dueAt: new Date(now.getTime() + 86400000), assigneeId: artist1.id, projectId: huda.id },
      { title: 'Approve Storyboard — Halida 60s cut',     dueAt: new Date(now.getTime() + 3 * 86400000), assigneeId: reviewer.id, projectId: halida.id },
    ],
  });

  console.log('✅  Seed complete.');
  console.log('');
  console.log('   Login credentials (password: password123)');
  console.log('   admin@btstudio.ai    → ADMIN');
  console.log('   david@btstudio.ai    → ARTIST');
  console.log('   sarah@btstudio.ai    → REVIEWER');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
