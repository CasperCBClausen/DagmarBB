import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin } from '../lib/auth';
import { nanoid } from 'nanoid';
import { sendBookingConfirmation } from '../services/emailService';

const roomEntrySchema = z.object({
  roomCategoryId: z.string(),
  count: z.number().int().min(1),
  pricePerNight: z.number().positive(),
  chargesTotal: z.number().min(0).optional().default(0),
  rateLabel: z.string().optional(),
});

const createBookingSchema = z.object({
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  notes: z.string().optional(),
  paymentMethod: z.enum(['MOBILEPAY', 'FLATPAY']),
  rooms: z.array(roomEntrySchema).min(1),
  discountCode: z.string().optional(),
});

const adminCreateBookingSchema = z.object({
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']),
  rooms: z.array(z.object({
    roomCategoryId: z.string(),
    count: z.number().int().min(1),
    pricePerNight: z.number().min(0),
  })).optional().default([]),
  totalPrice: z.number().min(0).optional(),
});

export async function bookingRoutes(fastify: FastifyInstance) {
  // POST /bookings — public (guest creates booking)
  fastify.post('/', async (request, reply) => {
    const body = createBookingSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const checkIn = new Date(body.data.checkIn);
    const checkOut = new Date(body.data.checkOut);

    if (checkIn >= checkOut) return reply.status(400).send({ error: 'Check-out must be after check-in' });

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Validate capacity per category
    for (const entry of body.data.rooms) {
      const totalInCategory = await prisma.room.count({
        where: { isActive: true, roomCategories: { some: { roomCategoryId: entry.roomCategoryId } } },
      });
      const overlappingBookingRooms = await prisma.bookingRoom.count({
        where: {
          roomCategoryId: entry.roomCategoryId,
          booking: {
            status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
      });
      const closedRooms = await prisma.closedPeriod.findMany({
        where: {
          room: { isActive: true, roomCategories: { some: { roomCategoryId: entry.roomCategoryId } } },
          startDate: { lt: checkOut },
          endDate: { gt: checkIn },
        },
        select: { roomId: true },
        distinct: ['roomId'],
      });
      const available = totalInCategory - overlappingBookingRooms - closedRooms.length;
      if (available < entry.count) {
        return reply.status(409).send({
          error: `Not enough rooms available in this category (requested: ${entry.count}, available: ${Math.max(0, available)})`,
        });
      }
    }

    // Cross-category check: when rooms are shared across categories,
    // per-category validation alone can allow overbooking.
    // Count unique physical rooms across all requested categories and ensure
    // (existing unassigned bookings + new request) fits within physical capacity.
    {
      const requestedCatIds = body.data.rooms.map(e => e.roomCategoryId);
      const allRoomLinks = await prisma.roomRoomCategory.findMany({
        where: { roomCategoryId: { in: requestedCatIds }, room: { isActive: true } },
        select: { roomId: true },
      });
      const uniqueRoomIds = [...new Set(allRoomLinks.map(r => r.roomId))];

      let directlyBlocked = 0;
      for (const roomId of uniqueRoomIds) {
        const assigned = await prisma.bookingRoom.findFirst({
          where: {
            assignedRoomId: roomId,
            booking: { status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
          },
        });
        if (assigned) { directlyBlocked++; continue; }
        const closed = await prisma.closedPeriod.findFirst({
          where: { roomId, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
        });
        if (closed) directlyBlocked++;
      }

      const existingUnassigned = await prisma.bookingRoom.count({
        where: {
          roomCategoryId: { in: requestedCatIds },
          assignedRoomId: null,
          booking: { status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        },
      });

      const physicalAvailable = uniqueRoomIds.length - directlyBlocked - existingUnassigned;
      const totalRequested = body.data.rooms.reduce((s, e) => s + e.count, 0);
      if (totalRequested > physicalAvailable) {
        return reply.status(409).send({
          error: `Not enough rooms available across selected categories (requested: ${totalRequested}, available: ${Math.max(0, physicalAvailable)})`,
        });
      }
    }

    const bookingRef = `DBB-${nanoid(8).toUpperCase()}`;

    // Resolve discount code
    let discountPercent = 0;
    let discountAmount = 0;
    let appliedDiscountCode: string | undefined;

    if (body.data.discountCode) {
      const dc = await prisma.discountCode.findUnique({ where: { code: body.data.discountCode.toUpperCase() } });
      const now = new Date();
      if (dc && now >= dc.validFrom && now <= dc.validTo) {
        if (dc.type === 'MULTI' || (dc.type === 'SINGLE' && dc.status !== 'USED')) {
          discountPercent = dc.discountPercent;
          appliedDiscountCode = dc.code;
        }
      }
    }

    // Build BookingRoom entries
    const bookingRoomsData: Array<{
      roomCategoryId: string;
      pricePerNight: number;
      subtotal: number;
      rateLabel?: string;
    }> = [];

    for (const entry of body.data.rooms) {
      for (let i = 0; i < entry.count; i++) {
        bookingRoomsData.push({
          roomCategoryId: entry.roomCategoryId,
          pricePerNight: entry.pricePerNight,
          subtotal: entry.pricePerNight * nights + entry.chargesTotal,
          rateLabel: entry.rateLabel,
        });
      }
    }

    const rawTotal = bookingRoomsData.reduce((sum, r) => sum + r.subtotal, 0);
    discountAmount = Math.round(rawTotal * discountPercent / 100);
    const totalPrice = rawTotal - discountAmount;

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        guestName: body.data.guestName,
        guestEmail: body.data.guestEmail,
        guestPhone: body.data.guestPhone,
        checkIn,
        checkOut,
        nights,
        totalPrice,
        notes: body.data.notes,
        discountCode: appliedDiscountCode,
        discountPercent: discountPercent || undefined,
        discountAmount: discountAmount || undefined,
        status: 'PENDING',
        bookingRooms: {
          create: bookingRoomsData,
        },
      },
      include: {
        bookingRooms: {
          include: {
            roomCategory: true,
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (body.data.notes) {
      await prisma.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderRole: 'guest',
          senderName: booking.guestName,
          text: body.data.notes,
        },
      });
    }

    // Update discount code usage
    if (appliedDiscountCode && discountPercent > 0) {
      const dc = await prisma.discountCode.findUnique({ where: { code: appliedDiscountCode } });
      if (dc) {
        if (dc.type === 'SINGLE') {
          await prisma.discountCode.update({ where: { id: dc.id }, data: { status: 'USED', usedByBookingId: booking.id } });
        } else {
          await prisma.discountCode.update({ where: { id: dc.id }, data: { usageCount: { increment: 1 } } });
        }
      }
    }

    return reply.status(201).send(booking);
  });

  // POST /bookings/admin — admin only (manual booking with specific rooms)
  fastify.post('/admin', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = adminCreateBookingSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const checkIn = new Date(body.data.checkIn);
    const checkOut = new Date(body.data.checkOut);

    if (checkIn >= checkOut) return reply.status(400).send({ error: 'Check-out must be after check-in' });

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Validate room categories exist and availability
    for (const entry of body.data.rooms) {
      const cat = await prisma.roomCategory.findUnique({ where: { id: entry.roomCategoryId } });
      if (!cat) return reply.status(404).send({ error: `Room category ${entry.roomCategoryId} not found` });
      const totalInCategory = await prisma.room.count({ where: { isActive: true, roomCategories: { some: { roomCategoryId: entry.roomCategoryId } } } });
      const overlapping = await prisma.bookingRoom.count({
        where: {
          roomCategoryId: entry.roomCategoryId,
          booking: { status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        },
      });
      const available = totalInCategory - overlapping;
      if (available < entry.count) {
        return reply.status(409).send({ error: `Not enough rooms available in category (requested: ${entry.count}, available: ${Math.max(0, available)})` });
      }
    }

    const bookingRoomsData = body.data.rooms.flatMap(entry =>
      Array.from({ length: entry.count }, () => ({
        roomCategoryId: entry.roomCategoryId,
        pricePerNight: entry.pricePerNight,
        subtotal: entry.pricePerNight * nights,
      }))
    );

    const totalPrice = body.data.rooms.length > 0
      ? bookingRoomsData.reduce((sum, r) => sum + r.subtotal, 0)
      : (body.data.totalPrice ?? 0);
    const bookingRef = `DBB-${nanoid(8).toUpperCase()}`;

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        guestName: body.data.guestName,
        guestEmail: body.data.guestEmail,
        guestPhone: body.data.guestPhone,
        checkIn,
        checkOut,
        nights,
        totalPrice,
        notes: body.data.notes,
        status: body.data.status,
        isAdminCreated: true,
        bookingRooms: {
          create: bookingRoomsData,
        },
      },
      include: {
        bookingRooms: {
          include: {
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (body.data.notes) {
      await prisma.bookingMessage.create({
        data: {
          bookingId: booking.id,
          senderRole: 'guest',
          senderName: booking.guestName,
          text: body.data.notes,
        },
      });
    }

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

    const rows = await prisma.booking.findMany({
      where,
      include: {
        room: { select: { id: true, name: true, slug: true } },
        assignedRoom: { select: { id: true, name: true, slug: true } },
        payment: true,
        bookingRooms: {
          include: {
            roomCategory: true,
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { messages: { where: { senderRole: 'guest', adminRead: false } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(({ _count, ...b }) => ({ ...b, unreadMessages: _count.messages }));
  });

  // GET /bookings/ref/:ref — public (guest checks own booking)
  fastify.get('/ref/:ref', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: ref },
      include: {
        room: { select: { id: true, name: true, slug: true } },
        assignedRoom: { select: { id: true, name: true, slug: true } },
        payment: true,
        bookingRooms: {
          include: {
            roomCategory: true,
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    return booking;
  });

  // PATCH /bookings/ref/:ref/guest — guest updates own info (public, ref is auth)
  fastify.patch('/ref/:ref/guest', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const schema = z.object({
      guestName: z.string().min(2).optional(),
      guestEmail: z.string().email().optional(),
      guestPhone: z.string().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const booking = await prisma.booking.findUnique({ where: { bookingRef: ref } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: body.data });
    return updated;
  });

  // POST /bookings/ref/:ref/cancel — guest cancels (public, ref is auth)
  fastify.post('/ref/:ref/cancel', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const booking = await prisma.booking.findUnique({ where: { bookingRef: ref } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (['CANCELLED', 'CUSTOMER_CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'].includes(booking.status)) {
      return reply.status(409).send({ error: 'Booking cannot be cancelled' });
    }
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CUSTOMER_CANCELLED' } });
    return updated;
  });

  // GET /bookings/ref/:ref/messages — guest fetches messages
  fastify.get('/ref/:ref/messages', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const booking = await prisma.booking.findUnique({ where: { bookingRef: ref } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    return prisma.bookingMessage.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
  });

  // POST /bookings/ref/:ref/messages — guest sends message
  fastify.post('/ref/:ref/messages', async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const schema = z.object({ text: z.string().min(1) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const booking = await prisma.booking.findUnique({ where: { bookingRef: ref } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    const msg = await prisma.bookingMessage.create({
      data: { bookingId: booking.id, senderRole: 'guest', senderName: booking.guestName, text: body.data.text },
    });
    return reply.status(201).send(msg);
  });

  // PATCH /bookings/:id/status — admin only
  fastify.patch('/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW']) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid status' });

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: body.data.status },
      include: {
        room: { select: { id: true, name: true, slug: true } },
        bookingRooms: {
          include: {
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    // When checking out, mark assigned rooms as needs cleaning
    if (body.data.status === 'CHECKED_OUT') {
      const roomIds = new Set<string>();
      const cleanRoomId = booking.roomId ?? booking.assignedRoomId;
      if (cleanRoomId) roomIds.add(cleanRoomId);
      booking.bookingRooms.forEach(br => {
        if (br.roomId) roomIds.add(br.roomId);
        if (br.assignedRoomId) roomIds.add(br.assignedRoomId);
      });
      for (const roomId of roomIds) {
        await prisma.cleaningStatus.upsert({
          where: { roomId },
          update: { state: 'NEEDS_CLEANING' },
          create: { roomId, state: 'NEEDS_CLEANING' },
        });
      }
    }

    return booking;
  });

  // PATCH /bookings/:id/assign — admin only (assign a room to a BookingRoom entry)
  fastify.patch('/:id/assign', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      bookingRoomId: z.string().optional(),
      roomId: z.string().nullable(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    if (body.data.roomId !== null) {
      const room = await prisma.room.findUnique({ where: { id: body.data.roomId } });
      if (!room) return reply.status(404).send({ error: 'Room not found' });
    }

    // If bookingRoomId provided, assign on BookingRoom level
    if (body.data.bookingRoomId) {
      const bookingRoom = await prisma.bookingRoom.update({
        where: { id: body.data.bookingRoomId },
        data: { assignedRoomId: body.data.roomId },
        include: {
          room: { select: { id: true, name: true, slug: true } },
          assignedRoom: { select: { id: true, name: true, slug: true } },
        },
      });
      return bookingRoom;
    }

    // Legacy: assign on booking level
    const booking = await prisma.booking.update({
      where: { id },
      data: { assignedRoomId: body.data.roomId },
      include: {
        room: { select: { id: true, name: true, slug: true } },
        assignedRoom: { select: { id: true, name: true, slug: true } },
        bookingRooms: {
          include: {
            roomCategory: true,
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return booking;
  });

  // GET /bookings/:id/assignment-conflict?roomId=X — admin: check if assigning roomId would strand another booking
  fastify.get('/:id/assignment-conflict', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { roomId } = request.query as { roomId?: string };
    if (!roomId) return reply.status(400).send({ error: 'roomId is required' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });

    const bookingFilter = {
      status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] as ('CANCELLED' | 'CUSTOMER_CANCELLED' | 'NO_SHOW')[] },
      checkIn: { lt: booking.checkOut },
      checkOut: { gt: booking.checkIn },
    };

    const roomCats = await prisma.roomRoomCategory.findMany({
      where: { roomId },
      include: { roomCategory: { select: { id: true, name: true } } },
    });

    const conflicts: Array<{ bookingRef: string; guestName: string; categoryName: string }> = [];

    for (const rc of roomCats) {
      const catId = rc.roomCategoryId;
      const allInCat = await prisma.roomRoomCategory.findMany({ where: { roomCategoryId: catId }, select: { roomId: true } });
      const catRoomIds = allInCat.map(r => r.roomId);

      // Other unassigned bookings in this category that overlap our dates (excluding this booking)
      const otherUnassigned = await prisma.bookingRoom.findMany({
        where: { roomCategoryId: catId, assignedRoomId: null, booking: { ...bookingFilter, id: { not: id } } },
        include: { booking: { select: { bookingRef: true, guestName: true } } },
      });
      if (otherUnassigned.length === 0) continue;

      // Rooms still available after assigning roomId to this booking
      const taken = new Set<string>([roomId]);
      const assigned = await prisma.bookingRoom.findMany({
        where: { assignedRoomId: { in: catRoomIds }, booking: { ...bookingFilter, id: { not: id } } },
        select: { assignedRoomId: true },
      });
      assigned.forEach(r => { if (r.assignedRoomId) taken.add(r.assignedRoomId); });
      const closed = await prisma.closedPeriod.findMany({
        where: { roomId: { in: catRoomIds }, startDate: { lt: booking.checkOut }, endDate: { gt: booking.checkIn } },
        select: { roomId: true, roomCategoryIds: true },
      });
      closed.forEach(p => { if (p.roomCategoryIds.length === 0 || p.roomCategoryIds.includes(catId)) taken.add(p.roomId); });

      const availableAfter = catRoomIds.filter(rid => !taken.has(rid)).length;
      if (otherUnassigned.length > availableAfter) {
        otherUnassigned.forEach(br => conflicts.push({
          bookingRef: br.booking.bookingRef,
          guestName: br.booking.guestName,
          categoryName: rc.roomCategory.name,
        }));
      }
    }

    // Deduplicate by bookingRef
    const seen = new Set<string>();
    return { conflicts: conflicts.filter(c => !seen.has(c.bookingRef) && seen.add(c.bookingRef)) };
  });

  // GET /bookings/:id/messages — admin fetches messages (marks guest messages as read)
  fastify.get('/:id/messages', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const messages = await prisma.bookingMessage.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } });
    // Mark all unread guest messages as read
    await prisma.bookingMessage.updateMany({
      where: { bookingId: id, senderRole: 'guest', adminRead: false },
      data: { adminRead: true },
    });
    return messages;
  });

  // POST /bookings/:id/messages — admin sends message
  fastify.post('/:id/messages', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ text: z.string().min(1), senderName: z.string().optional() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });
    const msg = await prisma.bookingMessage.create({
      data: { bookingId: id, senderRole: 'admin', senderName: body.data.senderName, text: body.data.text },
    });
    return reply.status(201).send(msg);
  });

  // GET /bookings/:id — admin fetches single booking (must be after all /ref/:ref and specific routes)
  fastify.get('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: { select: { id: true, name: true, slug: true } },
        assignedRoom: { select: { id: true, name: true, slug: true } },
        payment: true,
        bookingRooms: {
          include: {
            roomCategory: true,
            room: { select: { id: true, name: true, slug: true } },
            assignedRoom: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    return booking;
  });
}
