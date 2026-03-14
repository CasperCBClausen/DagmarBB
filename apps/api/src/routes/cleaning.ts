import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminOrCleaner, requireAdmin } from '../lib/auth';

const updateCleaningSchema = z.object({
  state: z.enum(['CLEAN', 'NEEDS_CLEANING', 'IN_PROGRESS']),
});

export async function cleaningRoutes(fastify: FastifyInstance) {
  // GET /cleaning/status
  fastify.get('/status', { preHandler: [requireAdminOrCleaner] }, async () => {
    return prisma.cleaningStatus.findMany({
      include: {
        room: { select: { id: true, name: true, slug: true } },
      },
    });
  });

  // PATCH /cleaning/:roomId
  fastify.patch('/:roomId', { preHandler: [requireAdminOrCleaner] }, async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const body = updateCleaningSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const user = request.user as { sub: string; role: string };

    const status = await prisma.cleaningStatus.upsert({
      where: { roomId },
      update: { state: body.data.state },
      create: { roomId, state: body.data.state },
      include: { room: { select: { id: true, name: true, slug: true } } },
    });

    // Log the action
    await prisma.cleaningLog.create({
      data: {
        roomId,
        userId: user.sub,
        action: `State changed to ${body.data.state}`,
        method: 'manual',
      },
    });

    return status;
  });
}
