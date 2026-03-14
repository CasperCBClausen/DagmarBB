export interface FinancialSummary {
  totalRevenue: number;
  totalBookings: number;
  occupancyRate: number;
  averageStay: number;
  revenueByMonth: MonthlyRevenue[];
  revenueByRoom: RoomRevenue[];
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  bookings: number;
}

export interface YearlyRevenue {
  year: number;
  revenue: number;
  bookings: number;
}

export interface RoomRevenue {
  roomId: string;
  roomName: string;
  revenue: number;
  bookings: number;
  occupancyRate: number;
}
