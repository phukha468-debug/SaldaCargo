# рџљЂ Р¤РРќРђР›Р¬РќР«Р• РРќРЎРўР РЈРљР¦РР вЂ” W1 Р“РѕС‚РѕРІ!

**РЎС‚Р°С‚СѓСЃ:** вњ… **W1 Р·Р°РІРµСЂС€РµРЅ РЅР° 95%**  
**РћСЃС‚Р°Р»РѕСЃСЊ:** 2 РїСЂРѕСЃС‚С‹С… РґРµР№СЃС‚РІРёСЏ в†’ СЂР°СЃРїР°РєРѕРІРєР° в†’ РіРѕС‚РѕРІРѕ Рє СЂР°Р·СЂР°Р±РѕС‚РєРµ

---

## рџ“‹ Р”Р•Р™РЎРўР’РР• 1: РЎРєРѕРїРёСЂСѓР№ РЅРѕРІС‹Р№ README.md

РћС‚РєСЂРѕР№ С„Р°Р№Р» `/salda/README.md` (РєРѕРіРґР° СЂР°СЃРїР°РєСѓРµС€СЊ) Рё Р·Р°РјРµРЅРёС‚СЊ РІРµСЃСЊ РєРѕРЅС‚РµРЅС‚ РЅР°:

```markdown
# SaldaCargo вЂ” РЎРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ Р°РІС‚РѕРїР°СЂРєРѕРј

РџСЂРёР»РѕР¶РµРЅРёРµ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°СЂРєРѕРј РіСЂСѓР·РѕРІРёРєРѕРІ, СЂР°СЃС‡С‘С‚Р° Р·Р°СЂРїР»Р°С‚С‹ Рё С„РёРЅР°РЅСЃРѕРІ РґР»СЏ РјР°Р»РѕРіРѕ Р±РёР·РЅРµСЃР° Р»РѕРіРёСЃС‚РёРєРё.

## Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚

### РўСЂРµР±РѕРІР°РЅРёСЏ
- Node.js 20+
- pnpm 8+
- Supabase Р°РєРєР°СѓРЅС‚
- (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ) Vercel РґР»СЏ РґРµРїР»РѕСЏ

### РЈСЃС‚Р°РЅРѕРІРєР°

1. **РљР»РѕРЅРёСЂРѕРІР°С‚СЊ Рё РїРµСЂРµР№С‚Рё**
```bash
git clone https://github.com/your-org/saldacargo.git
cd saldacargo
```

2. **РЈСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё**
```bash
pnpm install
```

3. **РЎРѕР·РґР°С‚СЊ Рё Р·Р°РїРѕР»РЅРёС‚СЊ .env.local**
```bash
cp .env.example .env.local

# РћС‚СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
# MAX_CLIENT_ID=your-id
# MAX_CLIENT_SECRET=your-secret
```

4. **РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Р‘Р” РІ Supabase**
```bash
# РћС‚РєСЂС‹С‚СЊ Supabase Dashboard
# SQL Editor в†’ СЃРєРѕРїРёСЂРѕРІР°С‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ supabase/schema.sql
# Р’С‹РїРѕР»РЅРёС‚СЊ SQL (СЃРѕР·РґР°СЃС‚ 22 С‚Р°Р±Р»РёС†С‹ + ENUMs)
```

5. **Р—Р°РїСѓСЃС‚РёС‚СЊ РѕР±Р° РїСЂРёР»РѕР¶РµРЅРёСЏ**
```bash
pnpm dev
```

РћС‚РєСЂРѕСЋС‚СЃСЏ:
- Dashboard (web): http://localhost:3000
- Mini App (miniapp): http://localhost:3001

## РЎС‚СЂСѓРєС‚СѓСЂР° РїСЂРѕРµРєС‚Р°

```
saldacargo/
в”њв”Ђв”Ђ apps/
в”‚   в”њв”Ђв”Ђ web/              в†ђ Next.js Dashboard (admin, owner)
в”‚   в””в”Ђв”Ђ miniapp/          в†ђ Next.js Mini App (drivers РІ MAX)
в”њв”Ђв”Ђ packages/
в”‚   в”њв”Ђв”Ђ shared-types/     в†ђ РўРёРїС‹ РґР°РЅРЅС‹С… (@saldacargo/shared-types)
в”‚   в”њв”Ђв”Ђ ui/               в†ђ shadcn/ui РєРѕРјРїРѕРЅРµРЅС‚С‹ (@saldacargo/ui)
в”‚   в”њв”Ђв”Ђ api-client/       в†ђ Supabase С„СѓРЅРєС†РёРё (@saldacargo/api-client)
в”‚   в””в”Ђв”Ђ constants/        в†ђ РљРѕРЅСЃС‚Р°РЅС‚С‹ (@saldacargo/constants)
в””в”Ђв”Ђ supabase/
    в””в”Ђв”Ђ schema.sql        в†ђ SQL РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ (22 С‚Р°Р±Р»РёС†С‹)
