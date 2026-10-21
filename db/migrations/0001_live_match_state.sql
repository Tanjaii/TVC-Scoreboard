CREATE TABLE IF NOT EXISTS live_match_state (
  singleton_key smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_key = 1),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);

INSERT INTO live_match_state (singleton_key, data)
VALUES (
  1,
  '{
    "homeTeam": "",
    "awayTeam": "",
    "stage": "",
    "setNumber": 1,
    "scheduledStartAt": "",
    "homeScore": 0,
    "awayScore": 0,
    "homeStats": { "attackPercent": 0, "blocks": 0, "aces": 0, "errors": 0 },
    "awayStats": { "attackPercent": 0, "blocks": 0, "aces": 0, "errors": 0 },
    "isBroadcasting": false
  }'::jsonb
)
ON CONFLICT (singleton_key) DO NOTHING;
