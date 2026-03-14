import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwtPlugin from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth';
import { roomRoutes } from './routes/rooms';
import { bookingRoutes } from './routes/bookings';
import { paymentRoutes } from './routes/payments';
import { financialRoutes } from './routes/financials';
import { cleaningRoutes } from './routes/cleaning';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

async function start() {
  // CORS
  await fastify.register(cors, {
    origin: [CORS_ORIGIN, 'http://localhost:19006', 'exp://localhost:8081'],
    credentials: true,
  });

  // JWT
  await fastify.register(jwtPlugin, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });

  // Swagger docs
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Dagmar B&B API',
        description: 'REST API for Dagmar Bed & Breakfast, Ribe',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(roomRoutes, { prefix: '/api/v1/rooms' });
  await fastify.register(bookingRoutes, { prefix: '/api/v1/bookings' });
  await fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });
  await fastify.register(financialRoutes, { prefix: '/api/v1/financials' });
  await fastify.register(cleaningRoutes, { prefix: '/api/v1/cleaning' });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
