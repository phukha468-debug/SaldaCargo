import os

html_code = """<!DOCTYPE html>
<html lang="ru" class="dark scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Витрина решений: 4 вида графики и 3 концепта дизайна | ИП Нигамедьянов А.С.</title>
  
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
              950: '#070a11', 900: '#0b0f19', 850: '#0f172a',
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
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #0b0f19; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #d97706; }
    .glass-card {
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s ease;
    }
    .glass-card:hover {
      border-color: rgba(245, 158, 11, 0.4);
      transform: translateY(-2px);
    }
  </style>
</head>
<body class="bg-dark-900 text-slate-200 antialiased selection:bg-brand-600 selection:text-white min-h-screen pb-20">

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-800 border border-brand-500/50 text-white shadow-2xl backdrop-blur-md">
    <i data-lucide="check-circle-2" class="w-5 h-5 text-brand-500 flex-shrink-0"></i>
    <span id="toast-message" class="text-sm font-medium">Выбор зафиксирован!</span>
  </div>

  <!-- Top Sticky Navigation Bar -->
  <header class="sticky top-0 z-50 bg-dark-950/95 backdrop-blur-xl border-b border-slate-800 py-3.5 px-4 sm:px-8">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-amber-700 p-0.5 shadow-md flex-shrink-0 overflow-hidden">
          <img src="logo.jpg" alt="Logo" class="w-full h-full object-cover rounded-[10px]" onerror="this.src='truck-next-winter.jpg'" />
        </div>
        <div>
          <div class="text-sm font-bold text-white flex items-center gap-2">
            <span>Витрина решений • ancargo66.ru</span>
            <span class="px-2 py-0.5 text-[10px] font-extrabold bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-full">ПРЕВЬЮ</span>
          </div>
          <p class="text-xs text-slate-400">ИП Нигамедьянов А.С. | Грузоперевозки Верхняя Салда</p>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs font-semibold">
        <button onclick="switchTab('graphics')" id="tab-btn-graphics" class="px-4 py-2 rounded-xl bg-brand-500 text-black font-bold shadow transition flex items-center gap-1.5">
          <i data-lucide="layout-grid" class="w-4 h-4"></i>
          <span>4 Вида Графики</span>
        </button>
        <button onclick="switchTab('design1')" id="tab-btn-design1" class="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition flex items-center gap-1.5">
          <i data-lucide="shield" class="w-4 h-4 text-amber-400"></i>
          <span>1. B2B Industrial</span>
        </button>
        <button onclick="switchTab('design2')" id="tab-btn-design2" class="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition flex items-center gap-1.5">
          <i data-lucide="zap" class="w-4 h-4 text-blue-400"></i>
          <span>2. Speed Express</span>
        </button>
        <button onclick="switchTab('design3')" id="tab-btn-design3" class="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-4 h-4 text-emerald-400"></i>
          <span>3. Nordic Clean</span>
        </button>
      </div>

    </div>
  </header>

  <!-- ========================================================================= -->
  <!-- TAB 1: 4 ВИДА РЕКОМЕНДОВАННОЙ ГРАФИКИ -->
  <!-- ========================================================================= -->
  <main id="view-graphics" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

    <!-- Header Banner -->
    <div class="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-brand-950/80 via-dark-800 to-slate-900 border border-brand-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div class="space-y-2">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider">
          <i data-lucide="sparkles" class="w-4 h-4"></i> Готовые модули удержания внимания
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white">4 Графических блока для сайта ancargo66.ru</h1>
        <p class="text-slate-300 text-sm max-w-2xl">
          Ознакомьтесь с каждым блоком, оцените интерактив и выберите, какие из них мы сразу добавим на основной рабочий сайт.
        </p>
      </div>
      <a href="index.html" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-2 flex-shrink-0">
        <i data-lucide="arrow-left" class="w-4 h-4"></i>
        <span>Открыть текущий сайт</span>
      </a>
    </div>

    <!-- ==================== ГРАФИКА #1: ИНТЕРАКТИВНАЯ КАРТА НАПРАВЛЕНИЙ ==================== -->
    <section class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-400">Графика #1</span>
          <h2 class="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Интерактивная карта направлений и радиуса подачи
          </h2>
        </div>
        <button onclick="voteOption('Графика #1: Карта направлений')" class="px-4 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-black border border-brand-500/30 text-xs font-bold transition flex items-center gap-1.5">
          <i data-lucide="thumbs-up" class="w-4 h-4"></i>
          <span>Выбрать эту графику</span>
        </button>
      </div>

      <div class="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <p class="text-sm text-slate-300">
          Наглядно показывает заказчикам ключевые плечи перевозок, километраж, время в пути и ориентир по стоимости от Верхней Салды:
        </p>

        <!-- Route Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div class="p-5 rounded-2xl bg-slate-900/90 border border-brand-500/40 relative overflow-hidden group">
            <div class="flex items-center justify-between mb-3">
              <span class="px-2.5 py-0.5 rounded-md bg-brand-500/20 text-brand-400 text-xs font-mono font-bold">40 км • 45 мин</span>
              <i data-lucide="navigation" class="w-4 h-4 text-brand-400"></i>
            </div>
            <h4 class="text-base font-bold text-white">Нижний Тагил</h4>
            <div class="text-xs text-slate-400 mt-1">Верхняя Салда ➔ Н. Тагил</div>
            <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-end">
              <div><span class="text-[10px] text-slate-400 block">ГАЗель:</span><span class="text-base font-extrabold text-white font-mono">от 3 500 ₽</span></div>
              <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><i data-lucide="zap" class="w-3 h-3"></i> Экспресс</span>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 group hover:border-brand-500/40 transition">
            <div class="flex items-center justify-between mb-3">
              <span class="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-mono font-bold">180 км • 2.5 ч</span>
              <i data-lucide="navigation" class="w-4 h-4 text-blue-400"></i>
            </div>
            <h4 class="text-base font-bold text-white">Екатеринбург</h4>
            <div class="text-xs text-slate-400 mt-1">Верхняя Салда ➔ Екатеринбург</div>
            <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-end">
              <div><span class="text-[10px] text-slate-400 block">ГАЗель:</span><span class="text-base font-extrabold text-white font-mono">от 10 500 ₽</span></div>
              <span class="text-[11px] font-bold text-slate-400">Ежедневно</span>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 group hover:border-brand-500/40 transition">
            <div class="flex items-center justify-between mb-3">
              <span class="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">390 км • 5.5 ч</span>
              <i data-lucide="navigation" class="w-4 h-4 text-emerald-400"></i>
            </div>
            <h4 class="text-base font-bold text-white">Челябинск</h4>
            <div class="text-xs text-slate-400 mt-1">Верхняя Салда ➔ Челябинск</div>
            <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-end">
              <div><span class="text-[10px] text-slate-400 block">ГАЗель:</span><span class="text-base font-extrabold text-white font-mono">от 19 000 ₽</span></div>
              <span class="text-[11px] font-bold text-slate-400">Прямой рейс</span>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 group hover:border-brand-500/40 transition">
            <div class="flex items-center justify-between mb-3">
              <span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-xs font-mono font-bold">510 км • 7 ч</span>
              <i data-lucide="navigation" class="w-4 h-4 text-amber-400"></i>
            </div>
            <h4 class="text-base font-bold text-white">Тюмень / Пермь</h4>
            <div class="text-xs text-slate-400 mt-1">Вся территория УрФО и РФ</div>
            <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-end">
              <div><span class="text-[10px] text-slate-400 block">По тарифу:</span><span class="text-base font-extrabold text-white font-mono">от 45 ₽/км</span></div>
              <span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><i data-lucide="shield-check" class="w-3 h-3"></i> Договор</span>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ==================== ГРАФИКА #2: СХЕМЫ ПОГРУЗКИ ==================== -->
    <section class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-400">Графика #2</span>
          <h2 class="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Схемы погрузки и варианты кузова (Инфографика)
          </h2>
        </div>
        <button onclick="voteOption('Графика #2: Схемы погрузки')" class="px-4 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-black border border-brand-500/30 text-xs font-bold transition flex items-center gap-1.5">
          <i data-lucide="thumbs-up" class="w-4 h-4"></i>
          <span>Выбрать эту графику</span>
        </button>
      </div>

      <div class="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <p class="text-sm text-slate-300">
          Снимает любые сомнения у строителей, складов и предприятий: клиент сразу видит, как именно загрузят его негабаритный груз, трубы, станки или паллеты.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-3 text-center border border-slate-800/80">
              <i data-lucide="arrow-down" class="w-7 h-7 text-brand-400 mb-1"></i>
              <span class="text-xs font-black text-white uppercase">Верхняя погрузка</span>
              <span class="text-[10px] text-amber-300/80">Краном / Кран-балкой</span>
            </div>
            <h4 class="text-sm font-bold text-white">Полная растентовка верха</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Быстрый сдвиг крыши для вертикальной загрузки станков, металлопроката, арматуры и 6-метрового профиля.
            </p>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-3 text-center border border-slate-800/80">
              <i data-lucide="arrow-right-left" class="w-7 h-7 text-blue-400 mb-1"></i>
              <span class="text-xs font-black text-white uppercase">Боковая погрузка</span>
              <span class="text-[10px] text-blue-300/80">Погрузчиком с рампы</span>
            </div>
            <h4 class="text-sm font-bold text-white">Боковой доступ со снятием стоек</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Удобно для погрузчиков при загрузке до 12 европаллет без лишней ручной перегрузки.
            </p>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-3 text-center border border-slate-800/80">
              <i data-lucide="door-closed" class="w-7 h-7 text-emerald-400 mb-1"></i>
              <span class="text-xs font-black text-white uppercase">Задняя загрузка</span>
              <span class="text-[10px] text-emerald-300/80">Распашные ворота / Клапан</span>
            </div>
            <h4 class="text-sm font-bold text-white">Стандарт под пандус и грузчиков</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Широкий проем, чистый сухой пол кузова, идеальная чистота для мебели и бытовой техники.
            </p>
          </div>

          <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div class="h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-3 text-center border border-slate-800/80">
              <i data-lucide="link" class="w-7 h-7 text-amber-400 mb-1"></i>
              <span class="text-xs font-black text-white uppercase">Стяжные ремни</span>
              <span class="text-[10px] text-amber-300/80">Кольца и крепеж в кузове</span>
            </div>
            <h4 class="text-sm font-bold text-white">100% Фиксация груза в пути</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Каждый автомобиль укомплектован усиленными стяжными ремнями. Груз защищен от смещения.
            </p>
          </div>

        </div>
      </div>
    </section>

    <!-- ==================== ГРАФИКА #3: БЕЙДЖИ ДОВЕРИЯ ==================== -->
    <section class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-400">Графика #3</span>
          <h2 class="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Визуальные шильдики доверия и юридических гарантий
          </h2>
        </div>
        <button onclick="voteOption('Графика #3: Бейджи доверия')" class="px-4 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-black border border-brand-500/30 text-xs font-bold transition flex items-center gap-1.5">
          <i data-lucide="thumbs-up" class="w-4 h-4"></i>
          <span>Выбрать эту графику</span>
        </button>
      </div>

      <div class="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          
          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <i data-lucide="shield-check" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">0% срывов</span>
            <span class="text-[10px] text-slate-400">Личный гараж</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <i data-lucide="file-check-2" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">ЭДО Диадок/СБИС</span>
            <span class="text-[10px] text-slate-400">Акты за 1 минуту</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <i data-lucide="credit-card" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">НДС / Без НДС</span>
            <span class="text-[10px] text-slate-400">Безналичный расчет</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">От 5 минут</span>
            <span class="text-[10px] text-slate-400">Подача по Салде</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <i data-lucide="star" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">ATI 5.0 ⭐</span>
            <span class="text-[10px] text-slate-400">Код 2811269</span>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <i data-lucide="truck" class="w-5 h-5"></i>
            </div>
            <span class="text-xs font-bold text-white">11 машин</span>
            <span class="text-[10px] text-slate-400">1.5 – 5.0 тонн</span>
          </div>

        </div>
      </div>
    </section>

    <!-- ==================== ГРАФИКА #4: ЖИВОЙ ВИДЖЕТ СТАТУСА ==================== -->
    <section class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-400">Графика #4</span>
          <h2 class="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Живой радар статуса автопарка (Real-Time Availability)
          </h2>
        </div>
        <button onclick="voteOption('Графика #4: Живой радар')" class="px-4 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-black border border-brand-500/30 text-xs font-bold transition flex items-center gap-1.5">
          <i data-lucide="thumbs-up" class="w-4 h-4"></i>
          <span>Выбрать эту графику</span>
        </button>
      </div>

      <div class="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div class="p-6 rounded-2xl bg-slate-900/90 border-2 border-emerald-500/40 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div class="flex items-center gap-4">
            <div class="relative w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <i data-lucide="radio" class="w-7 h-7 animate-pulse"></i>
              <span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-base font-extrabold text-white">Верхняя Салда: 1 машина свободна</span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">ONLINE</span>
              </div>
              <p class="text-xs text-slate-300 mt-1">
                ГАЗель NEXT (тент, 2.0 т) готова к выезду. Время прибытия на ваш адрес: <strong class="text-brand-400">от 5 до 10 минут</strong>.
              </p>
            </div>
          </div>

          <a href="tel:+79630501501" class="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-900/40 flex items-center gap-2 flex-shrink-0 whitespace-nowrap active:scale-95">
            <i data-lucide="phone-call" class="w-4 h-4"></i>
            <span>Подать эту машину сейчас</span>
          </a>
        </div>
      </div>
    </section>

  </main>

  <!-- ========================================================================= -->
  <!-- TAB 2: ДИЗАЙН 1 — B2B INDUSTRIAL LOGISTICS -->
  <!-- ========================================================================= -->
  <main id="view-design1" class="hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
    <div class="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <span class="text-xs font-mono font-bold text-amber-400 uppercase">Концепт #1</span>
        <h2 class="text-2xl font-black text-white">«B2B Industrial & Heavy Cargo»</h2>
        <p class="text-xs text-slate-400 mt-1">Фокус на работу с предприятиями, заводами (ВСМПО-АВИСМА), стройбазами, складами, НДС и ЭДО.</p>
      </div>
      <button onclick="voteOption('Концепт 1: B2B Industrial')" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition shadow-lg shadow-amber-900/40 flex items-center gap-2">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Выбрать Концепт 1 для внедрения</span>
      </button>
    </div>

    <div class="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 space-y-10 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div class="space-y-1">
          <div class="text-xs font-mono text-amber-400">ИП НИГАМЕДЬЯНОВ А.С. | СВЕРДЛОВСКАЯ ОБЛАСТЬ</div>
          <h3 class="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">Грузовые перевозки коммерческих партий</h3>
        </div>
        <div class="text-right hidden sm:block">
          <div class="text-xs text-slate-400 font-mono">РЕЙТИНГ ATI.SU</div>
          <div class="text-2xl font-mono font-black text-emerald-400">5.0 ★★★★★</div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <div class="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div class="text-amber-400 text-sm font-bold font-mono">[ 01. ТЕХНИКА ]</div>
          <h4 class="text-lg font-bold text-white">11 Единиц в парке (1.5 - 5.0 тонн)</h4>
          <p class="text-xs text-slate-400 leading-relaxed">ГАЗель NEXT, удлиненный ГАЗ «Валдай» (36 м³), Mitsubishi Fuso Canter. Все типы растентовок.</p>
        </div>
        <div class="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div class="text-amber-400 text-sm font-bold font-mono">[ 02. ДОКУМЕНТООБОРОТ ]</div>
          <h4 class="text-lg font-bold text-white">НДС / Без НДС • ЭДО Диадок / СБИС</h4>
          <p class="text-xs text-slate-400 leading-relaxed">Моментальное выставление счетов, реестры поездок, подписание договоров через защищенный ЭДО.</p>
        </div>
        <div class="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div class="text-amber-400 text-sm font-bold font-mono">[ 03. НАДЕЖНОСТЬ ]</div>
          <h4 class="text-lg font-bold text-white">Собственная ремонтная база</h4>
          <p class="text-xs text-slate-400 leading-relaxed">Предрейсовый технический осмотр каждого авто. Исключены поломки и задержки груза на трассе.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================= -->
  <!-- TAB 3: ДИЗАЙН 2 — SPEED & EXPRESS -->
  <!-- ========================================================================= -->
  <main id="view-design2" class="hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
    <div class="p-6 rounded-3xl bg-slate-900 border border-blue-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <span class="text-xs font-mono font-bold text-blue-400 uppercase">Концепт #2</span>
        <h2 class="text-2xl font-black text-white">«Speed & Express (Мгновенная подача)»</h2>
        <p class="text-xs text-slate-400 mt-1">Фокус на скорость: подача от 5 минут по Салде, быстрый квиз-расчет в первом экране, WhatsApp/MAX.</p>
      </div>
      <button onclick="voteOption('Концепт 2: Speed Express')" class="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition shadow-lg shadow-blue-900/40 flex items-center gap-2">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Выбрать Концепт 2 для внедрения</span>
      </button>
    </div>

    <div class="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-dark-900 to-dark-950 p-6 sm:p-10 space-y-8 shadow-2xl">
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30">
        ⚡ Подача ГАЗели по Верхней Салде — от 5 минут
      </div>
      <div class="grid lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-7 space-y-4">
          <h3 class="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            Грузоперевозки <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-amber-400">без ожидания и переплат</span>
          </h3>
          <p class="text-slate-300 text-sm leading-relaxed">
            Почасовая от 1500 ₽/час • Быстрый рейс 20 мин от 1000 ₽ • Грузчики 3000 ₽/час • Межгород от 45 ₽/км.
          </p>
          <div class="pt-2 flex flex-wrap gap-3">
            <a href="tel:+79630501501" class="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/40 flex items-center gap-2">
              <i data-lucide="phone" class="w-4 h-4"></i>
              <span>Вызвать машину прямо сейчас</span>
            </a>
          </div>
        </div>
        <div class="lg:col-span-5 p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
          <div class="text-xs font-bold text-slate-300 uppercase">Быстрый выбор тарифа:</div>
          <div class="space-y-2 text-xs">
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex justify-between items-center"><span class="text-white font-bold">Быстрый заказ (20 мин)</span><span class="text-blue-400 font-bold">1 000 — 1 500 ₽</span></div>
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex justify-between items-center"><span class="text-white font-bold">Почасовая (без грузчиков)</span><span class="text-brand-400 font-bold">1 500 ₽ / час</span></div>
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex justify-between items-center"><span class="text-white font-bold">С 2 грузчиками (под ключ)</span><span class="text-emerald-400 font-bold">3 000 ₽ / час</span></div>
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex justify-between items-center"><span class="text-white font-bold">Вывоз мусора</span><span class="text-amber-400 font-bold">от 5 000 ₽ / час</span></div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================= -->
  <!-- TAB 4: ДИЗАЙН 3 — NORDIC CLEAN -->
  <!-- ========================================================================= -->
  <main id="view-design3" class="hidden max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
    <div class="p-6 rounded-3xl bg-slate-900 border border-emerald-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <span class="text-xs font-mono font-bold text-emerald-400 uppercase">Концепт #3</span>
        <h2 class="text-2xl font-black text-white">«Nordic Clean (Светлый современный минимализм)»</h2>
        <p class="text-xs text-slate-400 mt-1">Свежий, открытый, эстетичный стиль с мягкими акцентами, ощущением кристальной прозрачности и легкости.</p>
      </div>
      <button onclick="voteOption('Концепт 3: Nordic Clean')" class="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-900/40 flex items-center gap-2">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Выбрать Концепт 3 для внедрения</span>
      </button>
    </div>

    <div class="rounded-3xl border border-slate-700 bg-slate-100 text-slate-900 p-6 sm:p-12 space-y-8 shadow-2xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">АН</div>
          <span class="font-bold text-sm text-slate-800">ИП Нигамедьянов • Верхняя Салда</span>
        </div>
        <span class="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">ATI.SU 5.0 ⭐</span>
      </div>

      <div class="space-y-4 max-w-2xl">
        <h3 class="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Прозрачные перевозки по Верхней Салде и всей России
        </h3>
        <p class="text-slate-600 text-sm leading-relaxed">
          Фиксированные городские тарифы, 11 ухоженных машин, аккуратные водители и официальный договор.
        </p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div class="text-xs text-slate-500">По городу</div>
          <div class="text-lg font-bold text-slate-900 mt-1">1 500 ₽/ч</div>
        </div>
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div class="text-xs text-slate-500">С 2 грузчиками</div>
          <div class="text-lg font-bold text-emerald-700 mt-1">3 000 ₽/ч</div>
        </div>
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div class="text-xs text-slate-500">Экспресс 20 мин</div>
          <div class="text-lg font-bold text-slate-900 mt-1">1 000–1 500 ₽</div>
        </div>
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div class="text-xs text-slate-500">Вывоз мусора</div>
          <div class="text-lg font-bold text-amber-700 mt-1">от 5 000 ₽</div>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800 bg-dark-950 py-10 mt-20">
    <div class="max-w-4xl mx-auto px-4 text-center space-y-4">
      <div class="text-brand-400 font-bold text-xs uppercase tracking-wider">Обратная связь</div>
      <h3 class="text-xl font-bold text-white">Какой вариант дизайна или графики внедрить на сайт ancargo66.ru?</h3>
      <p class="text-slate-400 text-xs max-w-md mx-auto">
        Нажмите на кнопку любого понравившегося блока или напишите в чате — я сразу внедрю выбранный стиль в основной сайт и выгружу на REG.RU!
      </p>
      <div class="pt-2">
        <a href="index.html" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-black font-bold text-xs shadow-lg hover:bg-brand-400 transition">
          <i data-lucide="eye" class="w-4 h-4"></i>
          <span>Открыть текущий рабочий сайт</span>
        </a>
      </div>
    </div>
  </footer>

  <script>
    lucide.createIcons();

    function switchTab(tabId) {
      const views = ['graphics', 'design1', 'design2', 'design3'];
      views.forEach(v => {
        const el = document.getElementById('view-' + v);
        const btn = document.getElementById('tab-btn-' + v);
        if (v === tabId) {
          el.classList.remove('hidden');
          btn.className = 'px-4 py-2 rounded-xl bg-brand-500 text-black font-bold shadow flex items-center gap-1.5';
        } else {
          el.classList.add('hidden');
          btn.className = 'px-3.5 py-2 rounded-xl text-slate-400 hover:text-white transition flex items-center gap-1.5';
        }
      });
      lucide.createIcons();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toast-message').innerText = msg;
      toast.classList.remove('translate-y-20', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        toast.classList.remove('translate-y-0', 'opacity-100');
      }, 3000);
    }

    function voteOption(name) {
      showToast('Выбран: ' + name + '! Напишите мне в чате для внедрения.');
    }
  </script>
</body>
</html>"""

target_path = r"C:\Сайт ИП Нигамедьянов А.С\showcase.html"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(html_code)

print("SUCCESS: showcase.html generated at", target_path)

