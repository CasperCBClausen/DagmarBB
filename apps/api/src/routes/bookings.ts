import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../lib/auth';
import { nanoid } from 'nanoid';
import { sendBookingConfirmation } from '../services/emailService';

const createBookingSchema = z.object({
  roomId: z.string(),
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  notes: z.string().optional(),
  paymentMethod: z.enum(['MOBILEPAY', 'FLATPAY']),
});

export async function bookingRoutes(fastify: FastifyInstance) {
  // POST /bookings — public (guest creates booking)
  fastify.post('/', async (request, reply) => {
    const body = createBookingSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const room = await prisma.room.findUnique({ where: { id: body.data.roomId } });
    if (!room || !room.isActive) return reply.status(404).send({ error: 'Room not found' });

    const checkIn = new Date(body.data.checkIn);
    const checkOut = new Date(body.data.checkOut);

    if (checkIn >= checkOut) return reply.status(400).send({ error: 'Check-out must be after check-in' });
    if (checkIn < new Date()) return reply.status(400).send({ error: 'Check-in cannot be in the past' });

    // Check for conflicts
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: body.data.roomId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        ],
      },
    });
    if (conflict) return reply.status(409).send({ error: 'Room is not available for selected dates' });

    // Check closed periods
    const closedConflict = await prisma.closedPeriod.findFirst({
      where: {
        roomId: body.data.roomId,
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
      },
    });
    if (closedConflict) return reply.status(409).send({ error: 'Room is closed during selected dates' });

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * room.pricePerNight;
    const bookingRef = `DBB-${nanoid(8).toUpperCase()}`;

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        roomId: body.data.roomId,
        guestName: body.data.guestName,
        guestEmail: body.data.guestEmail,
        guestPhone: body.data.guestPhone,
        checkIn,
        checkOut,
        nights,
        totalPrice,
        notes: body.data.notes,
        status: 'PENDING',
      },
      include: { room: { select: { id: true, name: true, slug: true } } },
    });

    return reply.status(201).send(booking);
  });

  // GET /bookings — admin only
  fastify.get('/', { preHandler: [requireAdmin] }, async (request) => {
    const { status, from, to } = request.query as { status?: string; from?: string; to?: string };

    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.checkIn = {};
      if (from) where.checkIn.gte = new Date(from);
      if (to) where.checkIn.lte = new Date(to);
    }

    return prisma.booking.findMany({
      where,
      include: { room: { select: { id: true, name: true, slug: true } }, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  // GET /bookings/ref/:ref — public (guest checks own booking)
  fastify.get('/ref/:ref', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: ref },
      include: { room: { select: { id: true, name: true, slug: true } }, payment: true },
    });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    return booking;
  });

  // PATCH /bookings/:id/status — admin only
  fastify.patch('/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid status' });

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: body.data.status },
      include: { room: { select: { id: true, name: true, slug: true } } },
    });

    // When checking out, mark room as needs cleaning
    if (body.data.status === 'CHECKED_OUT') {
      await prisma.cleaningStatus.upsert({
        where: { roomId: booking.roomId },
        update: { state: 'NEEDS_CLEANING' },
        create: { roomId: booking.roomId, state: 'NEEDS_CLEANING' },
      });
    }

    return booking;
  });
}
