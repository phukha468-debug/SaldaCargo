# SaldaCargo вЂ” РџРµСЂРµРјРµРЅРЅС‹Рµ РћРєСЂСѓР¶РµРЅРёСЏ

**Р¤Р°Р№Р»С‹ РєРѕРЅС„РёРіСѓСЂР°С†РёРё:**
- `.env.local` вЂ” Р»РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР° (`.gitignore`)
- `.env.production` вЂ” production РЅР° Vercel
- `.env.example` вЂ” С€Р°Р±Р»РѕРЅ (РІ repo)

---

## 1. .env.example (РЁР°Р±Р»РѕРЅ)

```bash
# ============================================================
# SUPABASE (Database & Auth)
# ============================================================

# NEXT_PUBLIC_* = РІРёРґРЅС‹ РІ Р±СЂР°СѓР·РµСЂРµ (РїСѓР±Р»РёС‡РЅС‹Рµ)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# РўРѕР»СЊРєРѕ РЅР° СЃРµСЂРІРµСЂРµ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================================
# MAX SDK (Mini App)
# ============================================================

NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.saldacargo.miniapp

# ============================================================
# EXTERNAL APIs
# ============================================================

# РћРїС‚Рё24 (С‚РѕРїР»РёРІРЅС‹Рµ РєР°СЂС‚С‹)
OPTI24_API_KEY=sk_live_xxxxx

# Wialon (GPS РјР°С€РёРЅ)
WIALON_API_TOKEN=xxxxx

# Sentry (error tracking)
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# ============================================================
# APP CONFIGURATION
# ============================================================

# РћРєСЂСѓР¶РµРЅРёРµ
NEXT_PUBLIC_APP_ENV=development  # development | staging | production

# API URL (РґР»СЏ API Routes РІРЅСѓС‚СЂРё РїСЂРёР»РѕР¶РµРЅРёСЏ)
NEXT_PUBLIC_API_URL=http://localhost:3000  # РґР»СЏ dev
# https://saldacargo.ru  РґР»СЏ prod

# ============================================================
# VERCEL (CI/CD, РЅРµ С‚СЂРѕРіР°С‚СЊ РµСЃР»Рё РґРµРїР»РѕРёРј С‡РµСЂРµР· GitHub Actions)
# ============================================================

VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID_WEB=xxxxx
VERCEL_PROJECT_ID_MINIAPP=xxxxx

# ============================================================
# NEXT.JS
# ============================================================

NODE_ENV=development  # development | production
NEXT_PUBLIC_VERSION=1.0.0
```

---

## 2. РџРµСЂРµРјРµРЅРЅС‹Рµ вЂ” РџРѕРґСЂРѕР±РЅРѕ

### SUPABASE

| РџРµСЂРµРјРµРЅРЅР°СЏ | Р“РґРµ РІР·СЏС‚СЊ | Р“РґРµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ | РџСѓР±Р»РёС‡РЅР°СЏ? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard в†’ Project Settings в†’ API | Р’РµР·РґРµ (client + server) | вњ… Р”Р° |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard в†’ Project Settings в†’ API в†’ anon | Р’РµР·РґРµ (client + server) | вњ… Р”Р° |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard в†’ Project Settings в†’ API в†’ service_role | РўРѕР»СЊРєРѕ server (API Routes) | вќЊ РќРµС‚ |

**РљР°Рє РїРѕР»СѓС‡РёС‚СЊ:**

1. Р—Р°Р№С‚Рё РЅР° supabase.com в†’ РІС…РѕРґ
2. Р’С‹Р±СЂР°С‚СЊ РїСЂРѕРµРєС‚ saldacargo
3. Project Settings (gear icon) в†’ API
4. РЎРєРѕРїРёСЂРѕРІР°С‚СЊ URLs Рё РєР»СЋС‡Рё

**РџСЂР°РІРёР»Р°:**
- `ANON_KEY` = РґР»СЏ РѕР±С‹С‡РЅС‹С… РєР»РёРµРЅС‚РѕРІ (RLS РёС… РѕРіСЂР°РЅРёС‡РёРІР°РµС‚)
- `SERVICE_ROLE_KEY` = РґР»СЏ Р°РґРјРёРЅСЃРєРёС… РѕРїРµСЂР°С†РёР№ (РѕР±С…РѕРґРёС‚ RLS, **РЅРёРєРѕРіРґР°** РІ Р±СЂР°СѓР·РµСЂ!)

