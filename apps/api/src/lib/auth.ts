import bcrypt from 'bcryptjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  const user = request.user as { role: string };
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' });
  }
}

export async function requireAdminOrCleaner(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  const user = request.user as { role: string };
  if (!['ADMIN', 'CLEANER'].includes(user.role)) {
    return reply.status(403).send({ error: 'Forbidden: Staff access required' });
  }
}
