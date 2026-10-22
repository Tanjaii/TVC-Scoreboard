CREATE TABLE IF NOT EXISTS competition_state (
  singleton_key smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_key = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);

INSERT INTO competition_state (singleton_key, data)
VALUES (1, '{"matches":[]}'::jsonb)
ON CONFLICT (singleton_key) DO NOTHING;
