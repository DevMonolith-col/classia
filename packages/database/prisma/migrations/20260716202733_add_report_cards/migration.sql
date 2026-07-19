-- CreateEnum
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FINAL');

-- CreateTable
CREATE TABLE "report_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "periodId" TEXT,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'PUBLISHED',
    "overallAverage" DOUBLE PRECISION NOT NULL,
    "scaleName" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_card_lines" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "final" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "passing" BOOLEAN NOT NULL,

    CONSTRAINT "report_card_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_cards_tenantId_studentId_academicYearId_idx" ON "report_cards"("tenantId", "studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "report_card_lines_reportCardId_idx" ON "report_card_lines"("reportCardId");

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_lines" ADD CONSTRAINT "report_card_lines_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "report_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_lines" ADD CONSTRAINT "report_card_lines_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
