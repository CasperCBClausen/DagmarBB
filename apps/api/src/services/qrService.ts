import crypto from 'crypto';
import QRCode from 'qrcode';

const HMAC_SECRET = process.env.QR_HMAC_SECRET || 'dev-qr-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:19006';

export async function generateQRCode(roomId: string): Promise<{ token: string; qrDataUrl: string }> {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(`${roomId}:${timestamp}`);
  const token = `${timestamp}.${hmac.digest('hex')}`;

  const deepLink = `${APP_URL}/cleaning/${roomId}?token=${encodeURIComponent(token)}`;
  const qrDataUrl = await QRCode.toDataURL(deepLink, {
    width: 400,
    margin: 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
  });

  return { token, qrDataUrl };
}

export function verifyQRToken(roomId: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET);
  hmac.update(`${roomId}:${timestamp}`);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
