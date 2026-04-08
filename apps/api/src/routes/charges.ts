import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

export async function chargeRoutes(fastify: FastifyInstance) {
  // GET /charges — admin
  fastify.get('/', { preHandler: [requireAdmin] }, async () => {
    return prisma.charge.findMany({ orderBy: { name: 'asc' } });
  });

  // POST /charges — admin
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      amountDKK: z.number().min(0),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const charge = await prisma.charge.create({ data: body.data });
    return reply.status(201).send(charge);
  });

  // PATCH /charges/:id — admin
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      amountDKK: z.number().min(0).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const charge = await prisma.charge.update({ where: { id }, data: body.data });
    return charge;
  });

  // DELETE /charges/:id — admin
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.charge.delete({ where: { id } });
    return reply.status(204).send();
  });
}
