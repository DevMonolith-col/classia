-- AlterTable
ALTER TABLE "homework" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "cutOffDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "homework_submissions" ADD COLUMN     "feedbackComment" TEXT,
ADD COLUMN     "feedbackKey" TEXT,
ADD COLUMN     "feedbackName" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "comment" TEXT;
