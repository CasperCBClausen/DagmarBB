import axios, { AxiosInstance } from 'axios';
import type { LoginRequest, LoginResponse, RefreshResponse } from './types/user';
import type { Room, CreateRoomRequest, UpdateRoomRequest } from './types/room';
import type { Booking, CreateBookingRequest, UpdateBookingStatusRequest } from './types/booking';
import type { InitiatePaymentRequest, InitiatePaymentResponse } from './types/payment';
import type { CleaningStatus, UpdateCleaningRequest } from './types/cleaning';
import type { FinancialSummary, MonthlyRevenue, YearlyRevenue, RoomRevenue } from './types/financial';

export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  return client;
}

export class DagmarApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.client = createApiClient(baseURL);
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  // Auth
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await this.client.post<LoginResponse>('/auth/login', data);
    return res.data;
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const res = await this.client.post<RefreshResponse>('/auth/refresh', { refreshToken });
    return res.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.client.post('/auth/logout', { refreshToken });
  }

  // Rooms
  async getRooms(): Promise<Room[]> {
    const res = await this.client.get<Room[]>('/rooms');
    return res.data;
  }

  async getRoom(slug: string): Promise<Room> {
    const res = await this.client.get<Room>(`/rooms/${slug}`);
    return res.data;
  }

  async createRoom(data: CreateRoomRequest): Promise<Room> {
    const res = await this.client.post<Room>('/rooms', data);
    return res.data;
  }

  async updateRoom(id: string, data: UpdateRoomRequest): Promise<Room> {
    const res = await this.client.patch<Room>(`/rooms/${id}`, data);
    return res.data;
  }

  async deleteRoom(id: string): Promise<void> {
    await this.client.delete(`/rooms/${id}`);
  }

  async getRoomAvailability(slug: string, startDate: string, endDate: string): Promise<{ dates: string[] }> {
    const res = await this.client.get(`/rooms/${slug}/availability`, { params: { startDate, endDate } });
    return res.data;
  }

  // Bookings
  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const res = await this.client.post<Booking>('/bookings', data);
    return res.data;
  }

  async getBookings(params?: { status?: string; from?: string; to?: string }): Promise<Booking[]> {
    const res = await this.client.get<Booking[]>('/bookings', { params });
    return res.data;
  }

  async getBookingByRef(ref: string): Promise<Booking> {
    const res = await this.client.get<Booking>(`/bookings/ref/${ref}`);
    return res.data;
  }

  async updateBookingStatus(id: string, data: UpdateBookingStatusRequest): Promise<Booking> {
    const res = await this.client.patch<Booking>(`/bookings/${id}/status`, data);
    return res.data;
  }

  // Payments
  async initiateMobilepay(data: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    const res = await this.client.post<InitiatePaymentResponse>('/payments/mobilepay/initiate', data);
    return res.data;
  }

  async initiateFlatpay(data: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    const res = await this.client.post<InitiatePaymentResponse>('/payments/flatpay/initiate', data);
    return res.data;
  }

  // Cleaning
  async getCleaningStatus(): Promise<CleaningStatus[]> {
    const res = await this.client.get<CleaningStatus[]>('/cleaning/status');
    return res.data;
  }

  async updateCleaningStatus(roomId: string, data: UpdateCleaningRequest): Promise<CleaningStatus> {
    const res = await this.client.patch<CleaningStatus>(`/cleaning/${roomId}`, data);
    return res.data;
  }

  async getRoomQR(roomId: string): Promise<{ qrDataUrl: string; token: string }> {
    const res = await this.client.get(`/rooms/${roomId}/qr`);
    return res.data;
  }

  // Financials
  async getFinancialSummary(): Promise<FinancialSummary> {
    const res = await this.client.get<FinancialSummary>('/financials/summary');
    return res.data;
  }

  async getMonthlyRevenue(year: number): Promise<MonthlyRevenue[]> {
    const res = await this.client.get<MonthlyRevenue[]>('/financials/monthly', { params: { year } });
    return res.data;
  }

  async getYearlyRevenue(): Promise<YearlyRevenue[]> {
    const res = await this.client.get<YearlyRevenue[]>('/financials/yearly');
    return res.data;
  }

  async getRevenueByRoom(): Promise<RoomRevenue[]> {
    const res = await this.client.get<RoomRevenue[]>('/financials/by-room');
    return res.data;
  }
}
