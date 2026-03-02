
-- Add lead time tracking to launch_milestones
ALTER TABLE launch_milestones
  ADD COLUMN order_placed_date timestamptz,
  ADD COLUMN arrived_date timestamptz;

-- World Building tasks table
CREATE TABLE world_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'substack',
  status text NOT NULL DEFAULT 'pending',
  deadline timestamptz,
  priority text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE world_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view world_tasks" ON world_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert world_tasks" ON world_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update world_tasks" ON world_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete world_tasks" ON world_tasks FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_world_tasks_updated_at
  BEFORE UPDATE ON world_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
