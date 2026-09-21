import os, json, urllib.request

env = {}
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"\'')

url = env.get('NEXT_PUBLIC_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')

def get(path):
    req = urllib.request.Request(f'{url}/rest/v1/{path}', headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

trips = get('trips?trip_number=eq.546&select=*,driver:users!trips_driver_id_fkey(name),asset:assets(short_name,reg_number),trip_orders(*,counterparty:counterparties(name))')
print(json.dumps(trips, indent=2, ensure_ascii=False))
