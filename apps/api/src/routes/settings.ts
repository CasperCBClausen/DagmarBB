import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

async function getAllSettings() {
  const rows = await prisma.siteSettings.findMany({
    where: { key: { in: ['bookingMode', 'arrivalTime', 'departureTime'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    bookingMode: (map['bookingMode'] ?? 'manual') as 'manual' | 'autonomous',
    arrivalTime: map['arrivalTime'] ?? '16:00',
    departureTime: map['departureTime'] ?? '10:00',
  };
}

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /settings — public
  fastify.get('/', async () => getAllSettings());

  // PATCH /settings — admin only
  fastify.patch('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      bookingMode: z.enum(['manual', 'autonomous']).optional(),
      arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const upserts: Array<{ key: string; value: string }> = [];
    if (body.data.bookingMode !== undefined) upserts.push({ key: 'bookingMode', value: body.data.bookingMode });
    if (body.data.arrivalTime !== undefined) upserts.push({ key: 'arrivalTime', value: body.data.arrivalTime });
    if (body.data.departureTime !== undefined) upserts.push({ key: 'departureTime', value: body.data.departureTime });

    await Promise.all(upserts.map(({ key, value }) =>
      prisma.siteSettings.upsert({ where: { key }, update: { value }, create: { key, value } })
    ));

    return getAllSettings();
  });
}
