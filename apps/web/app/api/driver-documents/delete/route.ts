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
    const { id, filePath } = await req.json();

    if (!id || !filePath) {
      return cors(NextResponse.json({ error: 'Missing id or filePath' }, { status: 400 }));
    }

    const supabase = createAdminClient();

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('driver-documents')
      .remove([filePath]);

    if (storageError) throw storageError;

    return cors(NextResponse.json({ success: true }));
  } catch (err: any) {
    console.error('Delete error:', err);
    return cors(NextResponse.json({ error: err.message }, { status: 500 }));
  }
}
