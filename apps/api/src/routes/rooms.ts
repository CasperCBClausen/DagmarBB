import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../lib/auth';
import { generateQRCode } from '../services/qrService';

const createRoomSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  pricePerNight: z.number().positive(),
  maxGuests: z.number().int().positive(),
  amenities: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
});

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pricePerNight: z.number().positive().optional(),
  maxGuests: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function roomRoutes(fastify: FastifyInstance) {
  // GET /rooms — public
  fastify.get('/', async () => {
    return prisma.room.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  // GET /rooms/all — admin only (includes inactive)
  fastify.get('/all', { preHandler: [requireAdmin] }, async (request) => {
    return prisma.room.findMany({ orderBy: { createdAt: 'asc' } });
  });

  // GET /rooms/:slug
  fastify.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) return reply.status(404).send({ error: 'Room not found' });
    return room;
  });

  // GET /rooms/:slug/availability
  fastify.get('/:slug/availability', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) return reply.status(404).send({ error: 'Room not found' });

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Get booked dates
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: room.id,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          { checkIn: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end } },
          { checkIn: { lte: start }, checkOut: { gte: end } },
        ],
      },
    });

    // Get closed periods
    const closedPeriods = await prisma.closedPeriod.findMany({
      where: {
        roomId: room.id,
        OR: [
          { startDate: { gte: start, lte: end } },
          { endDate: { gte: start, lte: end } },
          { startDate: { lte: start }, endDate: { gte: end } },
        ],
      },
    });

    // Build unavailable dates
    const unavailable: string[] = [];

    for (const booking of bookings) {
      const d = new Date(booking.checkIn);
      while (d < booking.checkOut) {
        unavailable.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }

    for (const period of closedPeriods) {
      const d = new Date(period.startDate);
      while (d <= period.endDate) {
        unavailable.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }

    return { roomId: room.id, unavailableDates: [...new Set(unavailable)] };
  });

  // POST /rooms — admin only
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const existing = await prisma.room.findUnique({ where: { slug: body.data.slug } });
    if (existing) return reply.status(409).send({ error: 'Room with this slug already exists' });

    const room = await prisma.room.create({ data: body.data });
    await prisma.cleaningStatus.create({ data: { roomId: room.id, state: 'CLEAN' } });
    return reply.status(201).send(room);
  });

  // PATCH /rooms/:id — admin only
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRoomSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const room = await prisma.room.update({ where: { id }, data: body.data });
    return room;
  });

  // DELETE /rooms/:id — admin only
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.room.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  });

  // GET /rooms/:id/qr — admin only
  fastify.get('/:id/qr', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return reply.status(404).send({ error: 'Room not found' });

    let qrRecord = await prisma.roomQRCode.findUnique({ where: { roomId: id } });

    if (!qrRecord) {
      const { token, qrDataUrl } = await generateQRCode(id);
      qrRecord = await prisma.roomQRCode.create({
        data: { roomId: id, token, qrDataUrl },
      });
    }

    return { qrDataUrl: qrRecord.qrDataUrl, token: qrRecord.token };
  });

  // POST /rooms/:id/closed-periods — admin only
  fastify.post('/:id/closed-periods', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      startDate: z.string(),
      endDate: z.string(),
      reason: z.string().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const period = await prisma.closedPeriod.create({
      data: {
        roomId: id,
        startDate: new Date(body.data.startDate),
        endDate: new Date(body.data.endDate),
        reason: body.data.reason,
      },
    });
    return reply.status(201).send(period);
  });

  // GET /rooms/:id/closed-periods
  fastify.get('/:id/closed-periods', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return prisma.closedPeriod.findMany({
      where: { roomId: id },
      orderBy: { startDate: 'asc' },
    });
  });

  // DELETE /rooms/:id/closed-periods/:periodId — admin only
  fastify.delete('/:id/closed-periods/:periodId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { periodId } = request.params as { id: string; periodId: string };
    await prisma.closedPeriod.delete({ where: { id: periodId } });
    return { success: true };
  });
}
