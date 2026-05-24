import { FastifyInstance } from 'fastify';
import { registerUser, loginUser, refreshTokens, getMe } from './auth.service';
import { loginJsonSchema, registerJsonSchema } from './auth.schema';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      ...registerJsonSchema,
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const result = await registerUser(fastify, body);
    return reply.status(201).send(result);
  });

  // POST /auth/login
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login and receive JWT tokens',
      ...loginJsonSchema,
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const result = await loginUser(fastify, body);
    return reply.send(result);
  });

  // POST /auth/refresh
  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokens = await refreshTokens(fastify, refreshToken);
    return reply.send(tokens);
  });

  // GET /auth/me  — protected
  fastify.get('/me', {
    schema: { tags: ['Auth'], summary: 'Get current user profile' },
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const user = await getMe((req.user as any).sub);
    return reply.send({ user });
  });
}