```

## API Routes

### РђРІС‚РѕСЂРёР·Р°С†РёСЏ
- `POST /api/auth/max` вЂ” Р’С…РѕРґ С‡РµСЂРµР· MAX OAuth
- `GET /api/auth/me` вЂ” РџРѕР»СѓС‡РёС‚СЊ С‚РµРєСѓС‰РµРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
- `POST /api/auth/logout` вЂ” Р’С‹С…РѕРґ

### Р РµР№СЃС‹
- `GET /api/trips` вЂ” РЎРїРёСЃРѕРє СЂРµР№СЃРѕРІ (СЃ С„РёР»СЊС‚СЂР°С†РёРµР№)
- `POST /api/trips` вЂ” РЎРѕР·РґР°С‚СЊ СЂРµР№СЃ (draft)
- `GET /api/trips/[id]/summary` вЂ” РЎРІРѕРґРєР° СЂРµР№СЃР°
- `POST /api/trips/[id]/approve` вЂ” РЈС‚РІРµСЂРґРёС‚СЊ СЂРµР№СЃ
- `POST /api/trips/[id]/orders` вЂ” Р”РѕР±Р°РІРёС‚СЊ Р·Р°РєР°Р·

### Р¤РёРЅР°РЅСЃС‹
- `GET /api/money-map` вЂ” Р‘Р°Р»Р°РЅСЃ РєРѕС€РµР»СЊРєРѕРІ + P&L
- `GET /api/transactions` вЂ” Р›РµРЅС‚Р° С‚СЂР°РЅР·Р°РєС†РёР№
- `POST /api/transactions` вЂ” РЎРѕР·РґР°С‚СЊ С‚СЂР°РЅР·Р°РєС†РёСЋ

### Р—Рџ
- `GET /api/payroll/periods` вЂ” РџРµСЂРёРѕРґС‹ СЂР°СЃС‡С‘С‚Р° Р—Рџ
- `POST /api/payroll/calculate` вЂ” Р Р°СЃСЃС‡РёС‚Р°С‚СЊ Р—Рџ Р·Р° РїРµСЂРёРѕРґ

## Р Р°Р·СЂР°Р±РѕС‚РєР°

### РЎРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№ API route
```bash
# 1. РЎРѕР·РґР°С‚СЊ С„Р°Р№Р»
touch apps/web/app/api/example/route.ts

