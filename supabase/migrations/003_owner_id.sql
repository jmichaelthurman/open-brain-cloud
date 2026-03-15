-- Migration: add owner_id to thoughts and thought_links
-- Requires: service account user created in auth.users first (Step 1 in issue #9)
-- The SERVICE_ACCOUNT_USER_ID UUID must be filled in before running Step B.

-- Step A: add column nullable
ALTER TABLE thoughts      ADD COLUMN owner_id UUID REFERENCES auth.users(id);
ALTER TABLE thought_links ADD COLUMN owner_id UUID REFERENCES auth.users(id);

-- Step B: backfill all existing rows to the service account user
-- Replace <SERVICE_ACCOUNT_USER_ID> with the UUID from Step 1 before running.
-- UPDATE thoughts      SET owner_id = '<SERVICE_ACCOUNT_USER_ID>';
-- UPDATE thought_links SET owner_id = '<SERVICE_ACCOUNT_USER_ID>';

-- Step C: enforce NOT NULL going forward (run after Step B completes)
-- ALTER TABLE thoughts      ALTER COLUMN owner_id SET NOT NULL;
-- ALTER TABLE thought_links ALTER COLUMN owner_id SET NOT NULL;
