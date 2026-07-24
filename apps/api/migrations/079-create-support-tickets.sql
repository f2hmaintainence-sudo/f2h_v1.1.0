-- Create support_status enum type if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_status') THEN
    CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;
END $$;

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  ticket_id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  user_type VARCHAR(30) NOT NULL, -- 'customer', 'delivery_partner', 'vendor'
  category VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status support_status DEFAULT 'open',
  attachments TEXT, -- Store JSON string or URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup by user
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
