# SaldaCargo вЂ” РЎС‚СЂСѓРєС‚СѓСЂР° РњРѕРЅРѕСЂРµРїРѕ

**Р¤СЂРµР№РјРІРѕСЂРє:** pnpm monorepo (workspaces)  
**РЇР·С‹Рє:** TypeScript  
**Package Manager:** pnpm (РІРјРµСЃС‚Рѕ npm/yarn)  

---

## 1. РџРѕР»РЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° РїСЂРѕРµРєС‚Р°

```
saldacargo/                                  в†ђ root РјРѕРЅРѕСЂРµРїРѕ
в”‚
в”њв”Ђв”Ђ .github/
в”‚   в”њв”Ђв”Ђ workflows/
в”‚   в”‚   в”њв”Ђв”Ђ deploy-web.yml                в†ђ CI/CD: deploy web РЅР° Vercel
в”‚   в”‚   в”њв”Ђв”Ђ deploy-miniapp.yml            в†ђ CI/CD: deploy miniapp РЅР° Vercel
в”‚   в”‚   в””в”Ђв”Ђ test.yml                      в†ђ Run tests РЅР° РєР°Р¶РґС‹Р№ push
в”‚   в””в”Ђв”Ђ CODEOWNERS
в”‚
в”њв”Ђв”Ђ apps/
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ web/                              в†ђ Dashboard РґР»СЏ admin/owner
в”‚   в”‚   в”њв”Ђв”Ђ app/                          в†ђ Next.js 15 App Router
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ layout.tsx                в†ђ Root layout
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ page.tsx                  в†ђ Home (РїРµСЂРµРЅР°РїСЂР°РІР»РµРЅРёРµ)
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ (auth)/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ login/page.tsx
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ setup/page.tsx        в†ђ Setup Wizard
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ (dashboard)/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ money-map/page.tsx    в†ђ РљР°СЂС‚Р° РґРµРЅРµРі (Р“Р»Р°РІРЅР°СЏ)
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ trips/
в”‚   в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ page.tsx          в†ђ РЎРїРёСЃРѕРє СЂРµР№СЃРѕРІ
в”‚   в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ [id]/
в”‚   в”‚   в”‚   в”‚   в”‚       в”њв”Ђв”Ђ page.tsx      в†ђ Р”РµС‚Р°Р»Рё СЂРµР№СЃР°
в”‚   в”‚   в”‚   в”‚   в”‚       в””в”Ђв”Ђ review/page.tsx в†ђ Р РµРІСЊСЋ СЃРјРµРЅС‹
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ assets/
в”‚   в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ page.tsx          в†ђ РђРІС‚РѕРїР°СЂРє (СЃРµС‚РєР°)
в”‚   в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ [id]/page.tsx     в†ђ Р”РµС‚Р°Р»Рё РјР°С€РёРЅС‹
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ transactions/page.tsx в†ђ Р›РµРЅС‚Р° С‚СЂР°РЅР·Р°РєС†РёР№
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ payroll/
в”‚   в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ page.tsx          в†ђ Р—Рџ (РїРµСЂРёРѕРґС‹)
в”‚   в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ [id]/page.tsx     в†ђ Р”РµС‚Р°Р»Рё РїРµСЂРёРѕРґР°
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ receivables/page.tsx  в†ђ Р”РµР±РёС‚РѕСЂРєР°
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ payables/page.tsx     в†ђ РљСЂРµРґРёС‚РѕСЂРєР°
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ settings/
в”‚   в”‚   в”‚   в”‚       в”њв”Ђв”Ђ page.tsx          в†ђ РќР°СЃС‚СЂРѕР№РєРё (СЋСЂР»РёС†Р°, РєР°С‚РµРіРѕСЂРёРё Рё С‚.Рґ.)
в”‚   в”‚   в”‚   в”‚       в”њв”Ђв”Ђ users/page.tsx
в”‚   в”‚   в”‚   в”‚       в”њв”Ђв”Ђ payroll-rules/page.tsx
в”‚   в”‚   в”‚   в”‚       в””в”Ђв”Ђ integrations/page.tsx
в”‚   в”‚   в”‚   в””в”Ђв”Ђ api/
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ auth/
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ max/route.ts      в†ђ MAX OAuth
в”‚   в”‚   в”‚       в”‚   в””в”Ђв”Ђ logout/route.ts
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ trips/route.ts        в†ђ GET/POST trips
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ trips/[id]/
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ route.ts          в†ђ GET/PATCH trip
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ approve/route.ts  в†ђ POST approve
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ review/route.ts   в†ђ GET СЂРµРІСЊСЋ РґР°РЅРЅС‹Рµ
в”‚   в”‚   в”‚       в”‚   в””в”Ђв”Ђ summary/route.ts  в†ђ GET СЃРІРѕРґРєР° Р·Р° РґРµРЅСЊ
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ transactions/route.ts в†ђ GET/POST/PATCH
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ transactions/[id]/
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ route.ts
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ approve/route.ts
в”‚   в”‚   в”‚       в”‚   в””в”Ђв”Ђ complete/route.ts
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ money-map/route.ts    в†ђ GET Р±Р°Р»Р°РЅСЃ РєРѕС€РµР»СЊРєРѕРІ + P&L
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ assets/route.ts       в†ђ CRUD Р°РІС‚РѕРїР°СЂРє
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ payroll/
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ calculate/route.ts
в”‚   в”‚   в”‚       в”‚   в””в”Ђв”Ђ periods/route.ts
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ admin/
в”‚   в”‚   в”‚       в”‚   в”њв”Ђв”Ђ depreciation/route.ts
в”‚   в”‚   в”‚       в”‚   в””в”Ђв”Ђ sync-opti24/route.ts
в”‚   в”‚   в”‚       в””в”Ђв”Ђ health/route.ts       в†ђ Health check
в”‚   в”‚   в”њв”Ђв”Ђ components/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ layout/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Header.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Sidebar.tsx
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ MainLayout.tsx
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ features/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ MoneyMap.tsx          в†ђ Р“Р»Р°РІРЅР°СЏ (РєР°СЂС‚Р° РґРµРЅРµРі)
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ TripReviewTable.tsx   в†ђ Р РµРІСЊСЋ СЃРјРµРЅС‹
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ TransactionList.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ AssetGrid.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ PayrollCalculator.tsx
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ SetupWizard.tsx
в”‚   в”‚   в”‚   в””в”Ђв”Ђ common/
в”‚   в”‚   в”‚       в”њв”Ђв”Ђ (РІСЃРµ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РёР· packages/ui)
в”‚   в”‚   в”‚
в”‚   в”‚   в”њв”Ђв”Ђ hooks/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ useTrips.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ useTransactions.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ usePayroll.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ useMoneyMap.ts
в”‚   в”‚   в”‚   в””в”Ђв”Ђ useAuth.ts
в”‚   в”‚   в”‚
в”‚   в”‚   в”њв”Ђв”Ђ lib/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ supabase.ts               в†ђ Client Supabase
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ api-client.ts             в†ђ РћР±С‘СЂС‚РєР° РЅР°Рґ API Routes
в”‚   в”‚   в”‚   в””в”Ђв”Ђ utils.ts                  в†ђ РҐРµР»РїРµСЂС‹ (С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґРµРЅРµРі Рё С‚.Рґ.)
в”‚   в”‚   в”‚
в”‚   в”‚   в”њв”Ђв”Ђ styles/
в”‚   в”‚   в”‚   в””в”Ђв”Ђ globals.css               в†ђ Tailwind init
в”‚   в”‚   в”‚
в”‚   в”‚   в”њв”Ђв”Ђ next.config.ts
в”‚   в”‚   в”њв”Ђв”Ђ tsconfig.json
в”‚   в”‚   в”њв”Ђв”Ђ tailwind.config.ts
в”‚   в”‚   в”њв”Ђв”Ђ postcss.config.js
в”‚   в”‚   в”њв”Ђв”Ђ package.json
в”‚   в”‚   в””в”Ђв”Ђ .env.example                  в†ђ РЁР°Р±Р»РѕРЅ РїРµСЂРµРјРµРЅРЅС‹С…
в”‚   в”‚
в”‚   в””в”Ђв”Ђ miniapp/                          в†ђ Mini App РґР»СЏ MAX (РІРѕРґРёС‚РµР»Рё)
в”‚       в”њв”Ђв”Ђ app/
в”‚       в”‚   в”њв”Ђв”Ђ layout.tsx                в†ђ Root layout (safe-areas)
в”‚       в”‚   в”њв”Ђв”Ђ page.tsx                  в†ђ Home РІРѕРґРёС‚РµР»СЏ
в”‚       в”‚   в”њв”Ђв”Ђ (app)/
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ dashboard/page.tsx    в†ђ Р“Р»Р°РІРЅР°СЏ (РµСЃР»Рё РЅРµС‚ СЂРµР№СЃР°)
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ trip/
в”‚       в”‚   в”‚   в”‚   в”њв”Ђв”Ђ [id]/page.tsx     в†ђ РђРєС‚РёРІРЅС‹Р№ СЂРµР№СЃ
в”‚       в”‚   в”‚   в”‚   в”њв”Ђв”Ђ [id]/start/page.tsx в†ђ РќР°С‡Р°Р»Рѕ СЂРµР№СЃР° (modal)
в”‚       в”‚   в”‚   в”‚   в”њв”Ђв”Ђ [id]/order/page.tsx в†ђ Р¤РѕСЂРјР° Р·Р°РєР°Р·Р° (modal)
в”‚       в”‚   в”‚   в”‚   в”њв”Ђв”Ђ [id]/expense/page.tsx в†ђ Р¤РѕСЂРјР° СЂР°СЃС…РѕРґР° (modal)
в”‚       в”‚   в”‚   в”‚   в””в”Ђв”Ђ [id]/complete/page.tsx в†ђ Р—Р°РІРµСЂС€РµРЅРёРµ СЂРµР№СЃР° (modal)
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ my-accountable/page.tsx в†ђ РњРѕР№ РїРѕРґРѕС‚С‡С‘С‚
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ my-payroll/page.tsx   в†ђ РњРѕСЏ Р—Рџ
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ history/page.tsx      в†ђ РСЃС‚РѕСЂРёСЏ СЂРµР№СЃРѕРІ
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ service-orders/page.tsx в†ђ РњРѕРё Р·Р°РєР°Р·-РЅР°СЂСЏРґС‹ (mechanic)
в”‚       в”‚   в”‚   в””в”Ђв”Ђ settings/page.tsx     в†ђ РќР°СЃС‚СЂРѕР№РєРё
в”‚       в”‚   в””в”Ђв”Ђ api/
в”‚       в”‚       в”њв”Ђв”Ђ auth/
в”‚       в”‚       в”‚   в”њв”Ђв”Ђ max/route.ts
в”‚       в”‚       в”‚   в””в”Ђв”Ђ me/route.ts       в†ђ GET РїСЂРѕС„РёР»СЊ С‚РµРєСѓС‰РµРіРѕ СЋР·РµСЂР°
в”‚       в”‚       в”њв”Ђв”Ђ trips/
в”‚       в”‚       в”‚   в”њв”Ђв”Ђ route.ts          в†ђ GET Р°РєС‚РёРІРЅС‹Р№ + GET СЃРїРёСЃРѕРє
в”‚       в”‚       в”‚   в””в”Ђв”Ђ [id]/route.ts     в†ђ GET/PATCH/POST (start, orders, expenses, complete)
в”‚       в”‚       в”њв”Ђв”Ђ my/
в”‚       в”‚       в”‚   в”њв”Ђв”Ђ accountable/route.ts
в”‚       в”‚       в”‚   в””в”Ђв”Ђ payroll/route.ts
в”‚       в”‚       в”њв”Ђв”Ђ sync/route.ts         в†ђ POST СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ IndexedDB в†’ Supabase
в”‚       в”‚       в””в”Ђв”Ђ health/route.ts
в”‚       в”‚
в”‚       в”њв”Ђв”Ђ components/
в”‚       в”‚   в”њв”Ђв”Ђ layout/
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ Header.tsx            в†ђ РџСЂРѕСЃС‚Р°СЏ С€Р°РїРєР° СЃ <
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ TabBar.tsx            в†ђ Bottom tabs (4 РёРєРѕРЅРєРё)
в”‚       в”‚   в”‚   в””в”Ђв”Ђ MiniAppLayout.tsx
в”‚       в”‚   в”њв”Ђв”Ђ features/
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ TripCard.tsx
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ OrderForm.tsx         в†ђ Р¤РѕСЂРјР° Р·Р°РєР°Р·Р°
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ ExpenseForm.tsx
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ TripStartModal.tsx
в”‚       в”‚   в”‚   в”њв”Ђв”Ђ TripCompleteModal.tsx
в”‚       в”‚   в”‚   в””в”Ђв”Ђ AccountableBalance.tsx
в”‚       в”‚   в””в”Ђв”Ђ (РѕСЃС‚Р°Р»СЊРЅРѕРµ РёР· packages/ui)
в”‚       в”‚
в”‚       в”њв”Ђв”Ђ hooks/
в”‚       в”‚   в”њв”Ђв”Ђ useOfflineStorage.ts      в†ђ IndexedDB via Dexie
в”‚       в”‚   в”њв”Ђв”Ђ useSync.ts                в†ђ РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ
в”‚       в”‚   в”њв”Ђв”Ђ useActiveTrip.ts
в”‚       в”‚   в”њв”Ђв”Ђ useTrips.ts
в”‚       в”‚   в”њв”Ђв”Ђ useAuth.ts
в”‚       в”‚   в””в”Ђв”Ђ useHaptic.ts              в†ђ Р’РёР±СЂР°С†РёСЏ
в”‚       в”‚
в”‚       в”њв”Ђв”Ђ lib/
в”‚       в”‚   в”њв”Ђв”Ђ supabase.ts               в†ђ Client Supabase
в”‚       в”‚   в”њв”Ђв”Ђ api-client.ts
в”‚       в”‚   в”њв”Ђв”Ђ db.ts                     в†ђ Dexie (IndexedDB СЃС…РµРјР°)
в”‚       в”‚   в”њв”Ђв”Ђ offline-queue.ts          в†ђ РћС‡РµСЂРµРґСЊ РјСѓС‚Р°С†РёР№ РґР»СЏ sync
в”‚       в”‚   в””в”Ђв”Ђ max-sdk.ts                в†ђ РћР±С‘СЂС‚РєР° РЅР°Рґ MAX SDK
в”‚       в”‚
в”‚       в”њв”Ђв”Ђ styles/
в”‚       в”‚   в”њв”Ђв”Ђ globals.css
в”‚       в”‚   в””в”Ђв”Ђ safe-areas.css            в†ђ env(safe-area-inset-*)
в”‚       в”‚
в”‚       в”њв”Ђв”Ђ next.config.ts
в”‚       в”њв”Ђв”Ђ tsconfig.json
в”‚       в”њв”Ђв”Ђ tailwind.config.ts
в”‚       в”њв”Ђв”Ђ postcss.config.js
в”‚       в”њв”Ђв”Ђ package.json
в”‚       в””в”Ђв”Ђ .env.example
в”‚
в”њв”Ђв”Ђ packages/
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ shared-types/                    в†ђ РћР±С‰РёРµ С‚РёРїС‹
в”‚   в”‚   в”њв”Ђв”Ђ index.ts
в”‚   в”‚   в”њв”Ђв”Ђ database.types.ts            в†ђ Р“РµРЅРµСЂРёСЂСѓРµС‚СЃСЏ РёР· Supabase (supabase gen types)
в”‚   в”‚   в”њв”Ђв”Ђ api.types.ts                 в†ђ РўРёРїС‹ API Р·Р°РїСЂРѕСЃРѕРІ/РѕС‚РІРµС‚РѕРІ
в”‚   в”‚   в”њв”Ђв”Ђ business.types.ts            в†ђ Р‘РёР·РЅРµСЃ-Р»РѕРіРёРєР° (PaymentMethod, TripType Рё С‚.Рґ.)
в”‚   в”‚   в””в”Ђв”Ђ package.json
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ ui/                              в†ђ РљРѕРјРїРѕРЅРµРЅС‚С‹ + СЃС‚РёР»Рё
в”‚   в”‚   в”њв”Ђв”Ђ src/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ components/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Button.tsx            в†ђ shadcn/ui + РЅР°С€ СЃС‚РёР»РёРЅРі
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Input.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Card.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Badge.tsx             в†ђ РЎС‚Р°С‚СѓСЃ-Р±РµР№РґР¶Рё
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Dialog.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Combobox.tsx          в†ђ Autocomplete
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Table.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Tabs.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Toast.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ Spinner.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ StatusBadge.tsx       в†ђ Р”Р»СЏ РґРІСѓС…РѕСЃРЅРѕРіРѕ СЃС‚Р°С‚СѓСЃР°
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ MoneyBadge.tsx        в†ђ Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґРµРЅРµРі
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ ...РѕСЃС‚Р°Р»СЊРЅРѕРµ shadcn/ui
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ icons/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ TripIcon.tsx
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ MoneyIcon.tsx
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ ...
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ hooks/
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ useToast.ts           в†ђ РР· sonner
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ theme/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ colors.ts             в†ђ РџР°Р»РёС‚СЂР° РёР· РґРёР·Р°Р№РЅР°
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ typography.ts
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ spacing.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ index.ts                  в†ђ Export РІСЃРµС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
в”‚   в”‚   в”‚   в””в”Ђв”Ђ global.css
в”‚   в”‚   в”њв”Ђв”Ђ tsconfig.json
в”‚   в”‚   в”њв”Ђв”Ђ package.json
в”‚   в”‚   в””в”Ђв”Ђ tailwind.config.ts
в”‚   в”‚
в”‚   в”њв”Ђв”Ђ api-client/                      в†ђ Supabase С„СѓРЅРєС†РёРё
в”‚   в”‚   в”њв”Ђв”Ђ src/
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ index.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ supabase.ts               в†ђ РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Supabase Client
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ auth.ts                   в†ђ Login, logout, getCurrentUser
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ trips.ts                  в†ђ CRUD trips + trip_orders
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ transactions.ts           в†ђ CRUD transactions
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ assets.ts                 в†ђ CRUD assets
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ payroll.ts                в†ђ Р Р°СЃС‡С‘С‚ Р—Рџ
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ wallets.ts                в†ђ Р‘Р°Р»Р°РЅСЃ РєРѕС€РµР»СЊРєРѕРІ
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ integrations/
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ opti24.ts
в”‚   в”‚   в”‚   в”‚   в”њв”Ђв”Ђ wialon.ts
в”‚   в”‚   в”‚   в”‚   в””в”Ђв”Ђ bank.ts
в”‚   в”‚   в”‚   в”њв”Ђв”Ђ utils.ts                  в†ђ РҐРµР»РїРµСЂС‹ (С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ, РІР°Р»РёРґР°С†РёСЏ)
в”‚   в”‚   в”‚   в””в”Ђв”Ђ types.ts                  в†ђ Р›РѕРєР°Р»СЊРЅС‹Рµ С‚РёРїС‹ РґР»СЏ API
в”‚   в”‚   в”њв”Ђв”Ђ tsconfig.json
в”‚   в”‚   в””в”Ђв”Ђ package.json
в”‚   в”‚
в”‚   в””в”Ђв”Ђ constants/                        в†ђ РљРѕРЅСЃС‚Р°РЅС‚С‹ Рё РєРѕРЅС„РёРі
в”‚       в”њв”Ђв”Ђ src/
в”‚       в”‚   в”њв”Ђв”Ђ index.ts
в”‚       в”‚   в”њв”Ђв”Ђ business-rules.ts         в†ђ % Р—Рџ, С‚РёРїС‹ СЂРµР№СЃРѕРІ Рё С‚.Рґ.
в”‚       в”‚   в”њв”Ђв”Ђ api-endpoints.ts
в”‚       в”‚   в”њв”Ђв”Ђ error-messages.ts
в”‚       в”‚   в””в”Ђв”Ђ feature-flags.ts          в†ђ A/B С‚РµСЃС‚С‹, С„РёС‡Рё
в”‚       в”њв”Ђв”Ђ tsconfig.json
в”‚       в””в”Ђв”Ђ package.json
в”‚
в”њв”Ђв”Ђ docs/
в”‚   в”њв”Ђв”Ђ BOOT.md                          в†ђ РљР°Рє Р·Р°РїСѓСЃС‚РёС‚СЊ dev СЃРµСЂРІРµСЂ
в”‚   в”њв”Ђв”Ђ DATABASE.md                      в†ђ РџРѕР»РЅР°СЏ РєР°СЂС‚Р° Р‘Р” (СЌС‚РѕС‚ С„Р°Р№Р» СЃРѕР·РґР°Рј)
в”‚   в”њв”Ђв”Ђ ENVIRONMENT.md                   в†ђ РџРµСЂРµРјРµРЅРЅС‹Рµ РѕРєСЂСѓР¶РµРЅРёСЏ (СЌС‚РѕС‚ С„Р°Р№Р» СЃРѕР·РґР°Рј)
в”‚   в”њв”Ђв”Ђ ROADMAP.md                       в†ђ Р”РѕСЂРѕР¶РЅР°СЏ РєР°СЂС‚Р° (СЃРѕР·РґР°Рј)
в”‚   в”њв”Ђв”Ђ DEPLOYMENT.md                    в†ђ РљР°Рє РґРµРїР»РѕРёС‚СЊ (СЃРѕР·РґР°Рј)
в”‚   в”њв”Ђв”Ђ API.md                           в†ђ РЎРїРµРєР° API Routes (СЃРѕР·РґР°Рј)
в”‚   в”њв”Ђв”Ђ OFFLINE_SYNC.md                  в†ђ Offline-first СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ
в”‚   в””в”Ђв”Ђ TESTING.md                       в†ђ РљР°Рє С‚РµСЃС‚РёСЂРѕРІР°С‚СЊ
в”‚
в”њв”Ђв”Ђ scripts/
в”‚   в”њв”Ђв”Ђ setup-db.ts                      в†ђ Init Supabase (СЃРѕР·РґР°РЅРёРµ С‚Р°Р±Р»РёС†)
в”‚   в”њв”Ђв”Ђ seed-db.ts                       в†ђ Seed РґР°РЅРЅС‹Рµ (SaldaCargo_Seed_Data.md)
в”‚   в”њв”Ђв”Ђ export-types.sh                  в†ђ Р“РµРЅРµСЂР°С†РёСЏ С‚РёРїРѕРІ РёР· Supabase
в”‚   в””в”Ђв”Ђ clean.sh                         в†ђ РћС‡РёСЃС‚РєР° build Р°СЂС‚РёС„Р°РєС‚РѕРІ
в”‚
в”њв”Ђв”Ђ .env.example                         в†ђ РЁР°Р±Р»РѕРЅ (РІСЃРµ РїРµСЂРµРјРµРЅРЅС‹Рµ СЃРѕ Р·РЅР°С‡РµРЅРёСЏРјРё)
в”њв”Ђв”Ђ .env.local                           в†ђ Git ignored, Р»РѕРєР°Р»СЊРЅС‹Р№ dev
в”њв”Ђв”Ђ .env.production                      в†ђ Production РїРµСЂРµРјРµРЅРЅС‹Рµ (Vercel secrets)
в”њв”Ђв”Ђ .gitignore
в”њв”Ђв”Ђ pnpm-workspace.yaml                  в†ђ РљРѕРЅС„РёРі monorepo (pnpm)
в”њв”Ђв”Ђ package.json                         в†ђ Root: СЃРєСЂРёРїС‚С‹, deps, РІРµСЂСЃРёРё
в”њв”Ђв”Ђ tsconfig.base.json                   в†ђ Base TypeScript РєРѕРЅС„РёРі
в”њв”Ђв”Ђ turbo.json                           в†ђ Turbo РґР»СЏ build caching (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
в”њв”Ђв”Ђ README.md
в”њв”Ђв”Ђ LICENSE
в””в”Ђв”Ђ .github/
    в”њв”Ђв”Ђ CONTRIBUTING.md
    в”њв”Ђв”Ђ PULL_REQUEST_TEMPLATE.md
    в””в”Ђв”Ђ ISSUE_TEMPLATE/
        в”њв”Ђв”Ђ task.md
        в””в”Ђв”Ђ bug.md
```