---

### MAX SDK

| РџРµСЂРµРјРµРЅРЅР°СЏ | Р—РЅР°С‡РµРЅРёРµ | Р“РґРµ РІР·СЏС‚СЊ | РџСЂРёРјРµС‡Р°РЅРёРµ |
|---|---|---|---|
| `NEXT_PUBLIC_MAX_BOT_TOKEN` | 123456789:ABCDEFGH... | MAX Developer Console | Token Р±РѕС‚Р° |
| `NEXT_PUBLIC_MAX_APP_ID` | com.saldacargo.miniapp | MAX Developer Console | ID РїСЂРёР»РѕР¶РµРЅРёСЏ |

**РџСЂР°РІРёР»Р°:**
- РћР±Р° `NEXT_PUBLIC_*` вЂ” РІРёРґРЅС‹ РІ Р±СЂР°СѓР·РµСЂРµ (СЌС‚Рѕ РЅРѕСЂРјР°Р»СЊРЅРѕ РґР»СЏ MAX)
- РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РґР»СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё MAX SDK РІ Mini App

---

### External APIs

| РџРµСЂРµРјРµРЅРЅР°СЏ | РЎРµСЂРІРёСЃ | РљР°Рє РїРѕР»СѓС‡РёС‚СЊ | Р”Р»СЏ С‡РµРіРѕ |
|---|---|---|---|
| `OPTI24_API_KEY` | РћРїС‚Рё24 | Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚ РћРїС‚Рё24 в†’ РЈРїСЂР°РІР»РµРЅРёРµ в†’ API | РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ С‚РѕРїР»РёРІРЅС‹С… РєР°СЂС‚ |
| `WIALON_API_TOKEN` | Wialon | Wialon.com в†’ РЈРїСЂР°РІР»РµРЅРёРµ в†’ API | РџРѕР»СѓС‡РµРЅРёРµ GPS РґР°РЅРЅС‹С… |
| `SENTRY_DSN` | Sentry | sentry.io в†’ Project Settings | РћС‚СЃР»РµР¶РёРІР°РЅРёРµ РѕС€РёР±РѕРє |

---

### App Configuration

| РџРµСЂРµРјРµРЅРЅР°СЏ | Р—РЅР°С‡РµРЅРёСЏ | РљРѕРіРґР° РјРµРЅСЏС‚СЊ |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development` \| `staging` \| `production` | РџСЂРё РґРµРїР»РѕРµ РЅР° СЂР°Р·РЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` (dev) <br> `https://saldacargo.ru` (prod) | Р’ Vercel secrets РґР»СЏ prod |
| `NEXT_PUBLIC_VERSION` | `1.0.0` | РџСЂРё РєР°Р¶РґРѕРј СЂРµР»РёР·Рµ |

---

## 3. .env.local (Р›РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР°)

РљРѕРїРёСЂРѕРІР°С‚СЊ РёР· `.env.example`, Р·Р°РїРѕР»РЅРёС‚СЊ СЃРІРѕРёРјРё Р·РЅР°С‡РµРЅРёСЏРјРё:

```bash
# Р›РѕРєР°Р»СЊРЅС‹Р№ Supabase (РµСЃР»Рё РёСЃРїРѕР»СЊР·СѓРµС€СЊ `supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MAX (РјРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РєР°Рє РІ РїСЂРёРјРµСЂРµ, РёР»Рё leave empty РµСЃР»Рё РЅРµ С‚РµСЃС‚РёСЂСѓРµС€СЊ)
NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.saldacargo.miniapp

# API (Р»РѕРєР°Р»СЊРЅРѕ)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development

