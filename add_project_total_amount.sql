-- Добавить в таблицу projects поле "Сумма проекта"
-- Выполнить один раз при обновлении с уже существующей БД.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN projects.total_amount IS 'Сумма проекта (копируется из спецификации при согласовании КП)';
