-- AlterTable
ALTER TABLE "homework" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "homework_submissions" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentName" TEXT;

-- AlterTable
ALTER TABLE "marks" ADD COLUMN     "homeworkId" TEXT;

-- AddForeignKey
ALTER TABLE "marks" ADD CONSTRAINT "marks_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id") ON DELETE SET NULL ON UPDATE CASCADE;
