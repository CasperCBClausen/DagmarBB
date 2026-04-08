import { prisma } from '../lib/prisma';
import type { RateOption, CategoryAvailability } from '@dagmar/shared';

export type { RateOption, CategoryAvailability };

// Returns 1 if the current time is at or past today's configured arrival time, else 0.
// Used to add an extra day to the minimum advance booking window so hosts aren't
// surprised by same-evening arrivals they haven't seen yet.
async function getExtraAdvanceDays(): Promise<number> {
  const row = await prisma.siteSettings.findUnique({ where: { key: 'arrivalTime' } });
  const arrivalTime = row?.value ?? '16:00';
  const [h, m] = arrivalTime.split(':').map(Number);
  const now = new Date();
  const arrivalToday = new Date(now);
  arrivalToday.setHours(h, m, 0, 0);
  return now >= arrivalToday ? 1 : 0;
}

export async function getCategoryRates(
  roomCategoryId: string,
  checkIn: Date,
  checkOut: Date,
  extraAdvanceDays = 0
): Promise<RateOption[]> {
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  const priceCategories = await prisma.priceCategory.findMany({
    where: { roomCategoryId },
    include: {
      days: {
        where: {
          date: { gte: checkIn, lt: checkOut },
        },
        orderBy: { date: 'asc' },
      },
      charges: { include: { charge: true } },
    },
  });

  // Build parent charges map so sub-categories can inherit
  const parentChargesById = new Map<string, Array<{ charge: { name: string; amountDKK: number } }>>();
  for (const cat of priceCategories) {
    if (!cat.parentId) parentChargesById.set(cat.id, cat.charges);
  }

  const rates: RateOption[] = [];

  for (const cat of priceCategories) {
    // Need a day record for every night
    if (cat.days.length < nights) {
      // Incomplete coverage — fall back to room base price
      continue;
    }

    // Check arrival allowed on checkIn day and departure allowed on checkOut day
    const checkInDay = cat.days.find(d => {
      const dDate = new Date(d.date);
      return dDate.toDateString() === checkIn.toDateString();
    });
    const checkOutDay = cat.days.find(d => {
      const dDate = new Date(d.date);
      // checkOut is the departure date — the day before checkOut in our set
      const dayBefore = new Date(checkOut);
      dayBefore.setDate(dayBefore.getDate() - 1);
      return dDate.toDateString() === dayBefore.toDateString();
    });

    if (checkInDay && !checkInDay.arrivalAllowed) continue;
    if (checkOutDay && !checkOutDay.departureAllowed) continue;

    // Check min advance booking days (plus extra day if booking is made after today's arrival time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxMinAdvance = Math.max(...cat.days.map(d => d.minAdvanceBookingDays));
    const minCheckIn = new Date(today);
    minCheckIn.setDate(minCheckIn.getDate() + maxMinAdvance + extraAdvanceDays);
    if (checkIn < minCheckIn) continue;

    // Check min stay
    const maxMinStay = Math.max(...cat.days.map(d => d.minStayNights));
    if (nights < maxMinStay) continue;

    const totalPrice = cat.days.reduce((sum, d) => sum + d.pricePerNight, 0);
    const avgPrice = totalPrice / cat.days.length;

    // Sub-categories inherit charges from their parent main category
    const effectiveChargeSource = cat.parentId
      ? (parentChargesById.get(cat.parentId) ?? cat.charges)
      : cat.charges;
    const charges = effectiveChargeSource.map(pc => ({ name: pc.charge.name, amountDKK: pc.charge.amountDKK }));
    const chargesTotal = charges.reduce((sum, c) => sum + c.amountDKK, 0);

    rates.push({
      label: cat.name,
      pricePerNight: Math.round(avgPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      categoryId: cat.id,
      cancellationDays: Math.max(...cat.days.map(d => d.cancellationDays ?? 0)) || null,
      serviceFeePercent: cat.serviceFeePercent ?? 0,
      isRefundable: cat.isRefundable ?? true,
      dayPrices: cat.days.map(d => ({
        date: new Date(d.date).toISOString().slice(0, 10),
        price: Math.round(d.pricePerNight * 100) / 100,
      })),
      charges,
      chargesTotal,
    });
  }

  return rates;
}

export async function getAvailabilityRates(
  checkIn: Date,
  checkOut: Date
): Promise<{ categories: CategoryAvailability[]; totalUniqueAvailable: number }> {
  const extraAdvanceDays = await getExtraAdvanceDays();

  const roomCategories = await prisma.roomCategory.findMany({
    include: { rooms: { where: { room: { isActive: true } } } },
  });

  const bookingFilter = {
    status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] as ('CANCELLED' | 'CUSTOMER_CANCELLED' | 'NO_SHOW')[] },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };

  const categories: CategoryAvailability[] = [];

  for (const roomCat of roomCategories) {
    if (roomCat.rooms.length === 0) continue;

    const catRoomIds = roomCat.rooms.map(r => r.roomId);

    // Rooms definitively blocked: closed periods (category-aware) OR rooms with an assigned booking
    const directlyBlockedIds = new Set<string>();
    const closedRows = await prisma.closedPeriod.findMany({
      where: { roomId: { in: catRoomIds }, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
      select: { roomId: true, roomCategoryIds: true },
    });
    // A room is blocked for this category if: roomCategoryIds is empty (all blocked) OR includes this cat
    closedRows.forEach(r => {
      if (r.roomCategoryIds.length === 0 || r.roomCategoryIds.includes(roomCat.id)) {
        directlyBlockedIds.add(r.roomId);
      }
    });
    const assignedRows = await prisma.bookingRoom.findMany({
      where: { assignedRoomId: { in: catRoomIds }, booking: bookingFilter },
      select: { assignedRoomId: true },
    });
    assignedRows.forEach(r => { if (r.assignedRoomId) directlyBlockedIds.add(r.assignedRoomId); });

    // Unassigned bookings in THIS category — each consumes one room slot
    const unassignedInCat = await prisma.bookingRoom.count({
      where: { roomCategoryId: roomCat.id, assignedRoomId: null, booking: bookingFilter },
    });

    // Cross-category spillover: unassigned bookings in OTHER categories that share rooms
    // with this one may be forced to use shared rooms when their exclusive rooms are exhausted.
    // overflow_K = max(0, unassigned_K − exclusive_rooms_K)
    // consumed_from_this_cat = min(overflow_K, shared_rooms_between_K_and_this)
    const sharedLinks = await prisma.roomRoomCategory.findMany({
      where: { roomId: { in: catRoomIds }, roomCategoryId: { not: roomCat.id } },
      select: { roomCategoryId: true, roomId: true },
    });
    const sharedByOtherCat = new Map<string, Set<string>>();
    for (const link of sharedLinks) {
      if (!sharedByOtherCat.has(link.roomCategoryId)) sharedByOtherCat.set(link.roomCategoryId, new Set());
      sharedByOtherCat.get(link.roomCategoryId)!.add(link.roomId);
    }

    let crossConsumed = 0;
    for (const [otherCatId, sharedIds] of sharedByOtherCat.entries()) {
      const totalInOther = await prisma.roomRoomCategory.count({
        where: { roomCategoryId: otherCatId, room: { isActive: true } },
      });
      const unassignedInOther = await prisma.bookingRoom.count({
        where: { roomCategoryId: otherCatId, assignedRoomId: null, booking: bookingFilter },
      });
      // Rooms in the other category that don't overlap with the current category
      const exclusiveInOther = totalInOther - sharedIds.size;
      const overflow = Math.max(0, unassignedInOther - exclusiveInOther);
      crossConsumed += Math.min(overflow, sharedIds.size);
    }

    const availableCount = Math.max(0, catRoomIds.length - directlyBlockedIds.size - unassignedInCat - crossConsumed);

    const rates = await getCategoryRates(roomCat.id, checkIn, checkOut, extraAdvanceDays);
    if (rates.length === 0) continue;

    categories.push({ roomCategoryId: roomCat.id, name: roomCat.name, translations: roomCat.translations as Record<string, string>, availableCount, rates });
  }

  // Total unique physical rooms available across all shown categories (deduped)
  const shownCategoryIds = categories.map(c => c.roomCategoryId);
  let totalUniqueAvailable = 0;
  if (shownCategoryIds.length > 0) {
    const allLinks = await prisma.roomRoomCategory.findMany({
      where: { roomCategoryId: { in: shownCategoryIds }, room: { isActive: true } },
      select: { roomId: true },
    });
    const uniqueRoomIds = [...new Set(allLinks.map(r => r.roomId))];

    const directlyBlockedIds = new Set<string>();
    for (const roomId of uniqueRoomIds) {
      const assigned = await prisma.bookingRoom.findFirst({
        where: { assignedRoomId: roomId, booking: bookingFilter },
      });
      if (assigned) { directlyBlockedIds.add(roomId); continue; }
      const closed = await prisma.closedPeriod.findFirst({
        where: { roomId, startDate: { lt: checkOut }, endDate: { gt: checkIn }, roomCategoryIds: { isEmpty: true } },
      });
      if (closed) directlyBlockedIds.add(roomId);
    }

    const totalUnassigned = await prisma.bookingRoom.count({
      where: { roomCategoryId: { in: shownCategoryIds }, assignedRoomId: null, booking: bookingFilter },
    });

    totalUniqueAvailable = Math.max(0, uniqueRoomIds.length - directlyBlockedIds.size - totalUnassigned);
  }

  return { categories, totalUniqueAvailable };
}

