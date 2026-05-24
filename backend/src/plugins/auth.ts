import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { Role } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: string; type: string };
    user: { sub: string; role: string; type: string };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Decorator: verifies JWT on any route
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      if ((req.user as any).type !== 'access') {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token type' } });
      }
    } catch (err) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }
  });

  // Decorator: role-based guard — use after authenticate
  fastify.decorate('requireRole', (roles: Role[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const userRole = (req.user as any).role as Role;
      if (!roles.includes(userRole)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      }
    };
  });
});
