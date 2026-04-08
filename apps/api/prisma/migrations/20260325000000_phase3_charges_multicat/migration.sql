-- CreateTable: Charge
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountDKK" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PriceCategoryCharge
CREATE TABLE "PriceCategoryCharge" (
    "priceCategoryId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,

    CONSTRAINT "PriceCategoryCharge_pkey" PRIMARY KEY ("priceCategoryId","chargeId")
);

-- CreateTable: RoomRoomCategory
CREATE TABLE "RoomRoomCategory" (
    "roomId" TEXT NOT NULL,
    "roomCategoryId" TEXT NOT NULL,

    CONSTRAINT "RoomRoomCategory_pkey" PRIMARY KEY ("roomId","roomCategoryId")
);

-- Migrate existing Room.categoryId data into RoomRoomCategory
INSERT INTO "RoomRoomCategory" ("roomId", "roomCategoryId")
SELECT "id", "categoryId"
FROM "Room"
WHERE "categoryId" IS NOT NULL;

-- DropForeignKey Room.categoryId
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_categoryId_fkey";

-- AlterTable Room: drop categoryId
ALTER TABLE "Room" DROP COLUMN IF EXISTS "categoryId";

-- AddForeignKey: PriceCategoryCharge -> PriceCategory
ALTER TABLE "PriceCategoryCharge" ADD CONSTRAINT "PriceCategoryCharge_priceCategoryId_fkey" FOREIGN KEY ("priceCategoryId") REFERENCES "PriceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PriceCategoryCharge -> Charge
ALTER TABLE "PriceCategoryCharge" ADD CONSTRAINT "PriceCategoryCharge_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: RoomRoomCategory -> Room
ALTER TABLE "RoomRoomCategory" ADD CONSTRAINT "RoomRoomCategory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: RoomRoomCategory -> RoomCategory
ALTER TABLE "RoomRoomCategory" ADD CONSTRAINT "RoomRoomCategory_roomCategoryId_fkey" FOREIGN KEY ("roomCategoryId") REFERENCES "RoomCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
