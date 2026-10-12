-- Migration: 20261012110000_add_loaders_only_to_trip_type.sql
-- Добавление значения 'loaders_only' в enum trip_type для рейсов ПРР (без авто)

ALTER TYPE trip_type ADD VALUE IF NOT EXISTS 'loaders_only';
