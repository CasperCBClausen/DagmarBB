-- Add translations JSONB column to HouseRule
ALTER TABLE "HouseRule" ADD COLUMN "translations" JSONB NOT NULL DEFAULT '{}';
