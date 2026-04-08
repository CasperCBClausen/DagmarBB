import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

export async function priceCategoryRoutes(fastify: FastifyInstance) {
  // GET /price-categories — public
  fastify.get('/', async () => {
    return prisma.priceCategory.findMany({
      include: {
        roomCategory: true,
        parent: { select: { id: true, name: true } },
        charges: { include: { charge: true } },
        _count: { select: { days: true } },
      },
      orderBy: [{ roomCategoryId: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
    });
  });

  // POST /price-categories — admin
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      roomCategoryId: z.string(),
      parentId: z.string().nullable().optional(),
      savingsPercent: z.number().min(0).max(100).nullable().optional(),
      serviceFeePercent: z.number().min(0).max(100).optional(),
      isRefundable: z.boolean().optional(),
      chargeIds: z.array(z.string()).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const roomCat = await prisma.roomCategory.findUnique({ where: { id: body.data.roomCategoryId } });
    if (!roomCat) return reply.status(404).send({ error: 'Room category not found' });

    if (body.data.parentId) {
      const parent = await prisma.priceCategory.findUnique({ where: { id: body.data.parentId } });
      if (!parent) return reply.status(404).send({ error: 'Parent category not found' });
    }

    const cat = await prisma.priceCategory.create({
      data: {
        name: body.data.name,
        roomCategoryId: body.data.roomCategoryId,
        parentId: body.data.parentId ?? null,
        savingsPercent: body.data.savingsPercent ?? null,
        serviceFeePercent: body.data.serviceFeePercent ?? 0,
        isRefundable: body.data.isRefundable ?? true,
        charges: body.data.chargeIds?.length
          ? { create: body.data.chargeIds.map(chargeId => ({ chargeId })) }
          : undefined,
      },
      include: { roomCategory: true, parent: { select: { id: true, name: true } }, charges: { include: { charge: true } } },
    });

    return reply.status(201).send(cat);
  });

  // PATCH /price-categories/:id — admin
  fastify.patch('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(1).optional(),
      savingsPercent: z.number().min(0).max(100).nullable().optional(),
      serviceFeePercent: z.number().min(0).max(100).optional(),
      isRefundable: z.boolean().optional(),
      chargeIds: z.array(z.string()).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const { chargeIds, ...rest } = body.data;

    const cat = await prisma.priceCategory.update({
      where: { id },
      data: {
        ...rest,
        ...(chargeIds !== undefined ? {
          charges: {
            deleteMany: {},
            create: chargeIds.map(chargeId => ({ chargeId })),
          },
        } : {}),
      },
      include: { roomCategory: true, parent: { select: { id: true, name: true } }, charges: { include: { charge: true } } },
    });
    return cat;
  });

  // DELETE /price-categories/:id — admin (also deletes sub-categories)
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Delete children first (no cascade in schema)
    await prisma.priceCategory.deleteMany({ where: { parentId: id } });
    await prisma.priceCategory.delete({ where: { id } });
    return reply.status(204).send();
  });

  // GET /price-categories/:id/days — admin
  fastify.get('/:id/days', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { from, to } = request.query as { from?: string; to?: string };

    const where: any = { categoryId: id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    return prisma.priceCategoryDay.findMany({ where, orderBy: { date: 'asc' } });
  });

  // POST /price-categories/:id/days/wizard — admin
  fastify.post('/:id/days/wizard', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      pricePerNight: z.number().min(0).optional(), // only required for main (non-sub) categories
      updateExistingOnly: z.boolean().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const cat = await prisma.priceCategory.findUnique({ where: { id } });
    if (!cat) return reply.status(404).send({ error: 'Category not found' });

    // updateExistingOnly: bulk-update existing records only, no upsert
    if (body.data.updateExistingOnly) {
      if (body.data.pricePerNight === undefined) {
        return reply.status(400).send({ error: 'pricePerNight is required' });
      }
      const where: any = { categoryId: id };
      if (body.data.startDate && body.data.endDate) {
        where.date = { gte: new Date(body.data.startDate), lte: new Date(body.data.endDate) };
      }
      const updateResult = await prisma.priceCategoryDay.updateMany({
        where,
        data: { pricePerNight: body.data.pricePerNight, isCustom: false },
      });
      return reply.status(200).send({ count: updateResult.count });
    }

    if (!body.data.startDate || !body.data.endDate) {
      return reply.status(400).send({ error: 'startDate and endDate are required' });
    }

    const start = new Date(body.data.startDate);
    const end = new Date(body.data.endDate);
    if (start > end) return reply.status(400).send({ error: 'startDate must be before endDate' });

    const isSubCat = !!(cat.parentId && cat.savingsPercent != null);

    if (!isSubCat && body.data.pricePerNight === undefined) {
      return reply.status(400).send({ error: 'pricePerNight is required for main categories' });
    }

    const days: Array<{ categoryId: string; date: Date; pricePerNight: number; isCustom: boolean }> = [];

    if (isSubCat) {
      // Derive prices from parent days
      const parentDays = await prisma.priceCategoryDay.findMany({
        where: { categoryId: cat.parentId!, date: { gte: start, lte: end } },
      });
      const parentMap = new Map(parentDays.map(d => [
        new Date(d.date).toISOString().slice(0, 10),
        d.pricePerNight,
      ]));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = new Date(d).toISOString().slice(0, 10);
        const parentPrice = parentMap.get(dateStr);
        if (parentPrice !== undefined) {
          const price = Math.round(parentPrice * (1 - cat.savingsPercent! / 100) * 100) / 100;
          days.push({ categoryId: id, date: new Date(d), pricePerNight: price, isCustom: false });
        }
      }
      if (days.length === 0) {
        return reply.status(400).send({ error: 'Parent category has no day records in this date range. Set up parent days first.' });
      }
    } else {
      // Main category: use provided price
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({ categoryId: id, date: new Date(d), pricePerNight: body.data.pricePerNight!, isCustom: false });
      }
    }

    const results = await Promise.all(
      days.map(day =>
        prisma.priceCategoryDay.upsert({
          where: { categoryId_date: { categoryId: day.categoryId, date: day.date } },
          update: { pricePerNight: day.pricePerNight, isCustom: day.isCustom },
          create: day,
        })
      )
    );

    return reply.status(201).send({ count: results.length, days: results });
  });

  // POST /price-categories/:id/days/restrict — admin
  fastify.post('/:id/days/restrict', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      startDate: z.string(),
      endDate: z.string(),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
      field: z.enum(['arrivalAllowed', 'departureAllowed', 'minAdvanceBookingDays', 'minStayNights', 'cancellationDays']),
      value: z.union([z.boolean(), z.number()]),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    const cat = await prisma.priceCategory.findUnique({ where: { id } });
    if (!cat) return reply.status(404).send({ error: 'Category not found' });

    const start = new Date(body.data.startDate);
    const end = new Date(body.data.endDate);
    const daysOfWeek = body.data.daysOfWeek;

    const matchingDates: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (!daysOfWeek || daysOfWeek.includes(d.getDay())) {
        matchingDates.push(new Date(d));
      }
    }

    const updateData: any = { [body.data.field]: body.data.value };

    const results = await Promise.all(
      matchingDates.map(date =>
        prisma.priceCategoryDay.upsert({
          where: { categoryId_date: { categoryId: id, date } },
          update: updateData,
          create: {
            categoryId: id,
            date,
            pricePerNight: 0,
            ...updateData,
          },
        })
      )
    );

    return { count: results.length };
  });

  // PATCH /price-categories/:id/days/:date — admin
  fastify.patch('/:id/days/:date', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id, date } = request.params as { id: string; date: string };
    const schema = z.object({
      pricePerNight: z.number().min(0).optional(),
      arrivalAllowed: z.boolean().optional(),
      departureAllowed: z.boolean().optional(),
      minAdvanceBookingDays: z.number().int().min(0).optional(),
      minStayNights: z.number().int().min(1).optional(),
      cancellationDays: z.number().int().min(0).optional(),
      isCustom: z.boolean().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const parsedDate = new Date(date);
    const { isCustom: isCustomOverride, ...dayData } = body.data;

    const day = await prisma.priceCategoryDay.upsert({
      where: { categoryId_date: { categoryId: id, date: parsedDate } },
      update: { ...dayData, isCustom: isCustomOverride ?? true },
      create: {
        categoryId: id,
        date: parsedDate,
        pricePerNight: dayData.pricePerNight ?? 0,
        arrivalAllowed: dayData.arrivalAllowed ?? true,
        departureAllowed: dayData.departureAllowed ?? true,
        minAdvanceBookingDays: dayData.minAdvanceBookingDays ?? 0,
        minStayNights: dayData.minStayNights ?? 1,
        cancellationDays: dayData.cancellationDays ?? 0,
        isCustom: isCustomOverride ?? true,
      },
    });

    return day;
  });
}
