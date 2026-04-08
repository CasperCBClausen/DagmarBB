-- Add CUSTOMER_CANCELLED to BookingStatus enum
ALTER TYPE "BookingStatus" ADD VALUE 'CUSTOMER_CANCELLED';

-- Add adminRead flag to BookingMessage
ALTER TABLE "BookingMessage" ADD COLUMN "adminRead" BOOLEAN NOT NULL DEFAULT false;
