export type PaymentMethod = 'MOBILEPAY' | 'FLATPAY';
export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

export interface Payment {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  providerPaymentId?: string;
  createdAt: string;
}

export interface InitiatePaymentRequest {
  bookingId: string;
}

export interface InitiatePaymentResponse {
  redirectUrl: string;
  paymentId: string;
}
