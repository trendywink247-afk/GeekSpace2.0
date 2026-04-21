-- ============================================================
-- Memory Module — add missing columns to agent_memory
--
-- agent_memory and conversation_log are created by 0000_baseline.sql.
-- This migration adds the columns that initMemoryTables() previously
-- supplied at runtime but that are absent from the baseline definition.
-- ============================================================

-- last_accessed_at: used by cognitive-memory decay and access-tracking queries
ALTER TABLE agent_memory ADD COLUMN last_accessed_at TEXT;
