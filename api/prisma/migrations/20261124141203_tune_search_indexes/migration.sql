-- DropIndex
DROP INDEX "idx_employees_country";

-- CreateIndex
CREATE INDEX "idx_employees_code_trgm" ON "employees" USING GIN ("employee_code" gin_trgm_ops);
