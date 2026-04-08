import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';
import { customAlphabet } from 'nanoid';

const discountCodeAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4); // no I/O/1/0 to avoid confusion

export async function discountCodeRoutes(fastify: FastifyInstance) {
  // POST /discount-codes/validate — public: check code validity
  fastify.post('/validate', async (request, reply) => {
    const schema = z.object({ code: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const dc = await prisma.discountCode.findUnique({ where: { code: body.data.code.toUpperCase() } });
    if (!dc) return reply.status(404).send({ error: 'Invalid discount code' });

    const now = new Date();
    if (now < dc.validFrom || now > dc.validTo) {
      return reply.status(400).send({ error: 'Discount code has expired or is not yet valid' });
    }

    if (dc.type === 'SINGLE' && dc.status === 'USED') {
      return reply.status(400).send({ error: 'Discount code has already been used' });
    }

    return { valid: true, discountPercent: dc.discountPercent, type: dc.type, name: dc.name ?? dc.code };
  });

  // GET /discount-codes — admin: list all
  fastify.get('/', { preHandler: [requireAdmin] }, async () => {
    return prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // POST /discount-codes — admin: create
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const multiSchema = z.object({
      type: z.literal('MULTI'),
      code: z.string().min(3),
      discountPercent: z.number().min(1).max(100),
      validFrom: z.string(),
      validTo: z.string(),
    });
    const singleSchema = z.object({
      type: z.literal('SINGLE'),
      count: z.number().int().min(1).max(500),
      discountPercent: z.number().min(1).max(100),
      validFrom: z.string(),
      validTo: z.string(),
    });
    const schema = z.discriminatedUnion('type', [multiSchema, singleSchema]);
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input', details: body.error.issues });

    if (body.data.type === 'MULTI') {
      const codeUpper = body.data.code.toUpperCase();
      const existing = await prisma.discountCode.findUnique({ where: { code: codeUpper } });
      if (existing) return reply.status(409).send({ error: 'A code with that name already exists' });
      const created = await prisma.discountCode.create({
        data: {
          type: 'MULTI',
          code: codeUpper,
          discountPercent: body.data.discountPercent,
          validFrom: new Date(body.data.validFrom),
          validTo: new Date(body.data.validTo),
        },
      });
      return reply.status(201).send(created);
    } else {
      const batchId = discountCodeAlphabet() + discountCodeAlphabet();
      const codes = await prisma.$transaction(
        Array.from({ length: body.data.count }, () =>
          prisma.discountCode.create({
            data: {
              type: 'SINGLE',
              code: `RBT-${discountCodeAlphabet()}-${discountCodeAlphabet()}`,
              batchId,
              discountPercent: body.data.discountPercent,
              validFrom: new Date(body.data.validFrom),
              validTo: new Date(body.data.validTo),
              status: 'FREE',
            },
          })
        )
      );
      return reply.status(201).send(codes);
    }
  });

  // PATCH /discount-codes/:id/status — admin: update single-use status (FREE/HANDED only)
  fastify.patch('/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ status: z.enum(['FREE', 'HANDED']) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid status' });

    const dc = await prisma.discountCode.findUnique({ where: { id } });
    if (!dc) return reply.status(404).send({ error: 'Not found' });
    if (dc.type !== 'SINGLE') return reply.status(400).send({ error: 'Only single-use codes have status' });
    if (dc.status === 'USED') return reply.status(409).send({ error: 'Code already used by a booking' });

    const updated = await prisma.discountCode.update({ where: { id }, data: { status: body.data.status } });
    return updated;
  });

  // DELETE /discount-codes/:id — admin
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.discountCode.delete({ where: { id } });
    return reply.status(204).send();
  });
}
