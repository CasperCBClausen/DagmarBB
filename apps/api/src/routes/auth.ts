import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/auth';
import { nanoid } from 'nanoid';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(body.data.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = fastify.jwt.sign(
      { sub: user.id, email: user.email, role: user.role, name: user.name },
      { expiresIn: '1h' }
    );

    const refreshTokenValue = nanoid(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
    };
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: body.data.refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newRefreshToken = nanoid(64);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.userId,
        expiresAt,
      },
    });

    const accessToken = fastify.jwt.sign(
      { sub: stored.user.id, email: stored.user.email, role: stored.user.role, name: stored.user.name },
      { expiresIn: '1h' }
    );

    return { accessToken, refreshToken: newRefreshToken };
  });

  // POST /auth/logout
  fastify.post('/logout', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (body.success) {
      await prisma.refreshToken.deleteMany({ where: { token: body.data.refreshToken } });
    }
    return { success: true };
  });
}
