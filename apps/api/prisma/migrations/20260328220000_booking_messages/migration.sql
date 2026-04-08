CREATE TABLE "BookingMessage" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "senderName" TEXT,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
