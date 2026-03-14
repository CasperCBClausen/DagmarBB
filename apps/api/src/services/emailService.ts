import type { Booking } from '@prisma/client';

export async function sendBookingConfirmation(booking: Booking & { room?: any }): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM || 'noreply@dagmarbb.dk';

  if (!RESEND_API_KEY || RESEND_API_KEY === 're_your_key_here') {
    console.log('Email service not configured, skipping confirmation email for booking:', booking.bookingRef);
    return;
  }

  const checkIn = new Date(booking.checkIn).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const checkOut = new Date(booking.checkOut).toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const roomName = booking.room?.name || 'dit værelse';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [booking.guestEmail],
        subject: `Booking bekræftelse — ${booking.bookingRef} — Dagmar B&B`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1A1A1A;">
            <h1 style="color: #7A3B1E; border-bottom: 1px solid #B8924A; padding-bottom: 16px;">Dagmar Bed & Breakfast</h1>
            <h2>Booking bekræftelse</h2>
            <p>Kære ${booking.guestName},</p>
            <p>Tak for din booking hos Dagmar B&B i Ribe. Vi ser frem til at byde dig velkommen!</p>
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
              <tr style="background: #FAFAF8;">
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Booking reference</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${booking.bookingRef}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Værelse</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${roomName}</td>
              </tr>
              <tr style="background: #FAFAF8;">
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Ankomst</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${checkIn} (fra kl. 15:00)</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Afrejse</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${checkOut} (inden kl. 11:00)</td>
              </tr>
              <tr style="background: #FAFAF8;">
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Antal nætter</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${booking.nights}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #e0e0e0;"><strong>Totalpris</strong></td>
                <td style="padding: 12px; border: 1px solid #e0e0e0;">${booking.totalPrice.toLocaleString('da-DK')} DKK</td>
              </tr>
            </table>
            <p>Du kan tilgå din booking via reference: <strong>${booking.bookingRef}</strong></p>
            <p>Har du spørgsmål? Kontakt os på <a href="mailto:info@dagmarbb.dk" style="color: #7A3B1E;">info@dagmarbb.dk</a></p>
            <hr style="border: none; border-top: 1px solid #B8924A; margin: 32px 0;">
            <p style="font-size: 14px; color: #666;">Dagmar B&B · Ribe, Danmark · dagmarbb.dk</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
    }
  } catch (err) {
    console.error('Email service error:', err);
  }
}