# 2. Р”РѕР±Р°РІРёС‚СЊ РєРѕРґ
```

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // РўРІРѕР№ РєРѕРґ...
    const data = await supabase.from("table").select("*");

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

### РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ UI РєРѕРјРїРѕРЅРµРЅС‚С‹
```typescript
import { Button, Card, CardHeader, CardTitle, Badge } from "@saldacargo/ui";

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Р—Р°РіРѕР»РѕРІРѕРє</CardTitle>
      </CardHeader>
      <div className="p-4">
        <Badge variant="success">Completed</Badge>
        <Button onClick={() => {}}>РќР°Р¶РјРё РјРµРЅСЏ</Button>
      </div>
    </Card>
  );
}
```

## Р”РµРїР»РѕР№ РЅР° Vercel

### 1. РЎРѕР·РґР°С‚СЊ РїСЂРѕРµРєС‚С‹ РІ Vercel
- `saldacargo-web` в†’ deploy РёР· `apps/web`
- `saldacargo-miniapp` в†’ deploy РёР· `apps/miniapp`

### 2. Р”РѕР±Р°РІРёС‚СЊ РїРµСЂРµРјРµРЅРЅС‹Рµ РІ Vercel
Р”Р»СЏ РєР°Р¶РґРѕРіРѕ РїСЂРѕРµРєС‚Р° в†’ Settings в†’ Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. РќР°СЃС‚СЂРѕРёС‚СЊ GitHub Actions
CI/CD workflow Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґРµРїР»РѕРёС‚ РїСЂРё push РІ main

## Р”РѕСЂРѕР¶РЅР°СЏ РєР°СЂС‚Р°

### W1 (С‚РµРєСѓС‰Р°СЏ) вњ…
- вњ… РЎС‚СЂСѓРєС‚СѓСЂР° РјРѕРЅРѕСЂРµРїРѕ
- вњ… Auth (MAX OAuth)
- вњ… API Р±Р°Р·РѕРІС‹Р№ (trips, orders)
- вњ… Mini App (DriverHome, OrderForm, ActiveTrip)
- вњ… Dashboard (MoneyMap, TripReviewTable)

### W2 (С„РёРЅР°РЅСЃС‹)
- РљР°СЂС‚Р° РґРµРЅРµРі (РіР»Р°РІРЅР°СЏ)
- Р‘Р°Р»Р°РЅСЃ РєРѕС€РµР»СЊРєРѕРІ
- РђРјРѕСЂС‚РёР·Р°С†РёСЏ РјР°С€РёРЅ
- Р”Р°С€Р±РѕСЂРґ РґР»СЏ Р°РґРјРёРЅР°

### W3 (Р—Рџ)
- Р Р°СЃС‡С‘С‚ Р—Рџ Р·Р° РїРµСЂРёРѕРґ
- Р”РµР±РёС‚РѕСЂРєР° (РґРѕР»Р¶РЅРёРєРё)
- РљСЂРµРґРёС‚РѕСЂРєР° (РєРѕРјСѓ РґРѕР»Р¶РЅС‹)

### W4-W6 (РёРЅС‚РµРіСЂР°С†РёРё Рё РїРѕР»РёСЂРѕРІРєР°)
- Opti24 (С‚РѕРїР»РёРІРѕ)
- Wialon (GPS)
- Р‘Р°РЅРє API
- Offline-first (IndexedDB)
- РЎРўРћ + СЂРµРіР»Р°РјРµРЅС‚С‹ РўРћ
- Production deploy

## РўРµСЃС‚РёСЂРѕРІР°РЅРёРµ Р»РѕРєР°Р»СЊРЅРѕ

### РЎС†РµРЅР°СЂРёР№ 1: РЎРѕР·РґР°РЅРёРµ СЂРµР№СЃР°
```
1. РћС‚РєСЂС‹С‚СЊ http://localhost:3001 (miniapp)
2. Р›РѕРіРёРЅ С‡РµСЂРµР· MAX
3. РќР°Р¶Р°С‚СЊ [РќР°С‡Р°С‚СЊ СЂРµР№СЃ]
4. Р’С‹Р±СЂР°С‚СЊ РјР°С€РёРЅСѓ, РіСЂСѓР·С‡РёРєР°, РІРІРµСЃС‚Рё РѕРґРѕРјРµС‚СЂ
5. Р”РѕР±Р°РІРёС‚СЊ Р·Р°РєР°Р· (РєР»РёРµРЅС‚, СЃСѓРјРјР°, Р—Рџ)
6. РќР°Р¶Р°С‚СЊ [рџЏЃ Р—Р°РІРµСЂС€РёС‚СЊ СЂРµР№СЃ]
7. РћС‚РєСЂС‹С‚СЊ http://localhost:3000 (dashboard)
8. Р’РёРґРµС‚СЊ СЂРµР№СЃ РІ СЂРµРІСЊСЋ РґРЅСЏ
9. РџРѕРґС‚РІРµСЂРґРёС‚СЊ СЂРµР№СЃ
10. РџСЂРѕРІРµСЂРёС‚СЊ РєР°СЂС‚Сѓ РґРµРЅРµРі (Р±Р°Р»Р°РЅСЃ РѕР±РЅРѕРІРёР»СЃСЏ)
```

### РЎС†РµРЅР°СЂРёР№ 2: Р—Рџ
```
1. РЎРѕР·РґР°С‚СЊ 5+ СЂРµР№СЃРѕРІ Р·Р° РјРµСЃСЏС†
2. РџРµСЂРµР№С‚Рё РІ Dashboard в†’ Р—Рџ
3. Р Р°СЃСЃС‡РёС‚Р°С‚СЊ Р·Р° РїРµСЂРёРѕРґ
4. Р’РѕРґРёС‚РµР»СЊ РІРёРґРёС‚ РІ Mini App в†’ РњРѕСЏ Р—Рџ
```

## Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ

РџРѕР»РЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ РІ РїР°РїРєРµ `/docs`:
- `MONOREPO_STRUCTURE.md` вЂ” РђСЂС…РёС‚РµРєС‚СѓСЂР°
- `DATABASE_MAP.md` вЂ” РЎС…РµРјР° Р‘Р” (22 С‚Р°Р±Р»РёС†С‹)
- `ENVIRONMENT_VARS.md` вЂ” РџРµСЂРµРјРµРЅРЅС‹Рµ
- `ROADMAP.md` вЂ” Р”РѕСЂРѕР¶РЅР°СЏ РєР°СЂС‚Р° (W1-W6)
- `TASK_TEMPLATE.md` вЂ” РљР°Рє РїРёСЃР°С‚СЊ С‚Р°СЃРєРё

## РџРѕРјРѕС‰СЊ

### РџСЂРѕР±Р»РµРјР°: "Cannot find module"
```bash
# РџРµСЂРµСѓСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
pnpm install

