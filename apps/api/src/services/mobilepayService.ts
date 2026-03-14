import type { Booking } from '@prisma/client';

const MOBILEPAY_CLIENT_ID = process.env.MOBILEPAY_CLIENT_ID || '';
const MOBILEPAY_CLIENT_SECRET = process.env.MOBILEPAY_CLIENT_SECRET || '';
const MOBILEPAY_MSN = process.env.MOBILEPAY_MERCHANT_SERIAL_NUMBER || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function getMobilepayToken(): Promise<string> {
  const response = await fetch('https://api.vipps.no/accesstoken/get', {
    method: 'POST',
    headers: {
      'client_id': MOBILEPAY_CLIENT_ID,
      'client_secret': MOBILEPAY_CLIENT_SECRET,
      'Ocp-Apim-Subscription-Key': MOBILEPAY_MSN,
      'Merchant-Serial-Number': MOBILEPAY_MSN,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get MobilePay access token');
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function initiateMobilepay(booking: Booking): Promise<{ redirectUrl: string; paymentId: string }> {
  // Sandbox mode if credentials not set
  if (!MOBILEPAY_CLIENT_ID || !MOBILEPAY_CLIENT_SECRET) {
    console.log('MobilePay sandbox mode — returning mock redirect');
    return {
      paymentId: `mock-mp-${booking.id}`,
      redirectUrl: `${FRONTEND_URL}/book/confirm/${booking.bookingRef}?payment=sandbox`,
    };
  }

  const token = await getMobilepayToken();

  const response = await fetch('https://api.vipps.no/epayment/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Merchant-Serial-Number': MOBILEPAY_MSN,
      'Ocp-Apim-Subscription-Key': MOBILEPAY_MSN,
    },
    body: JSON.stringify({
      amount: { currency: 'DKK', value: Math.round(booking.totalPrice * 100) },
      paymentMethod: { type: 'WALLET' },
      reference: booking.bookingRef,
      returnUrl: `${FRONTEND_URL}/book/confirm/${booking.bookingRef}`,
      userFlow: 'WEB_REDIRECT',
      paymentDescription: `Dagmar B&B - ${booking.bookingRef}`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to initiate MobilePay payment');
  }

  const data = await response.json() as { redirectUrl: string; paymentId: string };
  return { redirectUrl: data.redirectUrl, paymentId: data.paymentId };
}
