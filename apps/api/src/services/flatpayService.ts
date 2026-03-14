import type { Booking } from '@prisma/client';

const FLATPAY_API_KEY = process.env.FLATPAY_API_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function initiateFlatpay(booking: Booking): Promise<{ redirectUrl: string; paymentId: string }> {
  // Sandbox mode if API key not set
  if (!FLATPAY_API_KEY) {
    console.log('Flatpay sandbox mode — returning mock redirect');
    return {
      paymentId: `mock-fp-${booking.id}`,
      redirectUrl: `${FRONTEND_URL}/book/confirm/${booking.bookingRef}?payment=sandbox`,
    };
  }

  const response = await fetch('https://api.flatpay.app/charges', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FLATPAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(booking.totalPrice * 100),
      currency: 'DKK',
      orderId: booking.bookingRef,
      description: `Dagmar B&B - ${booking.bookingRef}`,
      successUrl: `${FRONTEND_URL}/book/confirm/${booking.bookingRef}`,
      cancelUrl: `${FRONTEND_URL}/book/${booking.bookingRef}?cancelled=true`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to initiate Flatpay payment');
  }

  const data = await response.json() as { checkoutUrl: string; id: string };
  return { redirectUrl: data.checkoutUrl, paymentId: data.id };
}
