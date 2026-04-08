import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';
import { translateToAllLanguages } from '../services/translationService';

export async function roomCategoryRoutes(fastify: FastifyInstance) {
  // GET /room-categories — public
  fastify.get('/', async () => {
    return prisma.roomCategory.findMany({ orderBy: { name: 'asc' } });
  });

  // POST /room-categories — admin only
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({ name: z.string().min(1) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    try {
      const translations = await translateToAllLanguages(body.data.name);
      const category = await prisma.roomCategory.create({ data: { name: body.data.name, translations } });
      return reply.status(201).send(category);
    } catch {
      return reply.status(409).send({ error: 'Category name already exists' });
    }
  });

  // PATCH /room-categories/:id — admin only
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      translations: z.record(z.string()).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const data: Record<string, unknown> = {};
    if (body.data.translations) {
      data.translations = body.data.translations;
      if (body.data.name) data.name = body.data.name;
    } else if (body.data.name) {
      data.name = body.data.name;
      data.translations = await translateToAllLanguages(body.data.name);
    }
    const category = await prisma.roomCategory.update({ where: { id }, data });
    return category;
  });

  // DELETE /room-categories/:id — admin only
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.roomCategory.delete({ where: { id } });
    return { success: true };
  });
}