---

## 2. pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 3. package.json (root)

```json
{
  "name": "saldacargo",
  "version": "1.0.0",
  "description": "Transport business management system",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev:web": "pnpm --filter @saldacargo/web dev",
    "dev:miniapp": "pnpm --filter @saldacargo/miniapp dev",
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "build:web": "pnpm --filter @saldacargo/web build",
    "build:miniapp": "pnpm --filter @saldacargo/miniapp build",
    "lint": "pnpm -r lint",
    "type-check": "pnpm -r type-check",
    "test": "pnpm -r test",
    "db:setup": "ts-node scripts/setup-db.ts",
    "db:seed": "ts-node scripts/seed-db.ts",
    "db:types": "scripts/export-types.sh",
    "clean": "scripts/clean.sh"
  },
  "devDependencies": {
    "@types/node": "^20",
    "typescript": "^5.3",
    "ts-node": "^10.9",
    "turbo": "^1.10"
  }
}
```

---

## 4. tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "baseUrl": ".",
    "paths": {
      "@saldacargo/shared-types": ["packages/shared-types/src"],
      "@saldacargo/ui": ["packages/ui/src"],
      "@saldacargo/api-client": ["packages/api-client/src"],
      "@saldacargo/constants": ["packages/constants/src"],
      "@/*": ["./apps/web/src/*"],
      "@miniapp/*": ["./apps/miniapp/src/*"]
    }
  }
}
```

---

## 5. .env.example (РІ root)

```bash
# ============ SUPABASE ============
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============ MAX SDK ============
NEXT_PUBLIC_MAX_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
NEXT_PUBLIC_MAX_APP_ID=com.example.saldacargo

