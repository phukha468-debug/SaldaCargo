import os

def build():
    parts = []
    
    # --- Part 1: Head, Styles, Header, Drawer ---
    parts.append('''<!DOCTYPE html>
<html lang="ru" class="dark scroll-smooth overflow-x-hidden">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>ИП Нигамедьянов А.С. | Грузоперевозки Верхняя Салда, УрФО, Россия</title>
  <meta name="description" content="Грузоперевозки собственным автопарком (11 единиц: Газель NEXT, Валдай, Mitsubishi Fuso). Подача по Салде от 5 минут. Рейтинг 5.0 на ATI.SU (Код 2811269). Личная ремонтная база, ЭДО, НДС/Без НДС." />

  <!-- Tailwind CSS CDN -->
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
              950: '#06090e', 900: '#0b0f19', 850: '#0f172a',
              800: '#111827', 750: '#161f30', 700: '#1e293b', 600: '#334155'
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
          }
        }
      }
    }
  </script>
  <script src="https://unpkg.com/lucide@latest"></script>

  <style>
    html, body {
      overflow-x: hidden !important;
      width: 100% !important;
      max-width: 100vw !important;
      touch-action: pan-y;
      -webkit-overflow-scrolling: touch;
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #06090e; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #d97706; }
    .theme-card {
      background: rgba(17, 24, 39, 0.90);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .theme-card-hover:hover {
      border-color: rgba(217, 119, 6, 0.5);
      background: rgba(30, 41, 59, 0.96);
      transform: translateY(-2px);
      box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.6);
    }
    .pb-safe {
      padding-bottom: max(env(safe-area-inset-bottom, 0.5rem), 0.5rem);
    }
  </style>
</head>
<body class="bg-dark-900 text-slate-200 antialiased selection:bg-brand-600 selection:text-white relative overflow-x-hidden pb-20 lg:pb-0 w-full">

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 transform translate-y-24 opacity-0 transition-all duration-300 pointer-events-none flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-800/95 border border-brand-500/50 text-white shadow-2xl backdrop-blur-md max-w-[90vw]">
    <i data-lucide="check-circle-2" class="w-5 h-5 text-brand-500 flex-shrink-0"></i>
    <span id="toast-message" class="text-xs sm:text-sm font-medium">Реквизиты успешно скопированы!</span>
  </div>

  <!-- Lightbox Modal -->
  <div id="lightbox-modal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md hidden items-center justify-center p-4" onclick="closeLightbox()">
    <div class="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
      <button class="absolute -top-12 right-0 text-white hover:text-brand-400 p-2 text-sm font-bold flex items-center gap-1">
        <i data-lucide="x" class="w-6 h-6"></i> Закрыть
      </button>
      <img id="lightbox-img" src="" alt="Увеличенное фото" class="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-slate-700" onclick="event.stopPropagation()">
      <p id="lightbox-caption" class="text-slate-300 text-sm mt-3 text-center px-4 font-medium"></p>
    </div>
  </div>

  <!-- ==================== 🍔 ВСПЛЫВАЮЩЕЕ МОБИЛЬНОЕ МЕНЮ (БУТЕРБРОД) ==================== -->
  <div id="mobile-drawer" class="fixed inset-0 z-50 bg-dark-950/98 backdrop-blur-2xl hidden flex-col justify-between p-5 sm:p-7 overflow-y-auto transition-all duration-300">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl overflow-hidden p-0.5 bg-gradient-to-br from-brand-400 to-amber-700 flex-shrink-0">
          <img src="logo.jpg" alt="Logo" class="w-full h-full object-cover rounded-[10px]" />
        </div>
        <div>
          <div class="font-bold text-sm text-white">ИП Нигамедьянов А.С.</div>
          <div class="text-[11px] text-emerald-400 font-semibold">ATI.SU 5.0 ⭐ (Код: 2811269)</div>
        </div>
      </div>
      <button id="close-drawer-btn" class="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 active:scale-95 transition" aria-label="Закрыть меню">
        <span class="text-lg font-bold">✕</span>
      </button>
    </div>

    <div class="py-5 space-y-2">
      <div class="text-[11px] font-bold text-brand-400 uppercase tracking-wider px-3 mb-2">Основные разделы</div>
      
      <a href="#tariffs" class="drawer-link flex items-center justify-between p-3.5 rounded-2xl bg-brand-500/10 text-white font-bold border border-brand-500/30 active:bg-brand-500/20 transition">
        <span class="flex items-center gap-3">🏷️ 1. Городские тарифы (Салда)</span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-brand-400"></i>
      </a>

      <a href="#calculator" class="drawer-link flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 text-white font-bold border border-slate-800 active:bg-slate-800 transition">
        <span class="flex items-center gap-3">🧮 2. Калькулятор стоимости</span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
      </a>

      <a href="#requisites" class="drawer-link flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 text-white font-bold border border-slate-800 active:bg-slate-800 transition">
        <span class="flex items-center gap-3">📋 3. Реквизиты ИП</span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
      </a>

      <a href="#contact" class="drawer-link flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 text-white font-bold border border-slate-800 active:bg-slate-800 transition">
        <span class="flex items-center gap-3">✉️ 4. Форма связи и заказ</span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
      </a>

      <div class="pt-3">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Разделы (доступны через меню)</div>
        
        <button type="button" onclick="openMobileSection('gallery')" class="w-full drawer-link flex items-center justify-between p-3 rounded-xl bg-slate-900/60 text-slate-200 text-sm font-semibold border border-slate-800/80 mb-1.5 active:bg-slate-800 transition text-left">
          <span class="flex items-center gap-3">🖼️ Фотогалерея автопарка</span>
          <span class="text-xs text-brand-400 font-bold">Открыть →</span>
        </button>

        <button type="button" onclick="openMobileSection('fleet')" class="w-full drawer-link flex items-center justify-between p-3 rounded-xl bg-slate-900/60 text-slate-200 text-sm font-semibold border border-slate-800/80 mb-1.5 active:bg-slate-800 transition text-left">
          <span class="flex items-center gap-3">🚛 Автопарк (11 машин: 1.5 - 5т)</span>
          <span class="text-xs text-brand-400 font-bold">Открыть →</span>
        </button>

        <button type="button" onclick="openMobileSection('rating')" class="w-full drawer-link flex items-center justify-between p-3 rounded-xl bg-slate-900/60 text-slate-200 text-sm font-semibold border border-slate-800/80 active:bg-slate-800 transition text-left">
          <span class="flex items-center gap-3">⭐ Биржа ATI.SU (Рейтинг 5.0)</span>
          <span class="text-xs text-emerald-400 font-bold">Открыть →</span>
        </button>
      </div>
    </div>

    <div class="pt-3 border-t border-slate-800 space-y-2.5">
      <a href="tel:+79630501501" class="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-95 transition">
        <i data-lucide="phone-call" class="w-4 h-4"></i>
        <span>Позвонить: 8 (963) 050-15-01</span>
      </a>
      <a href="https://max.ru/:share?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%98%D0%BD%D1%82%D0%B5%D1%80%D0%B5%D1%81%D1%83%D1%8E%D1%82%20%D0%B3%D1%80%D1%83%D0%B7%D0%BE%D0%BF%D0%B5%D1%80%D0%B5%D0%B2%D0%BE%D0%B7%D0%BA%D0%B8" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition">
        <i data-lucide="message-square" class="w-4 h-4"></i>
        <span>Написать в мессенджер МАКС</span>
      </a>
    </div>
  </div>

  <!-- ==================== 📌 ЗАФИКСИРОВАННЫЙ ХЕДЕР ==================== -->
  <header class="sticky top-0 z-40 bg-dark-950/95 backdrop-blur-xl border-b border-slate-800 w-full transition-colors">
    <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 sm:h-20 gap-2">
        
        <!-- Logo & Title -->
        <a href="#" class="flex items-center gap-2 sm:gap-3.5 group flex-shrink-0 select-none">
          <div class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden p-0.5 bg-gradient-to-br from-brand-400 to-amber-700 shadow-md flex-shrink-0">
            <img src="logo.jpg" alt="Логотип" class="w-full h-full object-cover rounded-[10px] fallback-img" />
          </div>
          <div>
            <div class="font-bold text-sm sm:text-base lg:text-lg text-white leading-tight flex items-center gap-1 sm:gap-2">
              <span class="whitespace-nowrap">ИП Нигамедьянов А.С.</span>
              <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30 whitespace-nowrap">5.0 ⭐</span>
            </div>
            <div class="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
              <i data-lucide="map-pin" class="w-3 h-3 text-brand-500 flex-shrink-0"></i>
              <span>г. Верхняя Салда</span>
            </div>
          </div>
        </a>

        <!-- Desktop Nav -->
        <nav class="hidden xl:flex items-center gap-6 text-sm font-semibold text-slate-300">
          <a href="#tariffs" class="text-brand-400 hover:text-brand-300 transition-colors whitespace-nowrap">Тарифы</a>
          <a href="#calculator" class="hover:text-brand-400 transition-colors whitespace-nowrap">Калькулятор</a>
          <a href="#requisites" class="hover:text-brand-400 transition-colors whitespace-nowrap">Реквизиты</a>
          <a href="#contact" class="hover:text-brand-400 transition-colors whitespace-nowrap">Контакты</a>
          <a href="#gallery" class="hover:text-brand-400 transition-colors whitespace-nowrap">Автопарк</a>
          <a href="#rating" class="hover:text-brand-400 transition-colors whitespace-nowrap">ATI.SU 5.0</a>
        </nav>

        <!-- Right Side Actions -->
        <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          
          <!-- Phone (Desktop) -->
          <a href="tel:+79630501501" class="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs xl:text-sm font-bold text-slate-100 hover:text-brand-400 hover:border-brand-500/50 transition whitespace-nowrap flex-shrink-0">
            <div class="w-6 h-6 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center flex-shrink-0">
              <i data-lucide="phone" class="w-3.5 h-3.5"></i>
            </div>
            <span class="font-mono">8 (963) 050-15-01</span>
          </a>

          <!-- Phone Icon (Mobile) -->
          <a href="tel:+79630501501" class="md:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 text-brand-400 flex items-center justify-center flex-shrink-0" title="Позвонить">
            <i data-lucide="phone" class="w-4 h-4"></i>
          </a>

          <!-- Order CTA -->
          <a href="#contact" class="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-brand-900/40 transition transform active:scale-95 whitespace-nowrap flex-shrink-0">
            <i data-lucide="send" class="w-3.5 h-3.5 flex-shrink-0"></i>
            <span>Заказать</span>
          </a>

          <!-- 🍔 КНОПКА МЕНЮ БУТЕРБРОД (3 золотые полосы) -->
          <button id="drawer-toggle-btn" class="flex flex-col items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-brand-600/30 border border-slate-700 text-white focus:outline-none flex-shrink-0 gap-1.5 p-2.5 active:scale-95 transition" aria-label="Открыть меню" title="Меню">
            <span class="w-5 h-0.5 bg-brand-400 rounded-full"></span>
            <span class="w-5 h-0.5 bg-brand-400 rounded-full"></span>
            <span class="w-5 h-0.5 bg-brand-400 rounded-full"></span>
          </button>
        </div>

      </div>
    </div>
  </header>

  <main class="w-full">
''')

    # --- Part 2: Hero, Tariffs ---
    parts.append('''
    <!-- ==================== 1. HERO SECTION ==================== -->
    <section class="relative pt-6 pb-10 sm:pt-12 sm:pb-16 overflow-hidden w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          <div class="lg:col-span-7 space-y-5">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-bold shadow-sm">
              <span class="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
              <span>Подача машины по Верхней Салде — от 5 минут!</span>
            </div>

            <h1 class="text-2xl sm:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-snug">
              Грузоперевозки по <span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-amber-300 to-amber-500">Верхней Салде</span>, УрФО и всей России
            </h1>

            <p class="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              11 ухоженных автомобилей (ГАЗель NEXT, Валдай 5т, Fuso). Личная ремонтная база, 0% срывов, договоры с НДС/без НДС и ЭДО.
            </p>

            <div class="flex flex-col sm:flex-row gap-3 pt-1">
              <a href="#tariffs" class="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white font-bold text-sm shadow-xl shadow-brand-900/40 active:scale-95 transition">
                <i data-lucide="tag" class="w-4 h-4"></i>
                <span>Смотреть тарифы</span>
              </a>
              <a href="#calculator" class="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl theme-card text-slate-200 font-semibold text-sm hover:border-brand-500 active:scale-95 transition">
                <i data-lucide="calculator" class="w-4 h-4 text-brand-400"></i>
                <span>Рассчитать стоимость</span>
              </a>
            </div>
          </div>

          <!-- Hero Media -->
          <div class="lg:col-span-5 relative">
            <div class="theme-card p-3 rounded-2xl border border-brand-500/30">
              <div class="relative h-56 sm:h-72 w-full rounded-xl overflow-hidden bg-slate-900 cursor-pointer flex items-center justify-center" onclick="openLightbox('truck-next-winter.jpg', 'ГАЗель NEXT (А051МВ 196) — Подача от 5 минут')">
                <img src="truck-next-winter.jpg" alt="Газель NEXT" class="w-full h-full object-cover fallback-img" />
                <div class="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-brand-500 text-black text-[11px] font-black rounded uppercase shadow">
                  ⚡ 5–10 мин подача
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 mt-2.5 text-center">
                <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-white font-mono">11</span><span class="text-[10px] text-brand-400 font-bold uppercase">Машин</span></div>
                <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-emerald-400 font-mono">5.0 ⭐</span><span class="text-[10px] text-slate-300 font-bold uppercase">ATI.SU</span></div>
                <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800"><span class="block text-base font-bold text-white font-mono">0%</span><span class="text-[10px] text-brand-400 font-bold uppercase">Срывов</span></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ==================== 2. ТАРИФЫ ПО ВЕРХНЕЙ САЛДЕ (№1 в моб. версии) ==================== -->
    <section id="tariffs" class="py-12 bg-dark-800/80 border-t border-slate-800 transition-colors w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="text-center max-w-2xl mx-auto mb-8">
          <div class="inline-flex items-center gap-1.5 px-3 py-0.5 bg-brand-500/10 text-brand-400 text-xs font-bold rounded-md border border-brand-500/20 uppercase tracking-wider mb-2">
            <i data-lucide="tag" class="w-3.5 h-3.5"></i> Фиксированные расценки
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Тарифы на перевозки по Верхней Салде
          </h2>
          <p class="mt-2 text-slate-300 text-xs sm:text-sm">
            Честная почасовая аренда и быстрые рейсы на автомобилях ГАЗель
          </p>
        </div>

        <!-- 4 Tariff Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          <!-- 1. Быстрый заказ -->
          <div class="theme-card theme-card-hover p-5 rounded-2xl flex flex-col justify-between border-slate-800 relative">
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold rounded-full">
              Экспресс 20 мин
            </div>
            <div>
              <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                <i data-lucide="zap" class="w-5 h-5"></i>
              </div>
              <h3 class="text-base font-bold text-white mb-1">Быстрый заказ (до 20 мин)</h3>
              <p class="text-xs text-slate-400 mb-3 leading-relaxed">
                Машина без грузчиков для оперативной доставки одного-двух предметов (диван, бытовая техника, стройматериалы).
              </p>
              <div class="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-2">
                <div class="text-[11px] text-slate-400">Стоимость рейса:</div>
                <div class="text-lg font-extrabold text-blue-400 font-mono mt-0.5">1 000 — 1 500 ₽</div>
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                * Точную сумму озвучит менеджер после уточнения адресов.
              </p>
            </div>
            <button onclick="applyTariffToCalc('quick')" class="mt-4 w-full py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5">
              <span>Выбрать в калькуляторе</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <!-- 2. Без грузчиков 1 час -->
          <div class="theme-card theme-card-hover p-5 rounded-2xl flex flex-col justify-between border-brand-500/40 bg-slate-900/90 relative">
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 bg-brand-500 text-black text-[10px] font-black rounded-full uppercase tracking-wider shadow">
              Хит заказов
            </div>
            <div>
              <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-3">
                <i data-lucide="clock" class="w-5 h-5"></i>
              </div>
              <h3 class="text-base font-bold text-white mb-1">Без грузчиков (1 час)</h3>
              <p class="text-xs text-slate-400 mb-3 leading-relaxed">
                Почасовая аренда автомобиля ГАЗель с водителем по Верхней Салде. Подача от 5 минут.
              </p>
              <div class="py-2.5 px-3 rounded-xl bg-slate-900/90 border border-brand-500/30 mb-2">
                <div class="text-[11px] text-slate-400">Тариф за 1 час:</div>
                <div class="text-xl font-black text-brand-400 font-mono mt-0.5">1 500 ₽ / час</div>
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                Чистый кузов, помощь водителя в фиксации груза ремнями.
              </p>
            </div>
            <button onclick="applyTariffToCalc('hourly_standard')" class="mt-4 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white text-xs font-bold transition shadow-md shadow-brand-900/30 flex items-center justify-center gap-1.5">
              <span>Выбрать в калькуляторе</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <!-- 3. С 2 грузчиками -->
          <div class="theme-card theme-card-hover p-5 rounded-2xl flex flex-col justify-between border-slate-800 relative">
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full">
              Под ключ
            </div>
            <div>
              <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <i data-lucide="users" class="w-5 h-5"></i>
              </div>
              <h3 class="text-base font-bold text-white mb-1">С 2 грузчиками</h3>
              <p class="text-xs text-slate-400 mb-3 leading-relaxed">
                Машина + 2 опытных грузчика. Полный комплекс: спуск, аккуратная погрузка, перевозка и подъем.
              </p>
              <div class="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-2">
                <div class="text-[11px] text-slate-400">Машина + 2 грузчика:</div>
                <div class="text-xl font-black text-emerald-400 font-mono mt-0.5">3 000 ₽ / час</div>
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                Бережное обращение с мебелью, коробками и техникой.
              </p>
            </div>
            <button onclick="applyTariffToCalc('hourly_movers')" class="mt-4 w-full py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5">
              <span>Выбрать в калькуляторе</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <!-- 4. Вывоз мусора -->
          <div class="theme-card theme-card-hover p-5 rounded-2xl flex flex-col justify-between border-slate-800 relative">
            <div class="absolute -top-2.5 right-3 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded-full">
              Утилизация
            </div>
            <div>
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
              </div>
              <h3 class="text-base font-bold text-white mb-1">Вывоз мусора</h3>
              <p class="text-xs text-slate-400 mb-3 leading-relaxed">
                Вывоз строительного мусора, старой мебели и хлама после ремонта с официальной утилизацией на полигоне.
              </p>
              <div class="py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-2">
                <div class="text-[11px] text-slate-400">Стоимость услуги:</div>
                <div class="text-xl font-black text-amber-400 font-mono mt-0.5">от 5 000 ₽ / час</div>
              </div>
              <p class="text-[10px] text-slate-400 leading-tight">
                * Точную сумму рассчитает диспетчер по составу мусора.
              </p>
            </div>
            <button onclick="applyTariffToCalc('trash')" class="mt-4 w-full py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5">
              <span>Выбрать в калькуляторе</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

        </div>

      </div>
    </section>
''')

    # --- Part 3: Calculator, Requisites ---
    parts.append('''
    <!-- ==================== 3. КАЛЬКУЛЯТОР СТОИМОСТИ (№2 в моб. версии) ==================== -->
    <section id="calculator" class="py-14 relative w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="text-center max-w-2xl mx-auto mb-8">
          <div class="text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">Интерактивный расчет</div>
          <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Калькулятор стоимости рейса
          </h2>
          <p class="mt-1 text-slate-400 text-xs sm:text-sm">
            Выберите автомобиль и формат поездки — сумма подставится в заявку
          </p>
        </div>

        <div class="theme-card rounded-3xl p-5 sm:p-8 max-w-4xl mx-auto shadow-xl">
          <div class="grid md:grid-cols-12 gap-6 items-start">
            
            <!-- Controls -->
            <div class="md:col-span-7 space-y-5">
              
              <!-- 1. Vehicle Selection -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  1. Тип автомобиля
                </label>
                <div class="grid grid-cols-2 gap-2.5">
                  <button type="button" id="calc-car-gazelle" onclick="setCarType('gazelle')" class="p-3 rounded-xl border text-left transition border-brand-500 bg-brand-500/10 text-white font-semibold">
                    <div class="text-xs sm:text-sm font-bold">ГАЗель (до 2.0 т)</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">16-22 м³ • Город и РФ</div>
                  </button>
                  <button type="button" id="calc-car-valday" onclick="setCarType('valday')" class="p-3 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700">
                    <div class="text-xs sm:text-sm font-bold">Валдай (до 5.0 т)</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">30-36 м³ • До 12 паллет</div>
                  </button>
                </div>
              </div>

              <!-- 2. Tariff Mode Selection -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  2. Выберите тариф / услугу
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" id="tariff-btn-quick" onclick="setTariffMode('quick')" class="p-2.5 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700">
                    <div class="text-xs font-bold">⚡ Экспресс (20 мин)</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 font-mono">1 000 — 1 500 ₽</div>
                  </button>

                  <button type="button" id="tariff-btn-hourly_standard" onclick="setTariffMode('hourly_standard')" class="p-2.5 rounded-xl border text-left transition border-brand-500 bg-brand-500/10 text-white font-semibold">
                    <div class="text-xs font-bold">⏱️ Без грузчиков</div>
                    <div class="text-[10px] text-brand-400 mt-0.5 font-mono">1 500 ₽ / час</div>
                  </button>

                  <button type="button" id="tariff-btn-hourly_movers" onclick="setTariffMode('hourly_movers')" class="p-2.5 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700">
                    <div class="text-xs font-bold">👥 С 2 грузчиками</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 font-mono">3 000 ₽ / час</div>
                  </button>

                  <button type="button" id="tariff-btn-trash" onclick="setTariffMode('trash')" class="p-2.5 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700">
                    <div class="text-xs font-bold">🗑️ Вывоз мусора</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 font-mono">от 5 000 ₽ / час</div>
                  </button>

                  <button type="button" id="tariff-btn-intercity" onclick="setTariffMode('intercity')" class="p-2.5 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 col-span-2">
                    <div class="text-xs font-bold">🗺️ Межгород (Салда - Тагил - Екб - РФ)</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 font-mono">от 45 ₽ / км</div>
                  </button>
                </div>
              </div>

              <!-- 3. Dynamic Slider -->
              <div id="slider-container" class="space-y-2">
                <div class="flex justify-between items-center text-xs sm:text-sm">
                  <span id="slider-label" class="font-semibold text-slate-200">Время аренды авто:</span>
                  <span id="slider-value-display" class="font-mono font-bold text-brand-400 text-sm sm:text-base">2 часа</span>
                </div>
                <input type="range" id="calc-slider" min="1" max="12" step="1" value="2" class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500" oninput="updateCalculator()">
                <div class="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span id="slider-min-label">1 час</span>
                  <span id="slider-max-label">12 часов</span>
                </div>
              </div>

              <!-- Quick Order Note -->
              <div id="quick-order-note" class="hidden p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-slate-300">
                <div class="font-bold text-blue-400 mb-0.5">⚡ Фиксированный короткий рейс (до 20 мин)</div>
                <p class="text-[11px] text-slate-300">Диапазон 1 000 – 1 500 ₽. Точную сумму назовет менеджер по телефону.</p>
              </div>

              <!-- 4. Options -->
              <div class="space-y-2 pt-1">
                <label class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300">
                  <input type="checkbox" id="opt-uncover" class="w-4 h-4 rounded text-brand-600 bg-slate-800 border-slate-700" onchange="updateCalculator()">
                  <span>Растентовка верха/бока (+1 000 ₽)</span>
                </label>
                <label class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer text-xs text-slate-300">
                  <input type="checkbox" id="opt-urgent" class="w-4 h-4 rounded text-brand-600 bg-slate-800 border-slate-700" onchange="updateCalculator()">
                  <span>Срочная подача день в день (+15%)</span>
                </label>
              </div>

            </div>

            <!-- Result Summary Card -->
            <div class="md:col-span-5 bg-gradient-to-b from-dark-800 to-slate-900 p-5 rounded-2xl border border-brand-500/40 flex flex-col justify-between shadow-inner">
              <div>
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Предварительный расчет:</div>
                <div class="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono flex items-baseline gap-2">
                  <span id="calc-total-price">3 000</span>
                  <span class="text-base text-brand-400 font-sans font-bold">₽</span>
                </div>
                <div id="calc-price-note" class="text-[11px] text-amber-400/90 font-medium">Без скрытых переплат</div>

                <div class="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
                  <div class="flex justify-between"><span class="text-slate-400">Авто:</span><span id="sum-car" class="font-semibold text-slate-200">ГАЗель (до 2.0 т)</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Тариф:</span><span id="sum-type" class="font-semibold text-brand-400">Без грузчиков (1500 ₽/ч)</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Объем/Время:</span><span id="sum-dist" class="font-semibold text-slate-200">2 часа</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">Опции:</span><span id="sum-opts" class="font-semibold text-slate-300">Без доп. опций</span></div>
                </div>
              </div>

              <div class="mt-5 space-y-2.5">
                <button type="button" onclick="applyCalculationToForm()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-600/30 transition transform active:scale-95 flex items-center justify-center gap-2">
                  <i data-lucide="check-square" class="w-4 h-4"></i>
                  <span>Заказать по этому расчету</span>
                </button>
                <div class="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                  <i data-lucide="shield-check" class="w-3 h-3 text-emerald-500"></i>
                  <span>Подача от 5 мин • Работа по договору</span>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </section>

    <!-- ==================== 4. РЕКВИЗИТЫ ИП (№3 в моб. версии) ==================== -->
    <section id="requisites" class="py-14 bg-dark-800/40 border-t border-slate-800 transition-colors w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="text-center max-w-2xl mx-auto mb-8">
          <div class="text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">Юридическая чистота</div>
          <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Карточка предприятия</h2>
          <p class="mt-1 text-slate-400 text-xs sm:text-sm">
            Официальные реквизиты для составления договоров и выставления счетов
          </p>
        </div>

        <div class="max-w-4xl mx-auto theme-card rounded-3xl p-5 sm:p-8 shadow-xl">
          
            <button onclick="copyFullRequisites()" class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold transition active:scale-95 flex-shrink-0">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              <span>Скопировать реквизиты</span>
            </button>
          </div>

          <div class="grid md:grid-cols-2 gap-6 text-xs sm:text-sm">
            <div class="space-y-3">
              <div class="text-xs font-bold uppercase tracking-wider text-brand-400">Общие сведения</div>
              <div class="flex justify-between py-1.5 border-b border-slate-800/80"><span class="text-slate-400">ИНН:</span><span class="font-mono font-semibold text-white">660704814106</span></div>
              <div class="flex justify-between py-1.5 border-b border-slate-800/80"><span class="text-slate-400">ОГРНИП:</span><span class="font-mono font-semibold text-white">321665800053976</span></div>
              <div class="py-1.5 border-b border-slate-800/80">
                <span class="text-slate-400 block mb-0.5">Адрес:</span>
                <span class="font-medium text-white">624760, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, 11-22</span>
              </div>
              <div class="flex justify-between py-1.5"><span class="text-slate-400">Email:</span><a href="mailto:uralavto707@mail.ru" class="text-brand-400 font-semibold hover:underline">uralavto707@mail.ru</a></div>
            </div>

            <div class="space-y-3">
              <div class="text-xs font-bold uppercase tracking-wider text-brand-400">Банковские данные</div>
              <div class="py-1.5 border-b border-slate-800/80"><span class="text-slate-400 block mb-0.5">Банк:</span><span class="font-semibold text-white">АО «ТБанк»</span></div>
              <div class="py-1.5 border-b border-slate-800/80"><span class="text-slate-400 block mb-0.5">Р/счет:</span><span class="font-mono font-semibold text-white">40802810500001961654</span></div>
              <div class="flex justify-between py-1.5 border-b border-slate-800/80"><span class="text-slate-400">БИК:</span><span class="font-mono font-semibold text-white">044525974</span></div>
              <div class="py-1.5"><span class="text-slate-400 block mb-0.5">Корр. счет:</span><span class="font-mono font-semibold text-white">30101810145250000974</span></div>
            </div>
          </div>

        </div>

      </div>
    </section>

    <!-- ==================== 5. ДЕСКТОПНЫЕ РАЗДЕЛЫ (Свернуты на моб., в меню) ==================== -->
    
    <!-- ГАЛЕРЕЯ (hidden on mobile, visible on lg) -->
    <section id="gallery" class="hidden lg:block py-12 lg:py-16 bg-dark-800/60 border-t border-slate-800 w-full transition-all">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <!-- Mobile Section Return Header -->
        <div class="lg:hidden flex items-center justify-between p-3 mb-6 rounded-2xl bg-slate-900 border border-brand-500/30 shadow-md">
          <span class="text-xs font-bold text-brand-400">🖼️ Фотогалерея автопарка</span>
          <button type="button" onclick="closeMobileSection('gallery')" class="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:text-white border border-slate-700 active:scale-95 transition">✕ Скрыть раздел</button>
        </div>

        <div class="flex flex-col lg:flex-row lg:items-end justify-between mb-8 lg:mb-10 gap-3">
          <div>
            <div class="text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">Реальные фотографии автопарка</div>
            <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Техника на объектах и маршрутах</h2>
          </div>
          <p class="text-slate-400 text-xs max-w-md">Собственный автопарк: регулярный технический осмотр, чистые кузова и 100% готовность к выезду.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div class="theme-card theme-card-hover rounded-2xl overflow-hidden cursor-pointer" onclick="openLightbox('truck-next-winter.jpg', 'ГАЗель NEXT на зимней трассе')">
            <div class="h-48 bg-slate-800"><img src="truck-next-winter.jpg" alt="Газель NEXT" class="w-full h-full object-cover fallback-img" /></div>
            <div class="p-3.5"><h4 class="text-xs font-bold text-white">ГАЗель NEXT (до 2.0 т)</h4><p class="text-[11px] text-slate-400">По городу и РФ</p></div>
          </div>
          <div class="theme-card theme-card-hover rounded-2xl overflow-hidden cursor-pointer" onclick="openLightbox('truck-valday-side.jpg', 'ГАЗ Валдай (до 5 тонн)')">
            <div class="h-48 bg-slate-800"><img src="truck-valday-side.jpg" alt="Валдай" class="w-full h-full object-cover fallback-img" /></div>
            <div class="p-3.5"><h4 class="text-xs font-bold text-white">ГАЗ «Валдай» (до 5.0 т)</h4><p class="text-[11px] text-slate-400">Объем до 36 м³</p></div>
          </div>
          <div class="theme-card theme-card-hover rounded-2xl overflow-hidden cursor-pointer" onclick="openLightbox('truck-next-warehouse.jpg', 'Погрузка на складе')">
            <div class="h-48 bg-slate-800"><img src="truck-next-warehouse.jpg" alt="Склад" class="w-full h-full object-cover fallback-img" /></div>
            <div class="p-3.5"><h4 class="text-xs font-bold text-white">Пром. объекты и склады</h4><p class="text-[11px] text-slate-400">Паллеты, оборудование</p></div>
          </div>
          <div class="theme-card theme-card-hover rounded-2xl overflow-hidden cursor-pointer" onclick="openLightbox('truck-tipper-snow.jpg', 'Самосвал / Спецрейсы')">
            <div class="h-48 bg-slate-800"><img src="truck-tipper-snow.jpg" alt="Самосвал" class="w-full h-full object-cover fallback-img" /></div>
            <div class="p-3.5"><h4 class="text-xs font-bold text-white">Борт / Самосвал</h4><p class="text-[11px] text-slate-400">Сыпучие грузы, снег</p></div>
          </div>
        </div>
      </div>
    </section>

    <!-- АВТОПАРК ТЕХ ХАРАКТЕРИСТИКИ (hidden on mobile, visible on lg) -->
    <section id="fleet" class="hidden lg:block py-16 border-t border-slate-800 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-2xl mx-auto mb-10">
          <div class="text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">Технические характеристики</div>
          <h2 class="text-3xl font-bold text-white tracking-tight">Подбор авто под вес и объем</h2>
        </div>

        <div class="grid grid-cols-3 gap-6">
          <div class="theme-card p-6 rounded-2xl space-y-3">
            <span class="px-2.5 py-0.5 bg-brand-500/20 text-brand-400 text-xs font-bold rounded">6 единиц в парке</span>
            <h3 class="text-lg font-bold text-white">ГАЗель NEXT / Самосвалы</h3>
            <p class="text-xs text-slate-300">До 2.0 тонн • 16-22 м³ • Подача от 5 мин</p>
          </div>
          <div class="theme-card p-6 rounded-2xl space-y-3">
            <span class="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs font-bold rounded">4 единицы в парке</span>
            <h3 class="text-lg font-bold text-white">ГАЗ «Валдай» (Удлиненный)</h3>
            <p class="text-xs text-slate-300">До 5.0 тонн • 30-36 м³ • До 12 паллет</p>
          </div>
          <div class="theme-card p-6 rounded-2xl space-y-3">
            <span class="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-bold rounded">1 единица в парке</span>
            <h3 class="text-lg font-bold text-white">Mitsubishi Fuso Canter</h3>
            <p class="text-xs text-slate-300">До 5.0 тонн • 32 м³ • Дальние рейсы по РФ</p>
          </div>
        </div>
      </div>
    </section>

    <!-- РЕЙТИНГ ATI.SU (hidden on mobile, visible on lg) -->
    <section id="rating" class="hidden lg:block py-16 bg-dark-800/40 border-t border-slate-800 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="theme-card rounded-3xl p-8 flex items-center justify-between gap-8">
          <div class="space-y-3 max-w-2xl">
            <span class="px-3 py-1 bg-emerald-500/15 text-emerald-400 text-xs font-bold rounded-full">ATI.SU 5.0 ⭐</span>
            <h2 class="text-3xl font-extrabold text-white">Проверенный перевозчик в системе ATI.SU</h2>
            <p class="text-slate-300 text-sm">Код в реестре: <strong>2 811 269</strong>. Подтверждены паспортные данные руководителя, транспорт в собственности и 0% срывов.</p>
          </div>
          <a href="https://ati.su" target="_blank" rel="noopener noreferrer" class="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap">Открыть в ATI.SU</a>
        </div>
      </div>
    </section>

    <!-- ==================== 6. КОНТАКТЫ И ФОРМА СВЯЗИ (№4 в моб. версии) ==================== -->
    <section id="contact" class="py-14 relative border-t border-slate-800 w-full">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="grid lg:grid-cols-12 gap-8 items-start">
          
          <!-- Contact Info -->
          <div class="lg:col-span-5 space-y-4">
            <div class="text-brand-400 font-semibold text-xs tracking-wider uppercase">Связь с перевозчиком</div>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Заказать транспорт или задать вопрос
            </h2>
            <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Свяжитесь напрямую с руководителем по телефону, через мессенджер МАКС или отправьте заявку.
            </p>

            <div class="space-y-3 pt-1">
              <!-- Direct Phone -->
              <a href="tel:+79630501501" class="flex items-center gap-3 p-3.5 rounded-2xl theme-card theme-card-hover">
                <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center flex-shrink-0">
                  <i data-lucide="phone-call" class="w-5 h-5"></i>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400">Прямой телефон руководителя:</div>
                  <div class="text-base font-bold text-white font-mono whitespace-nowrap">+7 (963) 050-15-01</div>
                </div>
              </a>

              <!-- Direct Email -->
              <a href="mailto:uralavto707@mail.ru" class="flex items-center gap-3 p-3.5 rounded-2xl theme-card theme-card-hover">
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <i data-lucide="mail" class="w-5 h-5"></i>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400">Электронная почта:</div>
                  <div class="text-sm font-bold text-white font-mono">uralavto707@mail.ru</div>
                </div>
              </a>

              <!-- MAX Messenger Button -->
              <a href="https://max.ru/:share?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%98%D0%BD%D1%82%D0%B5%D1%80%D0%B5%D1%81%D1%83%D1%8E%D1%82%20%D0%B3%D1%80%D1%83%D0%B7%D0%BE%D0%BF%D0%B5%D1%80%D0%B5%D0%B2%D0%BE%D0%B7%D0%BA%D0%B8" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-blue-900/30 w-full active:scale-95">
                <i data-lucide="message-square" class="w-4 h-4"></i>
                <span>Написать напрямую в MAX</span>
              </a>
            </div>
          </div>

          <!-- Application Form -->
          <div class="lg:col-span-7">
            <form id="order-form" onsubmit="submitForm(event)" class="theme-card p-5 sm:p-7 rounded-3xl space-y-3.5 shadow-xl">
              <h3 class="text-lg font-bold text-white">Быстрая заявка на рейс</h3>
              <p class="text-xs text-slate-400 mb-2">Укажите маршрут, и мы свяжемся с вами в течение 10 минут</p>

              <div class="grid sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Ваше имя / Организация</label>
                  <input type="text" id="form-name" required placeholder="Иван / ООО 'Компания'" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-xs sm:text-sm focus:border-brand-500 focus:outline-none transition">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Телефон для связи</label>
                  <input type="tel" id="form-phone" required placeholder="+7 (963) 000-00-00" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-xs sm:text-sm focus:border-brand-500 focus:outline-none transition">
                </div>
              </div>

              <div class="grid sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Откуда (Пункт А)</label>
                  <input type="text" id="form-from" required placeholder="г. Верхняя Салда" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-xs sm:text-sm focus:border-brand-500 focus:outline-none transition">
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-300 mb-1">Куда (Пункт Б)</label>
                  <input type="text" id="form-to" required placeholder="г. Екатеринбург / РФ" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-xs sm:text-sm focus:border-brand-500 focus:outline-none transition">
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">Параметры груза и комментарий</label>
                <textarea id="form-comment" rows="2" placeholder="Характер груза, вес, тип растентовки, дата..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-xs sm:text-sm focus:border-brand-500 focus:outline-none transition"></textarea>
              </div>

              <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-600/30 transition transform active:scale-95 flex items-center justify-center gap-2">
                <i data-lucide="send" class="w-4 h-4"></i>
                <span>Отправить заявку перевозчику</span>
              </button>
            </form>
          </div>

        </div>

      </div>
    </section>

  </main>

  <!-- ==================== 📱 МОБИЛЬНАЯ НИЖНЯЯ ПАНЕЛЬ ==================== -->
  <div class="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-dark-950/95 backdrop-blur-xl border-t border-slate-800 p-2 pb-safe flex items-center justify-around gap-1.5 shadow-2xl">
    <a href="tel:+79630501501" class="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl bg-slate-800 border border-slate-700 text-brand-400 active:scale-95 transition">
      <i data-lucide="phone-call" class="w-4 h-4 mb-0.5"></i>
      <span class="text-[10px] font-bold">Звонок</span>
    </a>
    <a href="#tariffs" class="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 active:scale-95 transition">
      <i data-lucide="tag" class="w-4 h-4 mb-0.5 text-brand-400"></i>
      <span class="text-[10px] font-bold">Тарифы</span>
    </a>
    <a href="#calculator" class="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white active:scale-95 transition shadow-md">
      <i data-lucide="calculator" class="w-4 h-4 mb-0.5"></i>
      <span class="text-[10px] font-bold">Расчет</span>
    </a>
    <a href="#contact" class="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl bg-blue-600 text-white active:scale-95 transition shadow-md">
      <i data-lucide="send" class="w-4 h-4 mb-0.5"></i>
      <span class="text-[10px] font-bold">Заявка</span>
    </a>
  </div>

  <!-- ==================== FOOTER ==================== -->
  <footer class="bg-dark-950 text-slate-400 py-8 text-xs border-t border-slate-800 w-full">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
      <div>
        <div class="font-bold text-white">ИП Нигамедьянов Александр Сергеевич</div>
        <div class="text-[11px] text-slate-500 mt-0.5">ИНН 660704814106 • ОГРНИП 321665800053976 • Верхняя Салда</div>
      </div>
      <div class="text-[11px] text-slate-400">
        © 2026 ancargo66.ru. Все права защищены.
      </div>
    </div>
  </footer>

  <!-- ==================== JAVASCRIPT ==================== -->
  <script>
    lucide.createIcons();

    // 1. Mobile Drawer Toggle
    const drawerToggleBtn = document.getElementById('drawer-toggle-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerLinks = document.querySelectorAll('.drawer-link');

    function openDrawer() {
      mobileDrawer.classList.remove('hidden');
      mobileDrawer.classList.add('flex');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
    }

    function closeDrawer() {
      mobileDrawer.classList.add('hidden');
      mobileDrawer.classList.remove('flex');
      document.body.style.overflow = '';
    }

    function openMobileSection(sectionId) {
      closeDrawer();
      const sec = document.getElementById(sectionId);
      if (sec) {
        sec.classList.remove('hidden');
        setTimeout(() => {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }

    function closeMobileSection(sectionId) {
      const sec = document.getElementById(sectionId);
      if (sec) {
        sec.classList.add('hidden');
        document.getElementById('tariffs').scrollIntoView({ behavior: 'smooth' });
      }
    }

    if (drawerToggleBtn) drawerToggleBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    drawerLinks.forEach(link => {
      if (link.tagName === 'A') {
        link.addEventListener('click', closeDrawer);
      }
    });

    // 2. Fallback Images
    document.querySelectorAll('.fallback-img').forEach(img => {
      let candidateList = [];
      if (img.dataset.altSrcs) {
        candidateList = img.dataset.altSrcs.split(',').map(s => s.trim());
      }
      img.addEventListener('error', function tryNext() {
        if (candidateList.length > 0) {
          const nextSrc = candidateList.shift();
          this.src = nextSrc;
        } else {
          this.onerror = null;
        }
      });
    });

    // 3. Lightbox Modal
    function openLightbox(src, caption) {
      const modal = document.getElementById('lightbox-modal');
      const img = document.getElementById('lightbox-img');
      const cap = document.getElementById('lightbox-caption');
      img.src = src;
      cap.innerText = caption || '';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const modal = document.getElementById('lightbox-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }

    // 4. Toast Notification
    function showToast(message) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toast-message');
      toastMsg.innerText = message;
      toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
      toast.classList.add('translate-y-0', 'opacity-100');

      setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        toast.classList.remove('translate-y-0', 'opacity-100');
      }, 3200);
    }

    // 5. Copy Requisites
    function copyFullRequisites() {
      const reqText = `ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ НИГАМЕДЬЯНОВ АЛЕКСАНДР СЕРГЕЕВИЧ
ИНН: 660704814106
ОГРНИП: 321665800053976
Юридический адрес: 624760, Россия, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22
Email: uralavto707@mail.ru
Телефон: +7 (963) 050-15-01
---
Банк: АО «ТБанк»
Р/с: 40802810500001961654
БИК: 044525974
К/с: 30101810145250000974`;

      navigator.clipboard.writeText(reqText).then(() => {
        showToast('Реквизиты скопированы в буфер обмена!');
      }).catch(() => {
        showToast('Реквизиты скопированы!');
      });
    }

    // 6. Interactive Calculator
    let calcState = {
      carType: 'gazelle',
      tariffMode: 'hourly_standard',
      hours: 2,
      distance: 180
    };

    const tariffButtons = {
      'quick': 'tariff-btn-quick',
      'hourly_standard': 'tariff-btn-hourly_standard',
      'hourly_movers': 'tariff-btn-hourly_movers',
      'trash': 'tariff-btn-trash',
      'intercity': 'tariff-btn-intercity'
    };

    function setCarType(type) {
      calcState.carType = type;
      const btnGazelle = document.getElementById('calc-car-gazelle');
      const btnValday = document.getElementById('calc-car-valday');

      if (type === 'gazelle') {
        btnGazelle.className = 'p-3 rounded-xl border text-left transition border-brand-500 bg-brand-500/10 text-white font-semibold';
        btnValday.className = 'p-3 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700';
      } else {
        btnValday.className = 'p-3 rounded-xl border text-left transition border-brand-500 bg-brand-500/10 text-white font-semibold';
        btnGazelle.className = 'p-3 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700';
      }
      updateCalculator();
    }

    function setTariffMode(mode) {
      calcState.tariffMode = mode;
      
      Object.keys(tariffButtons).forEach(key => {
        const btn = document.getElementById(tariffButtons[key]);
        if (btn) {
          if (key === mode) {
            btn.className = 'p-2.5 rounded-xl border text-left transition border-brand-500 bg-brand-500/10 text-white font-semibold' + (key === 'intercity' ? ' col-span-2' : '');
          } else {
            btn.className = 'p-2.5 rounded-xl border text-left transition border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700' + (key === 'intercity' ? ' col-span-2' : '');
          }
        }
      });

      const sliderContainer = document.getElementById('slider-container');
      const quickNote = document.getElementById('quick-order-note');
      const slider = document.getElementById('calc-slider');
      const sliderLabel = document.getElementById('slider-label');
      const minLabel = document.getElementById('slider-min-label');
      const maxLabel = document.getElementById('slider-max-label');

      if (mode === 'quick') {
        sliderContainer.classList.add('hidden');
        quickNote.classList.remove('hidden');
      } else {
        sliderContainer.classList.remove('hidden');
        quickNote.classList.add('hidden');

        if (mode === 'intercity') {
          sliderLabel.innerText = 'Расстояние маршрута (км):';
          slider.min = 20; slider.max = 1000; slider.step = 10; slider.value = calcState.distance;
          minLabel.innerText = '20 км'; maxLabel.innerText = '1 000 км';
        } else {
          sliderLabel.innerText = 'Время аренды авто (часов):';
          slider.min = 1; slider.max = 12; slider.step = 1; slider.value = calcState.hours;
          minLabel.innerText = '1 час'; maxLabel.innerText = '12 часов';
        }
      }

      updateCalculator();
    }

    function applyTariffToCalc(mode) {
      setTariffMode(mode);
      document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
    }

    function updateCalculator() {
      const mode = calcState.tariffMode;
      const isGazelle = calcState.carType === 'gazelle';
      const sliderVal = parseInt(document.getElementById('calc-slider').value, 10);
      const displayVal = document.getElementById('slider-value-display');
      const priceDisplay = document.getElementById('calc-total-price');
      const priceNote = document.getElementById('calc-price-note');
      const optUncover = document.getElementById('opt-uncover').checked;
      const optUrgent = document.getElementById('opt-urgent').checked;

      let total = 0;
      let sumType = '';
      let sumDist = '';
      let displayPrice = '';

      if (mode === 'quick') {
        sumType = 'Быстрый заказ (20 мин)';
        sumDist = '1 рейс (до 20 мин)';
        displayPrice = isGazelle ? '1 000 — 1 500' : '2 000 — 2 500';
        priceNote.innerText = 'Фиксированный короткий рейс';
      } else if (mode === 'hourly_standard') {
        calcState.hours = sliderVal;
        displayVal.innerText = `${sliderVal} ${sliderVal === 1 ? 'час' : (sliderVal < 5 ? 'часа' : 'часов')}`;
        const rate = isGazelle ? 1500 : 2500;
        total = sliderVal * rate;
        sumType = `Без грузчиков (${rate.toLocaleString('ru-RU')} ₽/ч)`;
        sumDist = `${sliderVal} ч`;
        priceNote.innerText = `Почасовая ставка: ${rate} ₽/час`;
      } else if (mode === 'hourly_movers') {
        calcState.hours = sliderVal;
        displayVal.innerText = `${sliderVal} ${sliderVal === 1 ? 'час' : (sliderVal < 5 ? 'часа' : 'часов')}`;
        const rate = isGazelle ? 3000 : 4000;
        total = sliderVal * rate;
        sumType = `С 2 грузчиками (${rate.toLocaleString('ru-RU')} ₽/ч)`;
        sumDist = `${sliderVal} ч (Машина + 2 чел)`;
        priceNote.innerText = 'Включает авто + 2 грузчика';
      } else if (mode === 'trash') {
        calcState.hours = sliderVal;
        displayVal.innerText = `${sliderVal} ${sliderVal === 1 ? 'час' : (sliderVal < 5 ? 'часа' : 'часов')}`;
        const baseRate = isGazelle ? 5000 : 7000;
        total = sliderVal * baseRate;
        sumType = 'Вывоз мусора (с утилизацией)';
        sumDist = `${sliderVal} ч`;
        priceNote.innerText = 'Официальная утилизация на полигоне';
      } else if (mode === 'intercity') {
        calcState.distance = sliderVal;
        displayVal.innerText = `${sliderVal} км`;
        const perKm = isGazelle ? 45 : 70;
        const base = isGazelle ? 2000 : 3500;
        total = base + (sliderVal * perKm);
        sumType = `Межгород (${perKm} ₽/км)`;
        sumDist = `${sliderVal} км`;
        priceNote.innerText = `Тариф: от ${perKm} ₽/км`;
      }

      if (mode !== 'quick' && mode !== 'trash') {
        if (optUncover) total += 1000;
        if (optUrgent) total = total * 1.15;
        displayPrice = Math.round(total).toLocaleString('ru-RU');
      } else if (mode === 'trash') {
        if (optUrgent) total = total * 1.15;
        displayPrice = 'от ' + Math.round(total).toLocaleString('ru-RU');
      }

      priceDisplay.innerText = displayPrice;
      document.getElementById('sum-car').innerText = isGazelle ? 'ГАЗель (до 2.0 т)' : 'Валдай (до 5.0 т)';
      document.getElementById('sum-type').innerText = sumType;
      document.getElementById('sum-dist').innerText = sumDist;

      let opts = [];
      if (optUncover) opts.push('Растентовка (+1000 ₽)');
      if (optUrgent) opts.push('Срочно (+15%)');
      document.getElementById('sum-opts').innerText = opts.length ? opts.join(', ') : 'Без доп. опций';
    }

    function applyCalculationToForm() {
      const isGazelle = calcState.carType === 'gazelle';
      const carName = isGazelle ? 'ГАЗель (до 2.0т)' : 'Валдай (до 5.0т)';
      const tariff = document.getElementById('sum-type').innerText;
      const dist = document.getElementById('sum-dist').innerText;
      const price = document.getElementById('calc-total-price').innerText;

      document.getElementById('form-comment').value = `Расчет с сайта: ${tariff}, ${carName}, ${dist}. Сумма: ~${price} ₽.`;
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('form-name').focus();
      showToast('Параметры рейса добавлены в заявку!');
    }

    // 7. Form Submission
    function submitForm(e) {
      e.preventDefault();
      const name = document.getElementById('form-name').value;
      const phone = document.getElementById('form-phone').value;
      const from = document.getElementById('form-from').value;
      const to = document.getElementById('form-to').value;
      const comment = document.getElementById('form-comment').value;

      const messageText = `Заявка на перевозку (ИП Нигамедьянов):\nКлиент: ${name}\nТелефон: ${phone}\nМаршрут: ${from} -> ${to}\nДетали: ${comment}`;
      const maxUrl = `https://max.ru/:share?text=${encodeURIComponent(messageText)}`;
      
      showToast('Заявка сформирована! Открываем МАКС...');
      setTimeout(() => {
        window.open(maxUrl, '_blank');
        document.getElementById('order-form').reset();
      }, 800);
    }

    // Init
    setTariffMode('hourly_standard');
  </script>
</body>
</html>
''')

    target_path = r"C:\ancargo66\index.html"
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(''.join(parts))
    print("SUCCESS: index.html written successfully!")

if __name__ == '__main__':
    build()
