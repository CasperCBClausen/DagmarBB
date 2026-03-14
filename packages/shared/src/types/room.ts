export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricePerNight: number;
  maxGuests: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CreateRoomRequest {
  slug: string;
  name: string;
  description: string;
  pricePerNight: number;
  maxGuests: number;
  amenities?: string[];
  images?: string[];
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string;
  pricePerNight?: number;
  maxGuests?: number;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}

export interface RoomAvailability {
  roomId: string;
  date: string;
  isAvailable: boolean;
}