# ============ EXTERNAL APIs ============
OPTI24_API_KEY=api_key_from_opti24
WIALON_API_TOKEN=token_from_wialon
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# ============ APP CONFIG ============
NEXT_PUBLIC_APP_ENV=development|production
NEXT_PUBLIC_API_URL=http://localhost:3000 (РґР»СЏ dev), https://saldacargo.ru (РґР»СЏ prod)

# ============ VERCEL (РґР»СЏ Р°РІС‚РѕРґРµРїР»РѕСЏ) ============
VERCEL_TOKEN=vercel_token
```

---

## 6. GitHub Actions: deploy-web.yml

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build:web
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_WEB }}
```

РўРѕ Р¶Рµ РґР»СЏ deploy-miniapp.yml (РЅРѕ СЃ РїСѓС‚СЏРјРё РЅР° `apps/miniapp`).

---

## 7. РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЂРµРїРѕ

```bash
# 1. РЎРѕР·РґР°С‚СЊ СЂРµРїРѕ РЅР° GitHub
git clone https://github.com/your-org/saldacargo.git
cd saldacargo

# 2. РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ pnpm monorepo
pnpm init
# РћС‚СЂРµРґР°РєС‚РёСЂРѕРІР°С‚СЊ package.json (СЃРєРѕРїРёСЂРѕРІР°С‚СЊ РёР· Рї.3 РІС‹С€Рµ)

# 3. РЎРѕР·РґР°С‚СЊ СЃС‚СЂСѓРєС‚СѓСЂСѓ
mkdir -p apps/{web,miniapp} packages/{shared-types,ui,api-client,constants}

# 4. РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Next.js РїСЂРёР»РѕР¶РµРЅРёСЏ
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --no-git
cd ../miniapp
pnpm create next-app@latest . --typescript --tailwind --no-git
cd ../..

# 5. РЈСЃС‚Р°РЅРѕРІРёС‚СЊ РѕР±С‰РёРµ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
pnpm add -D -w typescript @types/node

# 6. РЎРѕР·РґР°С‚СЊ РїР°РєРµС‚С‹
cd packages/shared-types && pnpm init
cd ../ui && pnpm init
cd ../api-client && pnpm init
cd ../constants && pnpm init

# 7. РЈСЃС‚Р°РЅРѕРІРёС‚СЊ РІСЃРµ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
cd ../..
pnpm install

# 8. РРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ Supabase Р»РѕРєР°Р»СЊРЅРѕ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
npx supabase start

# 9. Р—Р°РїСѓСЃС‚РёС‚СЊ РѕР±Р° РїСЂРёР»РѕР¶РµРЅРёСЏ
pnpm dev
```

