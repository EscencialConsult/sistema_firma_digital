-- Allow authenticated users to create notifications addressed to themselves.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;

CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
