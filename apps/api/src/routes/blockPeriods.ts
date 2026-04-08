import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

const createSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
  roomCategoryIds: z.array(z.string()).min(1),
});

export async function blockPeriodRoutes(fastify: FastifyInstance) {
  // GET /block-periods — admin only
  fastify.get('/', { preHandler: [requireAdmin] }, async () => {
    return prisma.blockPeriod.findMany({
      include: { categories: { include: { roomCategory: true } } },
      orderBy: { startDate: 'asc' },
    });
  });

  // POST /block-periods — admin only
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid date format' });
    }
    if (startDate >= endDate) {
      return reply.status(400).send({ error: 'endDate must be after startDate' });
    }

    const period = await prisma.blockPeriod.create({
      data: {
        startDate,
        endDate,
        reason: body.reason,
        categories: {
          create: body.roomCategoryIds.map(roomCategoryId => ({ roomCategoryId })),
        },
      },
      include: { categories: { include: { roomCategory: true } } },
    });
    return reply.status(201).send(period);
  });

  // DELETE /block-periods/:id — admin only
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.blockPeriod.delete({ where: { id } });
    return reply.status(204).send();
  });
}
