import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../lib/auth';

export async function financialRoutes(fastify: FastifyInstance) {
  // GET /financials/summary
  fastify.get('/summary', { preHandler: [requireAdmin] }, async () => {
    const [bookings, rooms] = await Promise.all([
      prisma.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
        include: { room: true },
      }),
      prisma.room.findMany({ where: { isActive: true } }),
    ]);

    const totalRevenue = bookings.reduce((sum: number, b) => sum + b.totalPrice, 0);
    const totalBookings = bookings.length;
    const averageStay = totalBookings > 0 ? bookings.reduce((sum: number, b) => sum + b.nights, 0) / totalBookings : 0;

    // Occupancy rate (last 365 days)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const recentBookings = bookings.filter(b => b.checkIn >= yearAgo);
    const occupiedNights = recentBookings.reduce((sum: number, b) => sum + b.nights, 0);
    const totalPossibleNights = rooms.length * 365;
    const occupancyRate = totalPossibleNights > 0 ? (occupiedNights / totalPossibleNights) * 100 : 0;

    // Monthly breakdown (last 12 months)
    const revenueByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthBookings = bookings.filter(b => {
        const d = new Date(b.checkIn);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      revenueByMonth.push({
        year,
        month,
        revenue: monthBookings.reduce((sum: number, b) => sum + b.totalPrice, 0),
        bookings: monthBookings.length,
      });
    }

    // Revenue by room
    const revenueByRoom = rooms.map(room => {
      const roomBookings = bookings.filter(b => b.roomId === room.id);
      const revenue = roomBookings.reduce((sum: number, b) => sum + b.totalPrice, 0);
      const roomOccupied = roomBookings.reduce((sum: number, b) => sum + b.nights, 0);
      return {
        roomId: room.id,
        roomName: room.name,
        revenue,
        bookings: roomBookings.length,
        occupancyRate: (roomOccupied / 365) * 100,
      };
    });

    return { totalRevenue, totalBookings, occupancyRate, averageStay, revenueByMonth, revenueByRoom };
  });

  // GET /financials/monthly
  fastify.get('/monthly', { preHandler: [requireAdmin] }, async (request) => {
    const { year } = request.query as { year?: string };
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const start = new Date(targetYear, 0, 1);
    const end = new Date(targetYear, 11, 31);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { gte: start, lte: end },
      },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthBookings = bookings.filter(b => new Date(b.checkIn).getMonth() + 1 === month);
      return {
        year: targetYear,
        month,
        revenue: monthBookings.reduce((sum: number, b) => sum + b.totalPrice, 0),
        bookings: monthBookings.length,
      };
    });

    return monthly;
  });

  // GET /financials/yearly
  fastify.get('/yearly', { preHandler: [requireAdmin] }, async () => {
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
    });

    const byYear: Record<number, { revenue: number; bookings: number }> = {};
    for (const b of bookings) {
      const year = new Date(b.checkIn).getFullYear();
      if (!byYear[year]) byYear[year] = { revenue: 0, bookings: 0 };
      byYear[year].revenue += b.totalPrice;
      byYear[year].bookings++;
    }

    return Object.entries(byYear)
      .map(([year, data]) => ({ year: parseInt(year), ...data }))
      .sort((a, b) => a.year - b.year);
  });

  // GET /financials/by-room
  fastify.get('/by-room', { preHandler: [requireAdmin] }, async () => {
    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
        },
      },
    });

    return rooms.map(room => ({
      roomId: room.id,
      roomName: room.name,
      revenue: room.bookings.reduce((sum: number, b) => sum + b.totalPrice, 0),
      bookings: room.bookings.length,
      occupancyRate: (room.bookings.reduce((sum: number, b) => sum + b.nights, 0) / 365) * 100,
    }));
  });
}
