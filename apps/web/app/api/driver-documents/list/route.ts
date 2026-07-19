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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return cors(NextResponse.json({ error: 'Missing driverId' }, { status: 400 }));
    }

    const supabase = createAdminClient();

    // List files in the driver's folder in the bucket
    const { data, error } = await supabase.storage
      .from('driver-documents')
      .list(driverId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) throw error;

    // Supabase storage list returns a hidden '.emptyFolderPlaceholder' sometimes
    const files = (data || [])
      .filter((file) => file.name !== '.emptyFolderPlaceholder')
      .map((file) => ({
        id: file.id,
        file_name: file.name.replace(/^\d+-/, ''), // We prefixed with timestamp, we can clean it up or just use it
        file_path: `${driverId}/${file.name}`,
        created_at: file.created_at,
        file_type: file.name.split('.').pop(),
      }));

    return cors(NextResponse.json(files));
  } catch (err: any) {
    console.error('List error:', err);
    return cors(NextResponse.json({ error: err.message }, { status: 500 }));
  }
}
