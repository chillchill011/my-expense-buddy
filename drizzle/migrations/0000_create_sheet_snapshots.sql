CREATE TABLE public.sheet_snapshots (
  user_id uuid NOT NULL,
  spreadsheet_id text NOT NULL,
  dataset jsonb NOT NULL,
  expense_count integer NOT NULL DEFAULT 0,
  investment_count integer NOT NULL DEFAULT 0,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, spreadsheet_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_snapshots TO authenticated;
GRANT ALL ON public.sheet_snapshots TO service_role;

ALTER TABLE public.sheet_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own snapshots"
  ON public.sheet_snapshots
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);