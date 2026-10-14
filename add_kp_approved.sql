-- Добавить в таблицу specifications поле "КП согласовано" (булево)
-- Выполнить один раз при обновлении с уже существующей БД.

ALTER TABLE specifications
ADD COLUMN IF NOT EXISTS kp_approved BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN specifications.kp_approved IS 'КП согласовано';