# РћРїС‚Рё24, Wialon (РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ РјРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РїСѓСЃС‚С‹РјРё РёР»Рё use mocks)
OPTI24_API_KEY=
WIALON_API_TOKEN=
SENTRY_DSN=
```

**вљ пёЏ Р’РђР–РќРћ:** `.env.local` РЅРµ РєРѕРјРјРёС‚РёС‚СЊ РІ git. Р”РѕР±Р°РІР»РµРЅРѕ РІ `.gitignore`.

---

## 4. .env.production (Production РЅР° Vercel)

**Р—Р°РїРѕР»РЅСЏРµС‚СЃСЏ РІ Vercel Dashboard:**

Settings в†’ Environment Variables

| РљР»СЋС‡ | Р—РЅР°С‡РµРЅРёРµ | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prodction РєР»СЋС‡ РёР· Supabase | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Prodction key РёР· Supabase | Production (РЅРµ РІРёРґРЅР° РІ Р±СЂР°СѓР·РµСЂРµ) |
| `NEXT_PUBLIC_MAX_BOT_TOKEN` | Production С‚РѕРєРµРЅ | Production |
| `NEXT_PUBLIC_MAX_APP_ID` | Production app ID | Production |
| `OPTI24_API_KEY` | Production РєР»СЋС‡ | Production |
| `WIALON_API_TOKEN` | Production С‚РѕРєРµРЅ | Production |
| `SENTRY_DSN` | Production DSN | Production |
| `NEXT_PUBLIC_APP_ENV` | `production` | Production |
| `NEXT_PUBLIC_API_URL` | `https://saldacargo.ru` | Production |

**РџСЂРѕС†РµСЃСЃ:**

1. Vercel Dashboard в†’ Project в†’ Settings в†’ Environment Variables
2. Add New в†’ РІРІРµСЃС‚Рё РєР»СЋС‡ Рё Р·РЅР°С‡РµРЅРёРµ в†’ Select Environment: Production
3. РЎРѕС…СЂР°РЅРёС‚СЊ
4. Р РµРґРµРїР»РѕР№ (РѕРЅ РїСЂРѕРёР·РѕР№РґС‘С‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РёР»Рё РЅСѓР¶РЅР° РєРЅРѕРїРєР° Redeploy)

---

## 5. Р Р°Р·РЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ apps/web Рё apps/miniapp

Р•СЃР»Рё РЅСѓР¶РЅРѕ СЂР°Р·РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ:

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_API_URL=https://saldacargo.ru/api
```

**apps/miniapp/.env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_MAX_BOT_TOKEN=...
```

РљР°Р¶РґРѕРµ РїСЂРёР»РѕР¶РµРЅРёРµ С‡РёС‚Р°РµС‚ СЃРІРѕР№ `.env.local`.

---

## 6. Р”РѕСЃС‚СѓРї Рє РїРµСЂРµРјРµРЅРЅС‹Рј РІ РєРѕРґРµ

### Client-side (Р±СЂР°СѓР·РµСЂ)

```tsx
// вњ… Р Р°Р±РѕС‚Р°РµС‚: NEXT_PUBLIC_*
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// вќЊ РќР• СЂР°Р±РѕС‚Р°РµС‚: РїРµСЂРµРјРµРЅРЅС‹Рµ Р±РµР· NEXT_PUBLIC_
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // undefined РІ Р±СЂР°СѓР·РµСЂРµ!
```

### Server-side (API Routes, Server Components)

```ts
// вњ… Р Р°Р±РѕС‚Р°РµС‚: РІСЃРµ РїРµСЂРµРјРµРЅРЅС‹Рµ
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // вњ… РґРѕСЃС‚СѓРїРЅР°

// вњ… Р Р°Р±РѕС‚Р°РµС‚: Рё NEXT_PUBLIC_*
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; // вњ… РґРѕСЃС‚СѓРїРЅР°
```

### TypeScript

Р”Р»СЏ Р°РІС‚РѕРґРѕРїРѕР»РЅРµРЅРёСЏ С‚РёРїРѕРІ, СЃРѕР·РґР°С‚СЊ `env.d.ts`:

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXT_PUBLIC_MAX_BOT_TOKEN: string;
    OPTI24_API_KEY: string;
    WIALON_API_TOKEN: string;
    SENTRY_DSN: string;
    NEXT_PUBLIC_APP_ENV: 'development' | 'staging' | 'production';
    NEXT_PUBLIC_API_URL: string;
  }
}
```

---

## 7. РЎРµРєСЂРµС‚С‹ РІ Vercel (GitHub Actions)

Р•СЃР»Рё РёСЃРїРѕР»СЊР·СѓРµС€СЊ GitHub Actions РґР»СЏ РґРµРїР»РѕСЏ:

**.github/workflows/deploy-web.yml:**

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL_PROD }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_PROD }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_PROD }}
```

Р”РѕР±Р°РІРёС‚СЊ СЃРµРєСЂРµС‚С‹ РІ GitHub:

