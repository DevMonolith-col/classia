-- AlterTable
ALTER TABLE "homework" ADD COLUMN     "allowNavigation" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "question_options" ADD COLUMN     "feedback" TEXT;

