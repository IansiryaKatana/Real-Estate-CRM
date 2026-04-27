-- Allow authenticated users to correct or remove audit rows (admin / compliance workflows).
DROP POLICY IF EXISTS "Auth update audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Auth delete audit_log" ON public.audit_log;

CREATE POLICY "Auth update audit_log"
ON public.audit_log FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Auth delete audit_log"
ON public.audit_log FOR DELETE
TO authenticated
USING (true);
