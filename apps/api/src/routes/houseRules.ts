import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';
import { translateToAllLanguages } from '../services/translationService';

const createSchema = z.object({
  text: z.string().min(1),
});

const updateSchema = z.object({
  text: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  translations: z.record(z.string()).optional(),
});

export async function houseRuleRoutes(fastify: FastifyInstance) {
  // GET /house-rules — public
  fastify.get('/', async () => {
    return prisma.houseRule.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  });

  // POST /house-rules — admin only
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const count = await prisma.houseRule.count();
    const translations = await translateToAllLanguages(body.text);
    const rule = await prisma.houseRule.create({
      data: { text: body.text, sortOrder: count, translations },
    });
    return reply.status(201).send(rule);
  });

  // POST /house-rules/reorder — admin only
  fastify.post('/reorder', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({ ids: z.array(z.string()) });
    const { ids } = schema.parse(request.body);
    await Promise.all(ids.map((id, i) => prisma.houseRule.update({ where: { id }, data: { sortOrder: i } })));
    return prisma.houseRule.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  });

  // PATCH /house-rules/:id — admin only
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    const { translations: manualTranslations, ...rest } = body;
    const data: Record<string, unknown> = { ...rest };
    if (manualTranslations) {
      data.translations = manualTranslations;
    } else if (body.text) {
      data.translations = await translateToAllLanguages(body.text);
    }
    const rule = await prisma.houseRule.update({ where: { id }, data });
    return rule;
  });

  // DELETE /house-rules/:id — admin only
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.houseRule.delete({ where: { id } });
    return reply.status(204).send();
  });
}
