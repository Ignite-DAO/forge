-- Create token metadata table for storing launch metadata (bonding curve, fair launch, etc.)
CREATE TABLE IF NOT EXISTS token_metadata (
  pool_address TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  launch_type TEXT NOT NULL DEFAULT 'bonding_curve',
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_metadata_chain_id ON token_metadata(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_metadata_launch_type ON token_metadata(launch_type);
CREATE INDEX IF NOT EXISTS idx_token_metadata_created_at ON token_metadata(created_at DESC);
