-- Migration: 20261025000002_assign_cleaners.sql
-- Назначение роли cleaner Татьяне и Ирине
UPDATE users SET roles = ARRAY['cleaner']::user_role[] WHERE name IN ('Татьяна', 'Ирина');
