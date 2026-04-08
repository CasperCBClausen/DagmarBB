import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { initiateMobilepay } from '../services/mobilepayService';
import { initiateFlatpay } from '../services/flatpayService';
import { sendBookingConfirmation } from '../services/emailService';

const initiateSchema = z.object({ bookingId: z.string() });

export async function paymentRoutes(fastify: FastifyInstance) {
  // POST /payments/mobilepay/initiate
  fastify.post('/mobilepay/initiate', async (request, reply) => {
    const body = initiateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const booking = await prisma.booking.findUnique({ where: { id: body.data.bookingId } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.status !== 'PENDING') return reply.status(400).send({ error: 'Booking is not pending' });

    const result = await initiateMobilepay(booking);

    await prisma.payment.upsert({
      where: { bookingId: booking.id },
      update: { providerPaymentId: result.paymentId, status: 'PENDING' },
      create: {
        bookingId: booking.id,
        method: 'MOBILEPAY',
        status: 'PENDING',
        amount: booking.totalPrice,
        providerPaymentId: result.paymentId,
      },
    });

    return result;
  });

  // POST /payments/flatpay/initiate
  fastify.post('/flatpay/initiate', async (request, reply) => {
    const body = initiateSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'Invalid input' });

    const booking = await prisma.booking.findUnique({ where: { id: body.data.bookingId } });
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (booking.status !== 'PENDING') return reply.status(400).send({ error: 'Booking is not pending' });

    const result = await initiateFlatpay(booking);

    await prisma.payment.upsert({
      where: { bookingId: booking.id },
      update: { providerPaymentId: result.paymentId, status: 'PENDING' },
      create: {
        bookingId: booking.id,
        method: 'FLATPAY',
        status: 'PENDING',
        amount: booking.totalPrice,
        providerPaymentId: result.paymentId,
      },
    });

    return result;
  });

  // POST /payments/mobilepay/webhook
  fastify.post('/mobilepay/webhook', async (request, reply) => {
    const body = request.body as any;

    if (body?.eventType === 'payment.captured' && body?.reference) {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: body.reference },
        include: { booking: { include: { room: true } } },
      });

      if (payment) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });
        await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } });

        // Schedule cleaning after checkout
        const roomIdForCleaning = payment.booking.roomId;
        if (roomIdForCleaning) {
          await prisma.cleaningStatus.upsert({
            where: { roomId: roomIdForCleaning },
            update: {},
            create: { roomId: roomIdForCleaning, state: 'CLEAN' },
          });
        }

        await sendBookingConfirmation(payment.booking);
      }
    }

    return { received: true };
  });

  // POST /payments/flatpay/webhook
  fastify.post('/flatpay/webhook', async (request, reply) => {
    const body = request.body as any;

    if (body?.status === 'completed' && body?.orderId) {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: body.orderId },
        include: { booking: { include: { room: true } } },
      });

      if (payment) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });
        await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } });
        await sendBookingConfirmation(payment.booking);
      }
    }

    return { received: true };
  });
}