export async function getAvailableRoomSlots(
  checkIn: Date,
  checkOut: Date
): Promise<{ rooms: Array<{ categories: Array<{ roomCategoryId: string; name: string; translations?: Record<string, string>; rates: RateOption[] }> }> }> {
  const extraAdvanceDays = await getExtraAdvanceDays();

  const allRooms = await prisma.room.findMany({
    where: { isActive: true },
    include: {
      roomCategories: { include: { roomCategory: true } },
    },
    orderBy: { name: 'asc' },
  });

  const bookingFilter = {
    status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'NO_SHOW'] as ('CANCELLED' | 'CUSTOMER_CANCELLED' | 'NO_SHOW')[] },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };

  const allRoomIds = allRooms.map(r => r.id);

  // Fetch closed periods with category info for all rooms
  const closedRows = await prisma.closedPeriod.findMany({
    where: { roomId: { in: allRoomIds }, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
    select: { roomId: true, roomCategoryIds: true },
  });
  // Map roomId → set of categoryIds that are fully blocked (empty = all)
  const closedByRoom = new Map<string, Array<{ roomCategoryIds: string[] }>>();
  for (const r of closedRows) {
    if (!closedByRoom.has(r.roomId)) closedByRoom.set(r.roomId, []);
    closedByRoom.get(r.roomId)!.push({ roomCategoryIds: r.roomCategoryIds });
  }

  // Rooms where ALL categories are blocked (fully blocked = no available category)
  const fullyBlockedIds = new Set<string>();
  for (const room of allRooms) {
    const periods = closedByRoom.get(room.id) ?? [];
    const isFullyBlocked = periods.some(p => p.roomCategoryIds.length === 0);
    if (isFullyBlocked) fullyBlockedIds.add(room.id);
  }

  const assignedRows = await prisma.bookingRoom.findMany({
    where: { assignedRoomId: { in: allRoomIds }, booking: bookingFilter },
    select: { assignedRoomId: true },
  });
  assignedRows.forEach(r => { if (r.assignedRoomId) fullyBlockedIds.add(r.assignedRoomId); });

  // Rooms that have at least one available category
  const potentialRooms = allRooms.filter(r => !fullyBlockedIds.has(r.id));

  const categoryIds = [...new Set(allRooms.flatMap(r => r.roomCategories.map(rc => rc.roomCategoryId)))];
  const totalUnassigned = categoryIds.length > 0
    ? await prisma.bookingRoom.count({
        where: { roomCategoryId: { in: categoryIds }, assignedRoomId: null, booking: bookingFilter },
      })
    : 0;

  // Pre-compute remaining capacity per category so we can hide fully-consumed categories
  // from room slot options (prevents double-booking when only 1 physical room serves a category)
  const catCapacityMap = new Map<string, number>();
  for (const catId of categoryIds) {
    const catRoomIds = allRooms
      .filter(r => r.roomCategories.some(rc => rc.roomCategoryId === catId))
      .map(r => r.id);
    const blocked = new Set<string>();
    closedRows.forEach(r => {
      if (catRoomIds.includes(r.roomId) && (r.roomCategoryIds.length === 0 || r.roomCategoryIds.includes(catId))) {
        blocked.add(r.roomId);
      }
    });
    assignedRows.forEach(r => { if (r.assignedRoomId && catRoomIds.includes(r.assignedRoomId)) blocked.add(r.assignedRoomId); });
    const unassigned = await prisma.bookingRoom.count({
      where: { roomCategoryId: catId, assignedRoomId: null, booking: bookingFilter },
    });
    catCapacityMap.set(catId, Math.max(0, catRoomIds.length - blocked.size - unassigned));
  }

  const slotsToReturn = Math.max(0, potentialRooms.length - totalUnassigned);

  // Multi-category rooms first so they're shown to guests with the category picker
  const sorted = [...potentialRooms].sort((a, b) => b.roomCategories.length - a.roomCategories.length);
  const toShow = sorted.slice(0, slotsToReturn);

  const result: Array<{ categories: Array<{ roomCategoryId: string; name: string; translations?: Record<string, string>; rates: RateOption[] }> }> = [];

  for (const room of toShow) {
    const cats: Array<{ roomCategoryId: string; name: string; translations?: Record<string, string>; rates: RateOption[] }> = [];
    const periods = closedByRoom.get(room.id) ?? [];
    for (const rc of room.roomCategories) {
      // Skip if category has no remaining capacity (all slots consumed by existing unassigned bookings)
      if ((catCapacityMap.get(rc.roomCategoryId) ?? 0) <= 0) continue;
      // Skip if this category is blocked for this room
      const isBlocked = periods.some(p =>
        p.roomCategoryIds.length === 0 || p.roomCategoryIds.includes(rc.roomCategoryId)
      );
      if (isBlocked) continue;
      const rates = await getCategoryRates(rc.roomCategoryId, checkIn, checkOut, extraAdvanceDays);
      if (rates.length > 0) {
        cats.push({ roomCategoryId: rc.roomCategoryId, name: rc.roomCategory.name, translations: rc.roomCategory.translations as Record<string, string>, rates });
      }
    }
    if (cats.length > 0) result.push({ categories: cats });
  }

  return { rooms: result };
}
