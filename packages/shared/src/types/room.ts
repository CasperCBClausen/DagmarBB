export interface RoomCategory {
  id: string;
  name: string;
  translations?: Record<string, string>;
  createdAt: string;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string;
  maxGuests: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  roomCategories: Array<{ roomId: string; roomCategoryId: string; roomCategory: RoomCategory }>;
  createdAt: string;
}

export interface CreateRoomRequest {
  slug: string;
  name: string;
  description: string;
  maxGuests: number;
  amenities?: string[];
  images?: string[];
  categoryIds?: string[];
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string;
  maxGuests?: number;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
  categoryIds?: string[];
}

export interface RoomAvailability {
  roomId: string;
  date: string;
  isAvailable: boolean;
}

export interface Charge {
  id: string;
  name: string;
  amountDKK: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceCategory {
  id: string;
  name: string;
  roomCategoryId: string;
  roomCategory: RoomCategory;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  children?: PriceCategory[];
  savingsPercent?: number | null;
  serviceFeePercent: number;
  isRefundable: boolean;
  charges: Array<{ priceCategoryId: string; chargeId: string; charge: Charge }>;
  createdAt: string;
  _count?: { days: number };
}

export interface PriceCategoryDay {
  id: string;
  categoryId: string;
  date: string;
  pricePerNight: number;
  arrivalAllowed: boolean;
  departureAllowed: boolean;
  minAdvanceBookingDays: number;
  minStayNights: number;
  cancellationDays: number;
  isCustom: boolean;
}

export interface CalendarSource {
  id: string;
  name: string;
  feedUrl: string;
  lastSync?: string | null;
  createdAt: string;
  rooms: Array<{
    sourceId: string;
    roomId: string;
    room: { id: string; name: string; slug: string };
  }>;
}