---

## 8. Р Р°Р·РІРµСЂС‚С‹РІР°РЅРёРµ РЅР° Vercel

**Р’Р°СЂРёР°РЅС‚ 1: РћС‚РґРµР»СЊРЅС‹Рµ Vercel РїСЂРѕРµРєС‚С‹ (СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ)**

1. РЎРѕР·РґР°С‚СЊ РґРІР° РїСЂРѕРµРєС‚Р° РЅР° Vercel:
   - `saldacargo-web` в†’ deploy РёР· `apps/web`
   - `saldacargo-miniapp` в†’ deploy РёР· `apps/miniapp`

2. Р’ РєР°Р¶РґРѕРј РїСЂРѕРµРєС‚Рµ СѓРєР°Р·Р°С‚СЊ:
   - **Root Directory:** `apps/web` (РёР»Рё `apps/miniapp`)
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next`
   - **Environment:** СЃРєРѕРїРёСЂРѕРІР°С‚СЊ РїРµСЂРµРјРµРЅРЅС‹Рµ РёР· `.env.example`

3. РќР°СЃС‚СЂРѕРёС‚СЊ GitHub Actions (СЃРј. Рї.6) вЂ” РѕРЅРё Р±СѓРґСѓС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РґРµРїР»РѕРёС‚СЊ РїСЂРё push.

**Р’Р°СЂРёР°РЅС‚ 2: РћРґРёРЅ Vercel СЃ С„СѓРЅРєС†РёСЏРјРё РїРµСЂРµРЅР°РїСЂР°РІР»РµРЅРёСЏ**

- РћСЃРЅРѕРІРЅРѕР№ РґРµРїР»РѕР№: `apps/web`
- РџРµСЂРµРЅР°РїСЂР°РІРёС‚СЊ `/miniapp/*` в†’ РѕС‚РґРµР»СЊРЅС‹Р№ Next.js SPA (Р±РѕР»РµРµ СЃР»РѕР¶РЅРѕ)

**Р РµРєРѕРјРµРЅРґСѓРµРј Р’Р°СЂРёР°РЅС‚ 1** вЂ” С‡РёСЃС‚РѕР№ Рё РЅРµР·Р°РІРёСЃРёРјС‹Рµ РґРµРїР»РѕРё.

---

## 9. Р›РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР°

### Р—Р°РїСѓСЃРє

```bash
# Р—Р°РїСѓСЃС‚РёС‚СЊ РѕР±Рµ РїСЂРёР»РѕР¶РµРЅРёСЏ
pnpm dev

# РР»Рё РѕС‚РґРµР»СЊРЅРѕ
pnpm dev:web       # http://localhost:3000
pnpm dev:miniapp   # http://localhost:3001
```

### IDE Setup (VS Code)

РЎРѕР·РґР°С‚СЊ `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.turbo": true
  }
}
```

---

## 10. Р”РµРїР»РѕР№ РЅР° СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ СЃРµСЂРІРµСЂ (Р°Р»СЊС‚РµСЂРЅР°С‚РёРІР° Vercel)

Р•СЃР»Рё РЅСѓР¶РµРЅ СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ СЃРµСЂРІРµСЂ (Docker, PM2):

```dockerfile
FROM node:20-alpine
WORKDIR /app

# РљРѕРїРёСЂРѕРІР°С‚СЊ РІСЃС‘
COPY . .

# РЈСЃС‚Р°РЅРѕРІРёС‚СЊ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё
RUN pnpm install --frozen-lockfile

# РЎРѕР±СЂР°С‚СЊ
RUN pnpm build

# Р—Р°РїСѓСЃС‚РёС‚СЊ РѕР±Рµ РїСЂРёР»РѕР¶РµРЅРёСЏ
CMD pnpm dev
```

Р”Р»СЏ production вЂ” РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ `next start` РІРјРµСЃС‚Рѕ `dev`.

---

## РС‚РѕРіРѕ

вњ… РњРѕРЅРѕСЂРµРїРѕ РіРѕС‚РѕРІ Рє СЂР°Р·СЂР°Р±РѕС‚РєРµ  
вњ… Р”РІР° РЅРµР·Р°РІРёСЃРёРјС‹С… РїСЂРёР»РѕР¶РµРЅРёСЏ (web + miniapp)  
вњ… РћР±С‰РёРµ РїР°РєРµС‚С‹ РґР»СЏ РєРѕРґР°, С‚РёРїРѕРІ, РєРѕРјРїРѕРЅРµРЅС‚РѕРІ  
вњ… CI/CD С‡РµСЂРµР· GitHub Actions + Vercel  
вњ… Р›РѕРєР°Р»СЊРЅР°СЏ СЂР°Р·СЂР°Р±РѕС‚РєР° С‡РµСЂРµР· `pnpm dev`  

**РЎР»РµРґСѓСЋС‰РёР№ С„Р°Р№Р»:** DATABASE.md (РїРѕР»РЅР°СЏ РєР°СЂС‚Р° Supabase)
