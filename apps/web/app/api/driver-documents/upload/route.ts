import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const driverId = formData.get('driverId') as string;

    if (!file || !driverId) {
      return cors(NextResponse.json({ error: 'Missing file or driverId' }, { status: 400 }));
    }

    const supabase = createAdminClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${driverId}-${Date.now()}.${fileExt}`;
    const filePath = `${driverId}/${fileName}`;

    // Upload to storage using service role key (bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Insert to database using service role key (bypasses RLS)
    const { error: dbError } = await supabase.from('driver_documents').insert({
      driver_id: driverId,
      file_name: file.name,
      file_path: filePath,
      file_type: fileExt,
    });

    if (dbError) throw dbError;

    return cors(NextResponse.json({ success: true }));
  } catch (err: any) {
    console.error('Upload error:', err);
    return cors(NextResponse.json({ error: err.message }, { status: 500 }));
  }
}
