-- Table for PWA install analytics
CREATE TABLE public.pwa_install_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'page_view' | 'install_click' | 'install_accepted' | 'install_dismissed' | 'app_installed'
  platform TEXT,            -- 'ios' | 'android' | 'desktop' | 'unknown'
  user_agent TEXT,
  referrer TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwa_events_type_date ON public.pwa_install_events (event_type, created_at DESC);

ALTER TABLE public.pwa_install_events ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous visitors) can insert events
CREATE POLICY "Anyone can log install events"
ON public.pwa_install_events
FOR INSERT
WITH CHECK (true);

-- Only admins can read the analytics
CREATE POLICY "Admins can view install events"
ON public.pwa_install_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));