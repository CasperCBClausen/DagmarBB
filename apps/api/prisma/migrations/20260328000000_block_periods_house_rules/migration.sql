-- CreateTable
CREATE TABLE "BlockPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockPeriodCategory" (
    "blockPeriodId" TEXT NOT NULL,
    "roomCategoryId" TEXT NOT NULL,

    CONSTRAINT "BlockPeriodCategory_pkey" PRIMARY KEY ("blockPeriodId","roomCategoryId")
);

-- CreateTable
CREATE TABLE "HouseRule" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BlockPeriodCategory" ADD CONSTRAINT "BlockPeriodCategory_blockPeriodId_fkey" FOREIGN KEY ("blockPeriodId") REFERENCES "BlockPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockPeriodCategory" ADD CONSTRAINT "BlockPeriodCategory_roomCategoryId_fkey" FOREIGN KEY ("roomCategoryId") REFERENCES "RoomCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
