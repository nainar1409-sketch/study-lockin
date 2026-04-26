
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Study plans
CREATE TABLE public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  days INT NOT NULL,
  hours_per_day NUMERIC,
  subjects JSONB NOT NULL,
  timetable JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own plans" ON public.study_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON public.study_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plans" ON public.study_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON public.study_plans FOR DELETE USING (auth.uid() = user_id);

-- Progress per task
CREATE TABLE public.plan_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index INT NOT NULL,
  task_index INT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(plan_id, day_index, task_index)
);
ALTER TABLE public.plan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own progress" ON public.plan_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON public.plan_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.plan_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON public.plan_progress FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_plans_user ON public.study_plans(user_id, created_at DESC);
CREATE INDEX idx_progress_plan ON public.plan_progress(plan_id);
