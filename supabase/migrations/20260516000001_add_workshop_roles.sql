-- Rollback: ALTER TYPE user_role RENAME TO user_role_old; then recreate without these values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'welder';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'painter';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'electrician';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'handyman';
