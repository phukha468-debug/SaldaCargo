-- Migration: 20261025000001_add_cleaner_role.sql
-- Добавление роли 'cleaner' в enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cleaner';
