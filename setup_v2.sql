
-- 1. Create bot_commands table if missing
CREATE TABLE IF NOT EXISTS bot_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Enable RLS and Policies for bot_commands
ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access on bot_commands" ON bot_commands;
CREATE POLICY "Public full access on bot_commands" ON bot_commands FOR ALL USING (true) WITH CHECK (true);

-- 3. Add tracking columns to bot_category_mappings
ALTER TABLE bot_category_mappings ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bot_category_mappings ADD COLUMN IF NOT EXISTS last_item_count INTEGER DEFAULT 0;
ALTER TABLE bot_category_mappings ADD COLUMN IF NOT EXISTS last_status VARCHAR(50);
