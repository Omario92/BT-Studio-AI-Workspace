import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schema';
import { Role } from '@prisma/client';

export async function registerUser(
  fastify: FastifyInstance,
  input: RegisterInput,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Errors.Conflict('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: (input.role as Role) ?? Role.ARTIST,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const { accessToken, refreshToken } = signTokens(fastify, user.id, user.role);
  return { user, accessToken, refreshToken };
}

export async function loginUser(
  fastify: FastifyInstance,
  input: LoginInput,
) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw Errors.Unauthorized('Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw Errors.Unauthorized('Invalid credentials');

  const { accessToken, refreshToken } = signTokens(fastify, user.id, user.role);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };

  return { user: safeUser, accessToken, refreshToken };
}

export async function refreshTokens(
  fastify: FastifyInstance,
  refreshToken: string,
) {
  let payload: { sub: string; role: string; type: string };
  try {
    payload = fastify.jwt.verify<{ sub: string; role: string; type: string }>(refreshToken);
  } catch {
    throw Errors.Unauthorized('Invalid or expired refresh token');
  }
  if (payload.type !== 'refresh') throw Errors.Unauthorized('Invalid token type');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw Errors.Unauthorized('User not found');

  return signTokens(fastify, user.id, user.role);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true,
      avatarUrl: true, createdAt: true,
      _count: {
        select: { ownedProjects: true, assignments: true },
      },
    },
  });
  if (!user) throw Errors.NotFound('User not found');
  return user;
}

// ─── Helpers ─────────────────────────────────

function signTokens(fastify: FastifyInstance, userId: string, role: string) {
  const accessToken = fastify.jwt.sign(
    { sub: userId, role, type: 'access' },
    { expiresIn: '7d' },
  );
  const refreshToken = fastify.jwt.sign(
    { sub: userId, role, type: 'refresh' },
    { expiresIn: '30d' },
  );
  return { accessToken, refreshToken };
}
