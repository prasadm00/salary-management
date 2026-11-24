-- Hand-written: Prisma cannot create extensions. pg_trgm powers the fast
-- "contains" search indexes on employees.full_name and employees.email.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employee_code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "department" VARCHAR(60) NOT NULL,
    "job_title" VARCHAR(80) NOT NULL,
    "level" VARCHAR(2) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "employment_status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "hire_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensations" (
    "employee_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effective_date" DATE NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensations_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "compensation_changes" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "old_amount" DECIMAL(14,2),
    "new_amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "idx_employees_country" ON "employees"("country");

-- CreateIndex
CREATE INDEX "idx_employees_department" ON "employees"("department");

-- CreateIndex
CREATE INDEX "idx_employees_level" ON "employees"("level");

-- CreateIndex
CREATE INDEX "idx_employees_country_department" ON "employees"("country", "department");

-- CreateIndex
CREATE INDEX "idx_employees_status" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "idx_employees_hire_date" ON "employees"("hire_date");

-- CreateIndex
CREATE INDEX "idx_employees_full_name_trgm" ON "employees" USING GIN ("full_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_employees_email_trgm" ON "employees" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_compensations_currency_amount" ON "compensations"("currency", "amount");

-- CreateIndex
CREATE INDEX "idx_changes_employee_changed_at" ON "compensation_changes"("employee_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_changes_changed_at" ON "compensation_changes"("changed_at" DESC);

-- AddForeignKey
ALTER TABLE "compensations" ADD CONSTRAINT "compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_changes" ADD CONSTRAINT "compensation_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: CHECK constraints are the database's last line of defence.
-- The application validates first and returns friendly errors (docs/LLD.md section 1.6).

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_level_check" CHECK ("level" IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6')),
  ADD CONSTRAINT "employees_country_check" CHECK ("country" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "employees_status_check" CHECK ("employment_status" IN ('ACTIVE', 'INACTIVE')),
  ADD CONSTRAINT "employees_email_lowercase_check" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "employees_not_blank_check" CHECK (
    btrim("employee_code") <> '' AND btrim("full_name") <> '' AND btrim("email") <> ''
    AND btrim("department") <> '' AND btrim("job_title") <> ''
  );

ALTER TABLE "compensations"
  ADD CONSTRAINT "compensations_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "compensations_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "compensation_changes"
  ADD CONSTRAINT "changes_old_amount_positive_check" CHECK ("old_amount" IS NULL OR "old_amount" > 0),
  ADD CONSTRAINT "changes_new_amount_positive_check" CHECK ("new_amount" > 0),
  ADD CONSTRAINT "changes_amount_differs_check" CHECK ("old_amount" IS NULL OR "old_amount" <> "new_amount"),
  ADD CONSTRAINT "changes_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "changes_reason_not_blank_check" CHECK (btrim("reason") <> '');
