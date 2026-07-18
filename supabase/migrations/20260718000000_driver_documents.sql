-- Migration: Create driver_documents table and storage bucket

-- 1. Create the Storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Allow authenticated users to upload and read from this bucket
CREATE POLICY "Authenticated users can read driver-documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "Authenticated users can insert into driver-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-documents');

CREATE POLICY "Authenticated users can delete from driver-documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-documents');

CREATE POLICY "Authenticated users can update driver-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-documents');

-- 2. Create the driver_documents metadata table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Enable RLS and add basic policies
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_documents_read_all"
ON public.driver_documents FOR SELECT TO authenticated
USING (true);

CREATE POLICY "driver_documents_insert_all"
ON public.driver_documents FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "driver_documents_delete_all"
ON public.driver_documents FOR DELETE TO authenticated
USING (true);

CREATE POLICY "driver_documents_update_all"
ON public.driver_documents FOR UPDATE TO authenticated
USING (true);
