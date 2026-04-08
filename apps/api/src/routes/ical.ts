import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

// --- ICS generation ---
function formatICSDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatICSDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function generateICS(roomName: string, bookings: Array<{ id: string; bookingRef: string; checkIn: Date; checkOut: Date; guestName: string; createdAt: Date }>): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dagmar B&B//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Dagmar B&B - ${roomName}`,
  ];

  for (const booking of bookings) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${booking.id}@dagmarbb.dk`);
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(booking.checkIn)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICSDate(booking.checkOut)}`);
    lines.push(`SUMMARY:Reservation ${booking.bookingRef}`);
    lines.push(`STATUS:CONFIRMED`);
    lines.push(`CREATED:${formatICSDateTime(booking.createdAt)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// --- ICS parsing ---
function extractICSField(block: string, fieldName: string): string | null {
  const regex = new RegExp(`^${fieldName}(?:;[^:]*)?:(.+)$`, 'm');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function parseICSDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.replace(/\s/g, '');
  // DATE format: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    return new Date(Date.UTC(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8))
    ));
  }
  // DATETIME format: YYYYMMDDTHHmmssZ
  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    const iso = clean.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/, '$1-$2-$3T$4:$5:$6Z');
    return new Date(iso);
  }
  return null;
}

function parseICSText(icsText: string): Array<{ uid: string; start: Date; end: Date }> {
  const events: Array<{ uid: string; start: Date; end: Date }> = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const uid = extractICSField(block, 'UID') || `generated-${Date.now()}-${i}`;
    const startStr = extractICSField(block, 'DTSTART');
    const endStr = extractICSField(block, 'DTEND');

    if (!startStr || !endStr) continue;

    const start = parseICSDate(startStr);
    const end = parseICSDate(endStr);

    if (!start || !end) continue;
    events.push({ uid, start, end });
  }

  return events;
}

export async function icalRoutes(fastify: FastifyInstance) {
  // GET /ical/rooms/:roomId/calendar.ics — public export
  fastify.get('/rooms/:roomId/calendar.ics', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return reply.status(404).send('Room not found');

    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      select: { id: true, bookingRef: true, checkIn: true, checkOut: true, guestName: true, createdAt: true },
      orderBy: { checkIn: 'asc' },
    });

    const ics = generateICS(room.name, bookings);
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${room.slug}.ics"`);
    return reply.send(ics);
  });

  // GET /ical/calendar-sources — admin
  fastify.get('/calendar-sources', { preHandler: [requireAdmin] }, async () => {
    return prisma.calendarSource.findMany({
      include: {
        rooms: {
          include: { room: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  // POST /ical/calendar-sources — admin
  fastify.post('/calendar-sources', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      feedUrl: z.string().url(),
      roomIds: z.array(z.string()).min(1),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const source = await prisma.calendarSource.create({
      data: {
        name: body.data.name,
        feedUrl: body.data.feedUrl,
        rooms: {
          create: body.data.roomIds.map(roomId => ({ roomId })),
        },
      },
      include: {
        rooms: { include: { room: { select: { id: true, name: true, slug: true } } } },
      },
    });

    return reply.status(201).send(source);
  });

  // PATCH /ical/calendar-sources/:id — admin
  fastify.patch('/calendar-sources/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      feedUrl: z.string().url().optional(),
      roomIds: z.array(z.string()).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const updateData: any = {};
    if (body.data.name) updateData.name = body.data.name;
    if (body.data.feedUrl) updateData.feedUrl = body.data.feedUrl;

    if (body.data.roomIds) {
      // Replace room assignments
      await prisma.calendarSourceRoom.deleteMany({ where: { sourceId: id } });
      updateData.rooms = {
        create: body.data.roomIds.map(roomId => ({ roomId })),
      };
    }

    const source = await prisma.calendarSource.update({
      where: { id },
      data: updateData,
      include: {
        rooms: { include: { room: { select: { id: true, name: true, slug: true } } } },
      },
    });

    return source;
  });

  // DELETE /ical/calendar-sources/:id — admin
  fastify.delete('/calendar-sources/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Delete synced closed periods from this source
    await prisma.closedPeriod.deleteMany({ where: { source: id } });
    await prisma.calendarSource.delete({ where: { id } });

    return { success: true };
  });

  // POST /ical/calendar-sources/:id/sync — admin
  fastify.post('/calendar-sources/:id/sync', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const source = await prisma.calendarSource.findUnique({
      where: { id },
      include: { rooms: { select: { roomId: true } } },
    });

    if (!source) return reply.status(404).send({ error: 'Calendar source not found' });

    let icsText: string;
    try {
      const response = await fetch(source.feedUrl, {
        headers: { 'User-Agent': 'DagmarBB-CalSync/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      icsText = await response.text();
    } catch (err: any) {
      return reply.status(502).send({ error: `Failed to fetch feed: ${err.message}` });
    }

    const events = parseICSText(icsText);
    const roomIds = source.rooms.map(r => r.roomId);

    let added = 0;
    let updated = 0;

    for (const event of events) {
      for (const roomId of roomIds) {
        const existing = await prisma.closedPeriod.findFirst({
          where: { roomId, source: id, externalUid: event.uid },
        });

        if (existing) {
          await prisma.closedPeriod.update({
            where: { id: existing.id },
            data: { startDate: event.start, endDate: event.end },
          });
          updated++;
        } else {
          await prisma.closedPeriod.create({
            data: {
              roomId,
              startDate: event.start,
              endDate: event.end,
              reason: `Synced from ${source.name}`,
              source: id,
              externalUid: event.uid,
            },
          });
          added++;
        }
      }
    }

    // Update lastSync timestamp
    await prisma.calendarSource.update({
      where: { id },
      data: { lastSync: new Date() },
    });

    return { added, updated, total: events.length };
  });
}
