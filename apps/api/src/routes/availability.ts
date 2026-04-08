import { FastifyInstance } from 'fastify';
import { getAvailabilityRates, getAvailableRoomSlots } from '../services/pricingService';

export async function availabilityRoutes(fastify: FastifyInstance) {
  // GET /availability/rates?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD — public
  fastify.get('/rates', async (request, reply) => {
    const { checkIn, checkOut } = request.query as { checkIn?: string; checkOut?: string };

    if (!checkIn || !checkOut) {
      return reply.status(400).send({ error: 'checkIn and checkOut are required' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid date format' });
    }

    if (checkInDate >= checkOutDate) {
      return reply.status(400).send({ error: 'checkOut must be after checkIn' });
    }

    const result = await getAvailabilityRates(checkInDate, checkOutDate);
    return result;
  });

  // GET /availability/rooms?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD — public
  // Returns abstract room slots (no physical IDs) with per-category rates
  fastify.get('/rooms', async (request, reply) => {
    const { checkIn, checkOut } = request.query as { checkIn?: string; checkOut?: string };

    if (!checkIn || !checkOut) {
      return reply.status(400).send({ error: 'checkIn and checkOut are required' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid date format' });
    }

    if (checkInDate >= checkOutDate) {
      return reply.status(400).send({ error: 'checkOut must be after checkIn' });
    }

    const result = await getAvailableRoomSlots(checkInDate, checkOutDate);
    return result;
  });
}