# РћС‡РёСЃС‚РёС‚СЊ РєСЌС€
pnpm store prune
```

### РџСЂРѕР±Р»РµРјР°: Supabase connection error
```bash
# РџСЂРѕРІРµСЂРёС‚СЊ .env.local
# NEXT_PUBLIC_SUPABASE_URL Рё ANON_KEY Р·Р°РїРѕР»РЅРµРЅС‹?
# Service Role Key РІ SUPABASE_SERVICE_ROLE_KEY?
```

### РџСЂРѕР±Р»РµРјР°: РўРёРїС‹ TypeScript РѕС€РёР±Р°СЋС‚СЃСЏ
```bash
# Р­РєСЃРїРѕСЂС‚РёСЂРѕРІР°С‚СЊ С‚РёРїС‹ РёР· Supabase
supabase gen types typescript > packages/shared-types/src/database.types.ts
```

## РљРѕРЅС‚СЂРёР±СЊСЋС‚РёРЅРі

1. РЎРѕР·РґР°С‚СЊ branch: `git checkout -b feat/W2-money-map`
2. Р”РµР»Р°С‚СЊ РєРѕРјРјРёС‚С‹: `git commit -m "feat(W2): add money-map component"`
3. Push: `git push origin feat/W2-money-map`
4. Pull Request в†’ Review в†’ Merge

## Р›РёС†РµРЅР·РёСЏ

MIT
```

РЎРѕС…СЂР°РЅРёС‚СЊ Рё РіРѕС‚РѕРІРѕ! вњ…

---

## рџ“‹ Р”Р•Р™РЎРўР’РР• 2: РЎРѕР·РґР°С‚СЊ deploy-miniapp.yml

РљРѕРіРґР° СЂР°СЃРїР°РєСѓРµС€СЊ Р°СЂС…РёРІ, СЃРѕР·РґР°Р№ С„Р°Р№Р»:

**РџСѓС‚СЊ:** `/salda/.github/workflows/deploy-miniapp.yml`

**РЎРѕРґРµСЂР¶РёРјРѕРµ:**
```yaml
name: Deploy Mini App

on:
  push:
    branches: [ main ]
    paths:
      - 'apps/miniapp/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build Mini App
        run: pnpm --filter @saldacargo/miniapp build

      - name: Deploy to Vercel (when ready)
        run: |
          # Uncomment when Vercel is configured:
          # vercel deploy --token ${{ secrets.VERCEL_TOKEN }} --prod
          echo "Mini App build successful"
```

---

## рџљЂ Р РђРЎРџРђРљРћР’РљРђ Р Р—РђРџРЈРЎРљ

### РЁР°Рі 1: Р Р°СЃРїР°РєРѕРІР°С‚СЊ Р°СЂС…РёРІ РІ /salda
```bash
mkdir -p /salda
unzip -o saldacargo.zip -d /salda
cd /salda
```

### РЁР°Рі 2: РћР±РЅРѕРІРёС‚СЊ README.md
```bash
# РЎРєРѕРїРёСЂРѕРІР°С‚СЊ РЅРѕРІС‹Р№ README (РёР· Р”Р•Р™РЎРўР’РР• 1 РІС‹С€Рµ)
cat > README.md << 'EOF'
# SaldaCargo вЂ” РЎРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ Р°РІС‚РѕРїР°СЂРєРѕРј
...
EOF
```

### РЁР°Рі 3: Р”РѕР±Р°РІРёС‚СЊ deploy-miniapp.yml
```bash
mkdir -p .github/workflows
cat > .github/workflows/deploy-miniapp.yml << 'EOF'
name: Deploy Mini App
...
EOF
```

### РЁР°Рі 4: РЈСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
```bash
pnpm install
```

