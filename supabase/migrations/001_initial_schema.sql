-- ============================================
-- PROFILES — extiende auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  university TEXT DEFAULT '',
  faculty TEXT DEFAULT '',
  current_semester TEXT DEFAULT '',
  passing_grade NUMERIC(3,2) DEFAULT 3.00,
  max_grade NUMERIC(3,2) DEFAULT 5.00,
  preferences JSONB DEFAULT '{
    "theme": "system",
    "fontSize": "normal",
    "gridCompact": false,
    "weekStartsOn": "monday",
    "timeFormat24h": true,
    "defaultView": "grid"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- COURSES — materias del usuario
-- ============================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  name TEXT NOT NULL,
  professor TEXT DEFAULT '',
  email TEXT DEFAULT '',
  faculty TEXT DEFAULT '',
  semester TEXT DEFAULT '',
  credits INTEGER DEFAULT 3 CHECK (credits BETWEEN 1 AND 10),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  notes TEXT DEFAULT '',
  color TEXT DEFAULT 'blue'
    CHECK (color IN ('blue', 'red', 'green', 'orange', 'purple', 'teal')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_user ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user_status ON public.courses(user_id, status);

-- ============================================
-- SCHEDULES — bloques horarios por materia
-- ============================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL
    CHECK (day IN ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_schedules_course ON public.schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user_day ON public.schedules(user_id, day);

-- ============================================
-- PARTIALS — notas parciales por materia
-- ============================================
CREATE TABLE IF NOT EXISTS public.partials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade NUMERIC(4,2) DEFAULT NULL
    CHECK (grade IS NULL OR (grade >= 0 AND grade <= 10)),
  percent NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partials_course ON public.partials(course_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users read own profile') THEN
    CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING ((select auth.uid()) = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);
  END IF;
END $$;

-- courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'courses' AND policyname = 'Users manage own courses') THEN
    CREATE POLICY "Users manage own courses" ON public.courses FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'Users manage own schedules') THEN
    CREATE POLICY "Users manage own schedules" ON public.schedules FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- partials
ALTER TABLE public.partials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partials' AND policyname = 'Users manage own partials') THEN
    CREATE POLICY "Users manage own partials" ON public.partials FOR ALL
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
