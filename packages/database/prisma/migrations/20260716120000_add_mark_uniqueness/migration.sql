-- CreateIndex
CREATE UNIQUE INDEX "marks_studentId_homeworkId_key" ON "marks"("studentId", "homeworkId");

-- CreateIndex
CREATE INDEX "marks_tenantId_period_idx" ON "marks"("tenantId", "period");