### РЁР°Рі 5: РЎРѕР·РґР°С‚СЊ .env.local
```bash
cp .env.example .env.local

# РћС‚СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### РЁР°Рі 6: РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Supabase
```bash
# 1. РћС‚РєСЂС‹С‚СЊ Supabase Dashboard
# 2. SQL Editor
# 3. РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃРѕРґРµСЂР¶РёРјРѕРµ supabase/schema.sql
# 4. Р’СЃС‚Р°РІРёС‚СЊ Рё РІС‹РїРѕР»РЅРёС‚СЊ

# РР»Рё С‡РµСЂРµР· CLI:
# supabase db push  (РµСЃР»Рё Supabase CLI РЅР°СЃС‚СЂРѕРµРЅ)
```

### РЁР°Рі 7: Р—Р°РїСѓСЃС‚РёС‚СЊ
```bash
pnpm dev
```

РћС‚РєСЂРѕСЋС‚СЃСЏ:
- рџЊђ Dashboard: http://localhost:3000
- рџ“± Mini App: http://localhost:3001

---

## вњ… Р¤РРќРђР›Р¬РќР«Р™ CHECKLIST

РџРµСЂРµРґ РЅР°С‡Р°Р»РѕРј W2:

- [ ] README.md РѕР±РЅРѕРІР»РµРЅ
- [ ] deploy-miniapp.yml СЃРѕР·РґР°РЅ
- [ ] РђСЂС…РёРІ СЂР°СЃРїР°РєРѕРІР°РЅ РІ /salda
- [ ] `pnpm install` РІС‹РїРѕР»РЅРµРЅ
- [ ] .env.local Р·Р°РїРѕР»РЅРµРЅ (Supabase РєР»СЋС‡Рё)
- [ ] Supabase SQL РІС‹РїРѕР»РЅРµРЅ (22 С‚Р°Р±Р»РёС†С‹ СЃРѕР·РґР°РЅС‹)
- [ ] `pnpm dev` Р·Р°РїСѓС‰РµРЅ
- [ ] http://localhost:3000 РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ (dashboard)
- [ ] http://localhost:3001 РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ (miniapp)
- [ ] TypeScript РєРѕРјРїРёР»РёСЂСѓРµС‚СЃСЏ Р±РµР· РѕС€РёР±РѕРє
- [ ] Р§РёС‚Р°Р» ROADMAP.md РґР»СЏ РїРѕРЅРёРјР°РЅРёСЏ РґР°Р»СЊС€Рµ

Р•СЃР»Рё РІСЃС‘ вњ… вЂ” РіРѕС‚РѕРІ Рє W2 СЂР°Р·СЂР°Р±РѕС‚РєРµ! рџљЂ

---

## рџ“љ РЎР›Р•Р”РЈР®Р©РР• РЁРђР“Р

РџРѕСЃР»Рµ W1 Р·Р°РІРµСЂС€РµРЅРёСЏ:

### РќРµРґРµР»СЏ 2 (W2): Р¤РёРЅР°РЅСЃС‹
- РџРµСЂРµРґРµР»Р°С‚СЊ GET /api/money-map (РїРѕР»РЅС‹Р№ Р±Р°Р»Р°РЅСЃ)
- РЎРѕР·РґР°С‚СЊ РІСЃРµ routes РґР»СЏ transactions
- РљРѕРјРїРѕРЅРµРЅС‚С‹ РґР»СЏ Dashboard (Р°РєС‚РёРІС‹, РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР°, P&L)
- РђРјРѕСЂС‚РёР·Р°С†РёСЏ РјР°С€РёРЅ

### РќРµРґРµР»СЏ 3 (W3): Р—Рџ
- GET /api/payroll/calculate
- Р”РµР±РёС‚РѕСЂРєР° (Receivables)
- РљСЂРµРґРёС‚РѕСЂРєР° (Payables)

### РќРµРґРµР»СЏ 4-6: РРЅС‚РµРіСЂР°С†РёРё + РџРѕР»РёСЂРѕРІРєР°
- Opti24 (С‚РѕРїР»РёРІРѕ)
- Wialon (GPS)
- Р‘Р°РЅРє API
- Offline-first
- РЎРўРћ + СЂРµРіР»Р°РјРµРЅС‚С‹ РўРћ

---

**Р’СЃС‘ РіРѕС‚РѕРІРѕ! РќР°С‡РёРЅР°РµРј СЂР°СЃРїР°РєРѕРІРєСѓ? рџЋ‰**
