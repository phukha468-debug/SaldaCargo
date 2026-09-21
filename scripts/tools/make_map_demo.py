import os

html_code = """<!DOCTYPE html>
<html lang="ru" class="dark scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ИП Нигамедьянов А.С. | Интерактивный маршрут Верхняя Салда - Екатеринбург</title>
  
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
              400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
              800: '#92400e', 900: '#78350f'
            },
            dark: {
              950: '#06090e', 900: '#0b0f17', 850: '#0f172a',
              800: '#111827', 750: '#161f30', 700: '#1e293b', 600: '#334155'
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <script src="https://unpkg.com/lucide@latest"></script>

  <style>
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #06090e; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #d97706; }

    /* Semi-transparent glass cards allowing background map to be visible but fully readable */
    .theme-card {
      background: rgba(11, 15, 23, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s ease;
    }
    .theme-card:hover {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(15, 23, 42, 0.9);
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.7);
    }

    /* Pulse Glow for Map Checkpoints */
    .city-pulse {
      animation: pulseMarker 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
    }
    @keyframes pulseMarker {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.6; }
    }

    /* Road Glow */
    .road-glow {
      filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
    }
  </style>
</head>
<body class="bg-dark-950 text-slate-200 antialiased selection:bg-brand-600 selection:text-white min-h-screen relative overflow-x-hidden">

  <!-- ========================================================================= -->
  <!-- 🚚 DYNAMIC INTERACTIVE MAP BACKGROUND WITH SCROLLING GAZELLE TRUCK -->
  <!-- ========================================================================= -->
  <div id="interactive-map-bg" class="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
    
    <!-- Subtle Geographic Grid & Dark Regional Contours -->
    <div class="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:32px_32px]"></div>
    
    <!-- Ambient Vignette & Fog -->
    <div class="absolute inset-0 bg-gradient-to-b from-dark-950/90 via-transparent to-dark-950/95"></div>
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>

    <!-- Fullscreen SVG Map Canvas (Coordinates: 1000 x 2000 ViewBox) -->
    <svg id="map-svg" viewBox="0 0 1000 2000" preserveAspectRatio="xMidYMid slice" class="w-full h-full opacity-60">
      <defs>
        <!-- Gradients -->
        <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="50%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>

        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Regional River / Geography Lines (Subtle aesthetics) -->
      <path d="M 900,100 Q 750,400 800,800 T 700,1400 T 850,1950" fill="none" stroke="#1e293b" stroke-width="6" stroke-linecap="round" opacity="0.4" />
      <path d="M 100,300 Q 250,700 150,1100 T 300,1700" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round" opacity="0.3" />

      <!-- The Main Highway Route: Верхняя Салда (Top Right) -> Нижний Тагил (Mid Left) -> Невьянск (Mid Right) -> Екатеринбург (Bottom Center) -->
      <!-- Background Highway Base (Dark Grey) -->
      <path id="highway-base" 
            d="M 680,180 C 600,320 320,480 340,750 C 360,1000 620,1150 560,1380 C 500,1600 480,1750 450,1880" 
            fill="none" 
            stroke="#1e293b" 
            stroke-width="8" 
            stroke-linecap="round" />

      <!-- Highway Dashed White Line -->
      <path id="highway-dashed" 
            d="M 680,180 C 600,320 320,480 340,750 C 360,1000 620,1150 560,1380 C 500,1600 480,1750 450,1880" 
            fill="none" 
            stroke="#334155" 
            stroke-width="2" 
            stroke-dasharray="10,12" 
            stroke-linecap="round" />

      <!-- Active Illuminated Progress Trail (Drives with truck) -->
      <path id="highway-progress" 
            d="M 680,180 C 600,320 320,480 340,750 C 360,1000 620,1150 560,1380 C 500,1600 480,1750 450,1880" 
            fill="none" 
            stroke="url(#roadGrad)" 
            stroke-width="5" 
            filter="url(#glow)"
            stroke-linecap="round" />

      <!-- ================= CITY CHECKPOINTS ================= -->
      
      <!-- 1. ВЕРХНЯЯ САЛДА (Старт, 0 км) -->
      <g id="city-salda" transform="translate(680, 180)">
        <circle r="22" fill="#f59e0b" fill-opacity="0.15" class="city-pulse" />
        <circle r="9" fill="#0b0f17" stroke="#f59e0b" stroke-width="3" />
        <circle r="4" fill="#f59e0b" />
        <!-- Label Badge -->
        <rect x="20" y="-22" width="180" height="42" rx="8" fill="#0b0f17" fill-opacity="0.9" stroke="#f59e0b" stroke-width="1.5" />
        <text x="32" y="-5" fill="#ffffff" font-size="14" font-weight="bold" font-family="sans-serif">ВЕРХНЯЯ САЛДА</text>
        <text x="32" y="12" fill="#f59e0b" font-size="11" font-weight="bold" font-family="sans-serif">База • Подача от 5 мин</text>
      </g>

      <!-- 2. НИЖНИЙ ТАГИЛ (40 км) -->
      <g id="city-tagil" transform="translate(340, 750)">
        <circle r="20" fill="#3b82f6" fill-opacity="0.15" class="city-pulse" />
        <circle r="8" fill="#0b0f17" stroke="#3b82f6" stroke-width="3" />
        <circle r="3.5" fill="#3b82f6" />
        <!-- Label Badge -->
        <rect x="-195" y="-22" width="180" height="42" rx="8" fill="#0b0f17" fill-opacity="0.9" stroke="#3b82f6" stroke-width="1.5" />
        <text x="-183" y="-5" fill="#ffffff" font-size="14" font-weight="bold" font-family="sans-serif">НИЖНИЙ ТАГИЛ</text>
        <text x="-183" y="12" fill="#60a5fa" font-size="11" font-weight="bold" font-family="sans-serif">40 км • Экспресс 45 мин</text>
      </g>

      <!-- 3. НЕВЬЯНСК (105 км) -->
      <g id="city-nevyansk" transform="translate(560, 1380)">
        <circle r="16" fill="#818cf8" fill-opacity="0.15" />
        <circle r="7" fill="#0b0f17" stroke="#818cf8" stroke-width="2.5" />
        <circle r="3" fill="#818cf8" />
        <!-- Label Badge -->
        <rect x="18" y="-18" width="150" height="36" rx="8" fill="#0b0f17" fill-opacity="0.85" stroke="#818cf8" stroke-width="1" />
        <text x="28" y="-2" fill="#ffffff" font-size="12" font-weight="bold" font-family="sans-serif">НЕВЬЯНСК</text>
        <text x="28" y="12" fill="#a5b4fc" font-size="10" font-family="sans-serif">105 км маршрута</text>
      </g>

      <!-- 4. ЕКАТЕРИНБУРГ (Финиш, 180 км) -->
      <g id="city-ekb" transform="translate(450, 1880)">
        <circle r="26" fill="#10b981" fill-opacity="0.2" class="city-pulse" />
        <circle r="11" fill="#0b0f17" stroke="#10b981" stroke-width="3.5" />
        <circle r="5" fill="#10b981" />
        <!-- Label Badge -->
        <rect x="-195" y="-25" width="180" height="46" rx="8" fill="#0b0f17" fill-opacity="0.95" stroke="#10b981" stroke-width="1.5" />
        <text x="-183" y="-5" fill="#ffffff" font-size="14" font-weight="bold" font-family="sans-serif">ЕКАТЕРИНБУРГ</text>
        <text x="-183" y="13" fill="#34d399" font-size="11" font-weight="bold" font-family="sans-serif">180 км • Доставка в срок</text>
      </g>

      <!-- ================= THE ANIMATED GAZELLE TRUCK ================= -->
      <g id="truck-marker" transform="translate(680, 180) rotate(0)">
        <!-- Headlights beam -->
        <polygon points="18,-10 75,-30 75,30 18,10" fill="url(#headlightGrad)" opacity="0.35" />
        
        <!-- Truck Halo & Glow -->
        <circle r="22" fill="#f59e0b" fill-opacity="0.25" filter="url(#glow)" />
        
        <!-- Truck Body (Sleek Modern Top-Down SVG Gazelle) -->
        <!-- Cab -->
        <rect x="-6" y="-12" width="22" height="24" rx="4" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />
        <!-- Windshield -->
        <rect x="4" y="-9" width="6" height="18" rx="2" fill="#0b0f17" />
        <!-- Cargo Body / Van (Тент) -->
        <rect x="-30" y="-14" width="25" height="28" rx="3" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
        <!-- Wheels -->
        <rect x="-24" y="-16" width="7" height="3" rx="1" fill="#000000" />
        <rect x="-24" y="13" width="7" height="3" rx="1" fill="#000000" />
        <rect x="5" y="-14" width="6" height="3" rx="1" fill="#000000" />
        <rect x="5" y="11" width="6" height="3" rx="1" fill="#000000" />
        <!-- Top Text Badge -->
        <circle cx="-17" cy="0" r="4" fill="#f59e0b" />
      </g>

      <linearGradient id="headlightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
      </linearGradient>

    </svg>
  </div>

  <!-- ========================================================================= -->
  <!-- 🧭 FLOATING ROUTE HUD (Live GPS Tracker on Screen) -->
  <!-- ========================================================================= -->
  <div class="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-dark-900/90 border border-brand-500/40 backdrop-blur-md shadow-2xl">
    <div class="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 animate-pulse">
      <i data-lucide="truck" class="w-4 h-4"></i>
    </div>
    <div class="text-xs">
      <div class="flex items-center gap-2">
        <span class="font-bold text-white" id="hud-status-text">Верхняя Салда (Старт)</span>
        <span class="text-[10px] font-mono px-1.5 py-0.2 bg-brand-500/20 text-brand-400 rounded" id="hud-percent">0%</span>
      </div>
      <div class="text-[11px] text-slate-400 font-mono mt-0.5" id="hud-distance-text">Пройдено: 0 км / 180 км</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- HEADER -->
  <!-- ========================================================================= -->
  <header class="sticky top-0 z-40 bg-dark-950/85 backdrop-blur-md border-b border-slate-800 transition-colors">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        
        <a href="#" class="flex items-center gap-3 group">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-amber-700 p-0.5 shadow-md flex-shrink-0 overflow-hidden">
            <img src="logo.jpg" alt="Logo" class="w-full h-full object-cover rounded-[10px]" onerror="this.src='truck-next-winter.jpg'" />
          </div>
          <div>
            <div class="font-bold text-base sm:text-lg text-white leading-tight flex items-center gap-2">
              <span>ИП Нигамедьянов А. С.</span>
              <span class="px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30">ATI 5.0 ⭐</span>
            </div>
            <div class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-brand-500"></i>
              <span>г. Верхняя Салда • УрФО и вся Россия</span>
            </div>
          </div>
        </a>

        <nav class="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-300">
          <a href="#tariffs" class="text-brand-400 hover:text-brand-300 transition">Тарифы по городу</a>
          <a href="#gallery" class="hover:text-brand-400 transition">Автопарк</a>
          <a href="#calculator" class="hover:text-brand-400 transition">Калькулятор</a>
          <a href="#requisites" class="hover:text-brand-400 transition">Реквизиты</a>
          <a href="#contact" class="hover:text-brand-400 transition">Контакты</a>
        </nav>

        <div class="flex items-center gap-3">
          <a href="tel:+79630501501" class="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-bold text-white hover:border-brand-500 transition">
            <i data-lucide="phone" class="w-3.5 h-3.5 text-brand-400"></i>
            <span>8 (963) 050-15-01</span>
          </a>
          <a href="#contact" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white text-xs font-bold shadow-lg shadow-brand-900/40 hover:from-brand-500 hover:to-amber-500 transition">
            Заказать рейс
          </a>
        </div>

      </div>
    </div>
  </header>

  <!-- ========================================================================= -->
  <!-- MAIN CONTENT (With semi-transparent readable glass sections) -->
  <!-- ========================================================================= -->
  <main class="relative z-10 space-y-24 py-10">

    <!-- 1. HERO SECTION (Верхняя Салда — Старт) -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div class="grid lg:grid-cols-12 gap-10 items-center">
        
        <div class="lg:col-span-7 space-y-6">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-400 text-xs font-bold shadow-lg">
            <span class="w-2.5 h-2.5 rounded-full bg-brand-500 animate-ping"></span>
            <span>Подача машины по Салде — от 5 минут! • 11 автомобилей</span>
          </div>

          <h1 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            Грузоперевозки из <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-amber-300 to-amber-500">Верхней Салды</span> по всей России
          </h1>

          <p class="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Собственный автопарк от 1.5 до 5.0 тонн (ГАЗель NEXT, Валдай, Fuso). Личная ремонтная база, 0% срывов, официальные договоры с НДС/без НДС и ЭДО.
          </p>

          <div class="flex flex-col sm:flex-row gap-4 pt-2">
            <a href="#calculator" class="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white font-bold text-base shadow-xl shadow-brand-900/50 hover:from-brand-500 hover:to-amber-500 transition">
              <i data-lucide="calculator" class="w-5 h-5"></i>
              <span>Рассчитать стоимость</span>
            </a>
            <a href="#tariffs" class="inline-flex items-center justify-center gap-3 px-7 py-4 rounded-xl theme-card text-slate-200 font-semibold text-base">
              <i data-lucide="tag" class="w-5 h-5 text-brand-400"></i>
              <span>Тарифы по городу</span>
            </a>
          </div>

          <!-- Hint about scroll animation -->
          <div class="pt-4 flex items-center gap-2 text-xs text-amber-300/90 font-medium">
            <i data-lucide="mouse" class="w-4 h-4 animate-bounce"></i>
            <span>Прокручивайте страницу вниз: автомобиль поедет по карте из Салды через Тагил в Екатеринбург!</span>
          </div>
        </div>

        <div class="lg:col-span-5">
          <div class="theme-card p-4 rounded-3xl space-y-3">
            <div class="relative h-64 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
              <img src="truck-next-winter.jpg" alt="Газель NEXT" class="w-full h-full object-cover" />
              <div class="absolute top-3 left-3 px-3 py-1 bg-brand-500 text-black text-xs font-black rounded-lg">
                ⚡ Подача от 5 мин
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center pt-2">
              <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-white">11</span><span class="text-[10px] text-brand-400">Автопарк</span></div>
              <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-emerald-400">5.0 ⭐</span><span class="text-[10px] text-slate-400">ATI.SU</span></div>
              <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-white">37 т</span><span class="text-[10px] text-brand-400">Сумм. г/п</span></div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- 2. ГОРОДСКИЕ ТАРИФЫ -->
    <section id="tariffs" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <div class="text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">Прозрачные фиксированные цены</div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Городские тарифы (Верхняя Салда и район)</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div class="theme-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <i data-lucide="zap" class="w-5 h-5"></i>
            </div>
            <h3 class="text-base font-bold text-white mb-1">Быстрый заказ (20 мин)</h3>
            <p class="text-xs text-slate-400 mb-4">Машина без грузчиков для оперативной доставки одного или нескольких предметов.</p>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-2">
              <div class="text-xs text-slate-400">Стоимость рейса:</div>
              <div class="text-xl font-black text-blue-400 mt-0.5">1 000 — 1 500 ₽</div>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 mt-2">* Точную сумму подскажет менеджер по телефону.</p>
        </div>

        <div class="theme-card p-6 rounded-2xl flex flex-col justify-between border-brand-500/40">
          <div>
            <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-3">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <h3 class="text-base font-bold text-white mb-1">Без грузчиков (1 час)</h3>
            <p class="text-xs text-slate-400 mb-4">Почасовая аренда ГАЗели с водителем по Верхней Салде. Подача от 5 минут.</p>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-brand-500/30 mb-2">
              <div class="text-xs text-slate-400">Тариф за 1 час:</div>
              <div class="text-xl font-black text-brand-400 mt-0.5">1 500 ₽ / час</div>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 mt-2">Помощь водителя в фиксации груза ремнями.</p>
        </div>

        <div class="theme-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <i data-lucide="users" class="w-5 h-5"></i>
            </div>
            <h3 class="text-base font-bold text-white mb-1">С 2 грузчиками</h3>
            <p class="text-xs text-slate-400 mb-4">Машина + 2 опытных грузчика под ключ: спуск, аккуратная погрузка, подъем.</p>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-2">
              <div class="text-xs text-slate-400">Машина + 2 грузчика:</div>
              <div class="text-xl font-black text-emerald-400 mt-0.5">3 000 ₽ / час</div>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 mt-2">Бережная транспортировка мебели и техники.</p>
        </div>

        <div class="theme-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <i data-lucide="trash-2" class="w-5 h-5"></i>
            </div>
            <h3 class="text-base font-bold text-white mb-1">Вывоз мусора</h3>
            <p class="text-xs text-slate-400 mb-4">Вывоз строительного и бытового мусора с официальной утилизацией на полигоне.</p>
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-2">
              <div class="text-xs text-slate-400">Стоимость услуги:</div>
              <div class="text-xl font-black text-amber-400 mt-0.5">от 5 000 ₽ / час</div>
            </div>
          </div>
          <p class="text-[10px] text-slate-400 mt-2">* Точную стоимость рассчитает диспетчер.</p>
        </div>

      </div>
    </section>

    <!-- 3. ОНЛАЙН КАЛЬКУЛЯТОР (Нижний Тагил / Трасса) -->
    <section id="calculator" class="max-w-4xl mx-auto px-4 sm:px-6">
      <div class="theme-card p-6 sm:p-10 rounded-3xl shadow-2xl space-y-6">
        <div class="text-center space-y-1">
          <div class="text-brand-400 text-xs font-bold uppercase">Быстрый расчет</div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Калькулятор стоимости рейса</h2>
        </div>

        <div class="grid md:grid-cols-12 gap-6 items-center">
          <div class="md:col-span-7 space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-2">Формат рейса:</label>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <button type="button" onclick="setMode('city')" id="btn-city" class="p-3 rounded-xl border border-brand-500 bg-brand-500/10 text-white font-bold">По городу (1500 ₽/ч)</button>
                <button type="button" onclick="setMode('intercity')" id="btn-intercity" class="p-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-300">Межгород (за км)</button>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between text-xs font-bold text-slate-200">
                <span id="slider-label">Время (часов):</span>
                <span id="slider-val" class="text-brand-400 font-mono">2 часа</span>
              </div>
              <input type="range" id="calc-range" min="1" max="10" value="2" class="w-full h-2 bg-slate-800 rounded-lg accent-brand-500 cursor-pointer" oninput="calcPrice()">
            </div>
          </div>

          <div class="md:col-span-5 p-5 rounded-2xl bg-slate-900/95 border border-brand-500/40 text-center space-y-3">
            <div class="text-xs text-slate-400">Предварительная сумма:</div>
            <div class="text-3xl font-black text-white font-mono" id="calc-result">3 000 ₽</div>
            <a href="#contact" class="block w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white text-xs font-bold shadow-md">
              Оформить заявку
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. РЕКВИЗИТЫ И КОНТАКТЫ (Екатеринбург — Финиш) -->
    <section id="contact" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="theme-card p-6 sm:p-10 rounded-3xl grid md:grid-cols-2 gap-8 items-center">
        <div class="space-y-4">
          <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">ФИНИШ МАРШРУТА • ЕКАТЕРИНБУРГ</span>
          <h2 class="text-2xl sm:text-4xl font-extrabold text-white">Прямая связь с перевозчиком</h2>
          <p class="text-slate-300 text-sm leading-relaxed">
            ИП Нигамедьянов Александр Сергеевич (ИНН 660704814106, ОГРНИП 321665800053976). Звоните в любое время:
          </p>
          <a href="tel:+79630501501" class="inline-flex items-center gap-3 text-2xl font-black text-brand-400 hover:underline">
            <i data-lucide="phone-call" class="w-6 h-6"></i>
            <span>8 (963) 050-15-01</span>
          </a>
        </div>

        <div class="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs">
          <div class="text-brand-400 font-bold uppercase tracking-wider">Юридические реквизиты:</div>
          <div class="flex justify-between py-1 border-b border-slate-800"><span class="text-slate-400">ИНН:</span><span class="font-mono font-bold text-white">660704814106</span></div>
          <div class="flex justify-between py-1 border-b border-slate-800"><span class="text-slate-400">ОГРНИП:</span><span class="font-mono font-bold text-white">321665800053976</span></div>
          <div class="flex justify-between py-1 border-b border-slate-800"><span class="text-slate-400">ЭДО:</span><span class="font-bold text-emerald-400">Диадок / СБИС</span></div>
          <div class="flex justify-between py-1"><span class="text-slate-400">Рейтинг ATI.SU:</span><span class="font-bold text-emerald-400">5.0 (Код: 2811269)</span></div>
        </div>
      </div>
    </section>

  </main>

  <!-- ========================================================================= -->
  <!-- ⚙️ SCROLL ANIMATION CONTROLLER JS -->
  <!-- ========================================================================= -->
  <script>
    lucide.createIcons();

    // Map Route Path and Marker references
    const highwayProgress = document.getElementById('highway-progress');
    const truckMarker = document.getElementById('truck-marker');
    const hudPercent = document.getElementById('hud-percent');
    const hudDistance = document.getElementById('hud-distance-text');
    const hudStatus = document.getElementById('hud-status-text');

    const totalPathLength = highwayProgress.getTotalLength();
    
    // Set up dasharray for progress line
    highwayProgress.style.strokeDasharray = totalPathLength;
    highwayProgress.style.strokeDashoffset = totalPathLength;

    function updateTruckOnScroll() {
      const scrollY = window.scrollY || window.pageYOffset;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      
      // Calculate progress from 0.0 to 1.0
      let progress = 0;
      if (maxScroll > 0) {
        progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      }

      // 1. Update glowing route progress length
      const currentLength = progress * totalPathLength;
      highwayProgress.style.strokeDashoffset = totalPathLength - currentLength;

      // 2. Position truck on curve
      const pt = highwayProgress.getPointAtLength(currentLength);
      
      // Calculate angle for smooth truck rotation
      const nextLength = Math.min(currentLength + 2, totalPathLength);
      const nextPt = highwayProgress.getPointAtLength(nextLength);
      const angle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x) * (180 / Math.PI);

      truckMarker.setAttribute('transform', `translate(${pt.x}, ${pt.y}) rotate(${angle})`);

      // 3. Update HUD Tracker
      const percentVal = Math.round(progress * 100);
      const kmVal = Math.round(progress * 180);
      hudPercent.innerText = `${percentVal}%`;
      hudDistance.innerText = `Пройдено: ${kmVal} км / 180 км`;

      if (progress < 0.25) {
        hudStatus.innerText = 'Верхняя Салда (Старт)';
      } else if (progress < 0.60) {
        hudStatus.innerText = 'Нижний Тагил (40 км)';
      } else if (progress < 0.85) {
        hudStatus.innerText = 'Невьянск (105 км)';
      } else {
        hudStatus.innerText = 'Екатеринбург (Финиш)';
      }
    }

    window.addEventListener('scroll', updateTruckOnScroll, { passive: true });
    window.addEventListener('resize', updateTruckOnScroll, { passive: true });
    updateTruckOnScroll();

    // Mini Calculator
    let mode = 'city';
    function setMode(m) {
      mode = m;
      const btnC = document.getElementById('btn-city');
      const btnI = document.getElementById('btn-intercity');
      const range = document.getElementById('calc-range');
      const label = document.getElementById('slider-label');
      
      if (m === 'city') {
        btnC.className = 'p-3 rounded-xl border border-brand-500 bg-brand-500/10 text-white font-bold';
        btnI.className = 'p-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-300';
        label.innerText = 'Время (часов):';
        range.min = 1; range.max = 10; range.value = 2;
      } else {
        btnI.className = 'p-3 rounded-xl border border-brand-500 bg-brand-500/10 text-white font-bold';
        btnC.className = 'p-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-300';
        label.innerText = 'Расстояние (км):';
        range.min = 20; range.max = 500; range.value = 180;
      }
      calcPrice();
    }

    function calcPrice() {
      const val = parseInt(document.getElementById('calc-range').value, 10);
      const valDisplay = document.getElementById('slider-val');
      const res = document.getElementById('calc-result');
      
      if (mode === 'city') {
        valDisplay.innerText = `${val} час(а/ов)`;
        res.innerText = `${(val * 1500).toLocaleString('ru-RU')} ₽`;
      } else {
        valDisplay.innerText = `${val} км`;
        res.innerText = `${(2500 + val * 45).toLocaleString('ru-RU')} ₽`;
      }
    }
  </script>
</body>
</html>"""

target_file = r"C:\Сайт ИП Нигамедьянов А.С\map_scroll_demo.html"
with open(target_file, "w", encoding="utf-8") as f:
    f.write(html_code)

print("SUCCESS: map_scroll_demo.html created at", target_file)

