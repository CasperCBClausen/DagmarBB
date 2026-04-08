import type { RoomCategory } from './room';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'CUSTOMER_CANCELLED' | 'NO_SHOW';

export interface BookingRoom {
  id: string;
  bookingId: string;
  roomCategoryId?: string | null;
  roomCategory?: RoomCategory | null;
  roomId?: string | null;
  room?: { id: string; name: string; slug: string } | null;
  assignedRoomId?: string | null;
  assignedRoom?: { id: string; name: string; slug: string } | null;
  pricePerNight: number;
  subtotal: number;
  rateLabel?: string | null;
}

export interface Booking {
  id: string;
  bookingRef: string;
  roomId?: string | null;
  room?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  assignedRoomId?: string | null;
  assignedRoom?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  rateLabel?: string | null;
  isRefundable?: boolean;
  isAdminCreated?: boolean;
  status: BookingStatus;
  notes?: string;
  discountCode?: string | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  unreadMessages?: number;
  bookingRooms: BookingRoom[];
  createdAt: string;
}

export interface CreateBookingRequest {
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  notes?: string;
  paymentMethod: 'MOBILEPAY' | 'FLATPAY';
  rooms: Array<{
    roomCategoryId: string;
    count: number;
    pricePerNight: number;
    rateLabel?: string;
  }>;
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
}

export interface RateOption {
  label: string;
  pricePerNight: number;
  totalPrice: number;
  categoryId: string;
  cancellationDays?: number | null;
  serviceFeePercent?: number;
  isRefundable?: boolean;
  dayPrices?: Array<{ date: string; price: number }>;
  charges: Array<{ name: string; amountDKK: number }>;
  chargesTotal: number;
}

export interface CategoryAvailability {
  roomCategoryId: string;
  name: string;
  translations?: Record<string, string>;
  availableCount: number;
  rates: RateOption[];
}

export interface AvailabilityRatesResponse {
  categories: CategoryAvailability[];
  totalUniqueAvailable: number;
}

export interface PhysicalRoomSlot {
  categories: Array<{
    roomCategoryId: string;
    name: string;
    translations?: Record<string, string>;
    rates: RateOption[];
  }>;
}

export interface RoomSlotAvailabilityResponse {
  rooms: PhysicalRoomSlot[];
}
