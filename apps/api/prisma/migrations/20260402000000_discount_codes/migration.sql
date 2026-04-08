CREATE TABLE "DiscountCode" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "batchId" TEXT,
  "discountPercent" DOUBLE PRECISION NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'FREE',
  "usedByBookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
ALTER TABLE "Booking" ADD COLUMN "discountCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN "discountPercent" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN "discountAmount" DOUBLE PRECISION;