1. Repo в†’ Settings в†’ Secrets and variables в†’ Actions
2. New repository secret
3. Р”РѕР±Р°РІРёС‚СЊ: `SUPABASE_URL_PROD`, `SUPABASE_ANON_KEY_PROD` Рё С‚.Рґ.

---

## 8. Fallbacks & Defaults

Р•СЃР»Рё РїРµСЂРµРјРµРЅРЅР°СЏ РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅР°, РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ defaults:

```ts
// packages/api-client/src/supabase.ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-anon-key';
```

---

## 9. Checklist: РєР°Рє РЅР°СЃС‚СЂРѕРёС‚СЊ РѕРєСЂСѓР¶РµРЅРёРµ

### Р›РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР°

- [ ] РЎРѕР·РґР°С‚СЊ Supabase РїСЂРѕРµРєС‚
- [ ] РЎРєРѕРїРёСЂРѕРІР°С‚СЊ `.env.example` в†’ `.env.local`
- [ ] Р—Р°РїРѕР»РЅРёС‚СЊ `NEXT_PUBLIC_SUPABASE_URL` Рё РєР»СЋС‡Рё РёР· Supabase
- [ ] `pnpm install`
- [ ] `pnpm db:setup` (РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Р‘Р”)
- [ ] `pnpm dev`

### Production (Vercel)

- [ ] РЎРѕР·РґР°С‚СЊ РїСЂРѕРµРєС‚С‹ РІ Vercel РґР»СЏ `apps/web` Рё `apps/miniapp`
- [ ] Р”РѕР±Р°РІРёС‚СЊ Environment Variables РІ Vercel (Settings в†’ Environment Variables)
- [ ] РџРѕР»СѓС‡РёС‚СЊ production РєР»СЋС‡Рё Supabase
- [ ] Р”РѕР±Р°РІРёС‚СЊ GitHub integration
- [ ] Push РІ main в†’ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РґРµРїР»РѕР№

### Production (СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ СЃРµСЂРІРµСЂ)

- [ ] РЎРѕР·РґР°С‚СЊ `.env.production` СЃ production Р·РЅР°С‡РµРЅРёСЏРјРё
- [ ] Р—Р°РїРѕР»РЅРёС‚СЊ РІСЃРµ РїРµСЂРµРјРµРЅРЅС‹Рµ
- [ ] `pnpm build`
- [ ] Р—Р°РїСѓСЃС‚РёС‚СЊ `next start` РёР»Рё С‡РµСЂРµР· Docker

---

## 10. РџСЂРёРјРµСЂ РєРѕРЅРєСЂРµС‚РЅС‹С… Р·РЅР°С‡РµРЅРёР№ РґР»СЏ MVP

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAwMDAwMDAsImV4cCI6MTk5OTk5OTk5OX0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXX
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4MDAwMDAwMCwiZXhwIjoxOTk5OTk5OTk5fQ.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyYYY

# MAX (example)
NEXT_PUBLIC_MAX_BOT_TOKEN=987654321:ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqp
NEXT_PUBLIC_MAX_APP_ID=com.saldacargo.miniapp

# APIs
OPTI24_API_KEY=sk_live_abc123def456ghi789
WIALON_API_TOKEN=wialon_token_xyz123
SENTRY_DSN=https://publickey@o1234567.ingest.sentry.io/1234567

# App
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_VERSION=1.0.0

# Node
NODE_ENV=development
```

---

## РС‚РѕРіРѕ

вњ… **Р’СЃРµ РїРµСЂРµРјРµРЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅС‹**  
вњ… **Р—РЅР°РµС€СЊ РіРґРµ РІР·СЏС‚СЊ РєР°Р¶РґСѓСЋ**  
вњ… **Р—РЅР°РµС€СЊ РєР°Рє РЅР°СЃС‚СЂРѕРёС‚СЊ РґР»СЏ dev/prod**  
вњ… **Security: service_role_key РЅРµ РІС‹С…РѕРґРёС‚ РІ Р±СЂР°СѓР·РµСЂ**  

**РЎР»РµРґСѓСЋС‰РёР№ С„Р°Р№Р»:** ROADMAP.md (РґРѕСЂРѕР¶РЅР°СЏ РєР°СЂС‚Р° СЂР°Р·СЂР°Р±РѕС‚РєРё)
