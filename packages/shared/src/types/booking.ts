export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export interface Booking {
  id: string;
  bookingRef: string;
  roomId: string;
  room?: {
    id: string;
    name: string;
    slug: string;
  };
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
}

export interface CreateBookingRequest {
  roomId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  notes?: string;
  paymentMethod: 'MOBILEPAY' | 'FLATPAY';
}

export interface UpdateBookingStatusRequest {
  status: BookingStatus;
}
