import re
import os

def create_theme_1(base_html):
    html = base_html
    
    # 1. HTML tag
    html = html.replace('<html lang="ru" class="dark scroll-smooth overflow-x-hidden">', '<html lang="ru" class="scroll-smooth overflow-x-hidden">')
    
    # 2. Fix image paths so they work in both local file:// and web server
    html = html.replace('src="/tarify_dostavka_', 'src="tarify_dostavka_')
    
    # 3. Custom CSS in style block
    theme_1_css = """
    /* ================= СВЕТЛАЯ ТЕМА 1: СКАНДИНАВСКИЙ СИНИЙ (NORDIC BLUE) ================= */
    :root {
      color-scheme: light;
    }
    body {
      background-color: #f8fafc !important;
      color: #1e293b !important;
    }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #2563eb; }

    /* Базовые карточки-блоки с мягкими тенями */
    .theme-card {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03) !important;
      color: #1e293b !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .theme-card-hover:hover {
      border-color: #3b82f6 !important;
      transform: translateY(-3px) !important;
      box-shadow: 0 20px 35px -8px rgba(37, 99, 235, 0.14), 0 8px 16px -4px rgba(15, 23, 42, 0.04) !important;
      background: #ffffff !important;
    }

    /* Заголовки и тексты */
    h1, h2, h3, h4, .text-white {
      color: #0f172a !important;
    }
    .text-slate-300, .text-slate-200 {
      color: #475569 !important;
    }
    .text-slate-400 {
      color: #64748b !important;
    }

    /* Секции */
    section {
      background-color: #f8fafc !important;
    }
    section:nth-of-type(even) {
      background-color: #ffffff !important;
    }
    .bg-dark-950, .bg-dark-900 {
      background-color: transparent !important;
    }
    .bg-slate-900, .bg-dark-800 {
      background-color: #ffffff !important;
      color: #0f172a !important;
    }
    .bg-slate-900\\/80, .bg-slate-800\\/80, .bg-slate-800\\/60, .bg-slate-900\\/70 {
      background-color: #ffffff !important;
      border-color: #e2e8f0 !important;
      color: #0f172a !important;
    }

    /* Рамки */
    .border-slate-800, .border-slate-700 {
      border-color: #e2e8f0 !important;
    }

    /* Хедер */
    header {
      background: rgba(255, 255, 255, 0.96) !important;
      border-bottom: 1px solid #e2e8f0 !important;
      box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05) !important;
    }
    header a.text-slate-300, header a.text-slate-200 {
      color: #334155 !important;
    }
    header a.text-slate-300:hover, header a.text-slate-200:hover {
      color: #2563eb !important;
      background-color: #eff6ff !important;
    }

    /* Плашки доверия под главным оффером */
    #hero .grid.grid-cols-2 > div, #hero .grid.grid-cols-4 > div, #hero .bg-slate-800 {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important;
      color: #0f172a !important;
    }
    #hero .bg-slate-800 * {
      color: #0f172a !important;
    }
    #hero .bg-slate-800 .text-slate-400 {
      color: #64748b !important;
    }

    /* Калькулятор: кнопки выбора направлений и категорий */
    #calculator button, #dest-grid button, #dest-grid-town button {
      background-color: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #0f172a !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
    }
    #calculator button:hover, #dest-grid button:hover, #dest-grid-town button:hover {
      border-color: #3b82f6 !important;
      background-color: #eff6ff !important;
    }
    #calculator .border-brand-500, #dest-grid .border-brand-500, #dest-grid-town .border-brand-500 {
      background-color: #eff6ff !important;
      border-color: #2563eb !important;
      color: #1d4ed8 !important;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12) !important;
    }
    #calculator .border-brand-500 span, #calculator .border-brand-500 div {
      color: #1d4ed8 !important;
    }
    #calculator .bg-slate-900, #calculator .bg-dark-900, #calculator .bg-slate-800 {
      background-color: #ffffff !important;
      border-color: #e2e8f0 !important;
      color: #0f172a !important;
    }
    #calculator .text-slate-400, #calculator .text-slate-300 {
      color: #475569 !important;
    }

    /* Чекбоксы опций (Срочно, Растентовка) */
    label.cursor-pointer, .grid label {
      background-color: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #0f172a !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03) !important;
    }
    label.cursor-pointer:hover, .grid label:hover {
      border-color: #3b82f6 !important;
      background-color: #eff6ff !important;
    }
    label.cursor-pointer span.text-white {
      color: #0f172a !important;
    }

    /* Плашка радиуса грузчиков */
    .bg-emerald-500\\/10 {
      background-color: #ecfdf5 !important;
      border-color: #a7f3d0 !important;
      color: #065f46 !important;
    }
    .bg-emerald-500\\/10 * {
      color: #065f46 !important;
    }

    /* Кнопки переключения грузчиков 0,1,2,3... */
    #calculator button[onclick*="setLoaders"], #calculator button[onclick*="setUnloaders"] {
      background-color: #f1f5f9 !important;
      border: 1px solid #cbd5e1 !important;
      color: #0f172a !important;
    }

    /* Итоговая карточка расчета (Контрастный сине-графитовый блок) */
    .md\\:col-span-5.bg-gradient-to-b {
      background: linear-gradient(150deg, #0f172a, #1e293b) !important;
      border: 2px solid #3b82f6 !important;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.3) !important;
      color: #f8fafc !important;
    }
    .md\\:col-span-5.bg-gradient-to-b h3, .md\\:col-span-5.bg-gradient-to-b .text-white {
      color: #ffffff !important;
    }
    .md\\:col-span-5.bg-gradient-to-b #calc-total-price {
      color: #ffffff !important;
    }
    .md\\:col-span-5.bg-gradient-to-b #calc-total-price + span {
      color: #fbbf24 !important;
    }
    .md\\:col-span-5.bg-gradient-to-b .text-slate-400, .md\\:col-span-5.bg-gradient-to-b .text-slate-300 {
      color: #94a3b8 !important;
    }
    .md\\:col-span-5.bg-gradient-to-b .text-brand-400, .md\\:col-span-5.bg-gradient-to-b b.text-brand-400 {
      color: #fbbf24 !important;
    }
    .md\\:col-span-5.bg-gradient-to-b button {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
      color: #0f172a !important;
      font-weight: 900 !important;
    }

    /* Инпуты формы заявки */
    input, select, textarea {
      background-color: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #0f172a !important;
    }
    input:focus, select:focus, textarea:focus {
      background-color: #ffffff !important;
      border-color: #2563eb !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
    }

    /* Блок ввода номера телефона в форме */
    .phone-box, .digit-box, [id*="digit"], #phone-container, .phone-grid {
      background-color: #ffffff !important;
      border: 1.5px solid #cbd5e1 !important;
      color: #0f172a !important;
    }
    #form-phone-raw {
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1.5px solid #cbd5e1 !important;
    }

    /* Реквизиты: нижние плашки (ЭДО, Безнал, АТИ) */
    #requisites .grid.grid-cols-3 > div, #requisites .bg-slate-900, #requisites .bg-dark-900 {
      background: #ffffff !important;
      border: 1.5px solid #e2e8f0 !important;
      color: #0f172a !important;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03) !important;
    }
    #requisites .grid.grid-cols-3 > div * {
      color: #0f172a !important;
    }
    #requisites .grid.grid-cols-3 > div .text-slate-400 {
      color: #64748b !important;
    }

    /* Мобильное меню (Drawer) */
    #mobile-drawer {
      background: rgba(255, 255, 255, 0.98) !important;
      color: #0f172a !important;
    }
    #mobile-drawer a, #mobile-drawer button {
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      color: #0f172a !important;
    }
    #mobile-drawer .text-white {
      color: #0f172a !important;
    }
    """
    
    html = html.replace('</style>', theme_1_css + '\n  </style>')
    
    # Top switcher banner
    switcher = """
  <!-- 🎨 ПЕРЕКЛЮЧАТЕЛЬ ДИЗАЙНОВ ДЛЯ ОЦЕНКИ -->
  <div class="sticky top-0 z-50 bg-slate-900 text-white px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between text-xs border-b border-slate-800 shadow-xl">
    <div class="flex items-center gap-2">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
      <span class="font-black text-amber-400 uppercase tracking-wide">ДИЗАЙН 1 (СВЕТЛЫЙ):</span>
      <span class="text-slate-200 font-semibold">Скандинавский / Евро-Логистика (Nordic Blue)</span>
    </div>
    <div class="flex items-center gap-2 mt-2 sm:mt-0 font-bold">
      <a href="/index.html" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">🌙 Текущий тёмный</a>
      <a href="/light-design-1.html" class="px-3 py-1 rounded-lg bg-blue-600 text-white border border-blue-400 shadow transition">💎 Вариант 1 (Nordic)</a>
      <a href="/light-design-2.html" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">🔥 Вариант 2 (Cargo)</a>
    </div>
  </div>
    """
    html = html.replace('<header class="fixed top-0', switcher + '\n  <header class="fixed top-0')
    html = html.replace('class="fixed top-0 left-0 right-0 z-40', 'class="sticky top-0 left-0 right-0 z-40')
    html = html.replace('<main class="w-full pt-14 sm:pt-20">', '<main class="w-full pt-2 sm:pt-4">')
    
    return html

def create_theme_2(base_html):
    html = base_html
    
    # 1. HTML tag
    html = html.replace('<html lang="ru" class="dark scroll-smooth overflow-x-hidden">', '<html lang="ru" class="scroll-smooth overflow-x-hidden">')
    
    # 2. Fix image paths so they work in both local file:// and web server
    html = html.replace('src="/tarify_dostavka_', 'src="tarify_dostavka_')
    
    # 3. Custom CSS in style block
    theme_2_css = """
    /* ================= СВЕТЛАЯ ТЕМА 2: ТЕПЛЫЙ ИНДУСТРИАЛЬНЫЙ КАРГО (WARM CARGO & AMBER) ================= */
    :root {
      color-scheme: light;
    }
    body {
      background-color: #fafaf9 !important;
      color: #1c1917 !important;
    }
    ::-webkit-scrollbar-track { background: #f5f5f4; }
    ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #ea580c; }

    /* Базовые карточки-блоки с теплыми тенями */
    .theme-card {
      background: #ffffff !important;
      border: 1px solid #e7e5e4 !important;
      box-shadow: 0 8px 24px -4px rgba(234, 88, 12, 0.07), 0 2px 8px -1px rgba(28, 25, 23, 0.03) !important;
      color: #1c1917 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .theme-card-hover:hover {
      border-color: #ea580c !important;
      transform: translateY(-3px) !important;
      box-shadow: 0 20px 35px -8px rgba(234, 88, 12, 0.18), 0 8px 16px -4px rgba(28, 25, 23, 0.05) !important;
      background: #ffffff !important;
    }

    /* Заголовки и тексты */
    h1, h2, h3, h4, .text-white {
      color: #1c1917 !important;
    }
    .text-slate-300, .text-slate-200 {
      color: #44403c !important;
    }
    .text-slate-400 {
      color: #78716c !important;
    }

    /* Секции */
    section {
      background-color: #fafaf9 !important;
    }
    section:nth-of-type(even) {
      background-color: #ffffff !important;
    }
    .bg-dark-950, .bg-dark-900 {
      background-color: transparent !important;
    }
    .bg-slate-900, .bg-dark-800 {
      background-color: #ffffff !important;
      color: #1c1917 !important;
    }
    .bg-slate-900\\/80, .bg-slate-800\\/80, .bg-slate-800\\/60, .bg-slate-900\\/70 {
      background-color: #ffffff !important;
      border-color: #e7e5e4 !important;
      color: #1c1917 !important;
    }

    /* Рамки */
    .border-slate-800, .border-slate-700 {
      border-color: #e7e5e4 !important;
    }

    /* Хедер */
    header {
      background: rgba(250, 250, 249, 0.96) !important;
      border-bottom: 1.5px solid #e7e5e4 !important;
      box-shadow: 0 4px 20px -4px rgba(28, 25, 23, 0.05) !important;
    }
    header a.text-slate-300, header a.text-slate-200 {
      color: #44403c !important;
    }
    header a.text-slate-300:hover, header a.text-slate-200:hover {
      color: #ea580c !important;
      background-color: #fff7ed !important;
    }

    /* Плашки доверия под главным оффером */
    #hero .grid.grid-cols-2 > div, #hero .grid.grid-cols-4 > div, #hero .bg-slate-800 {
      background: #ffffff !important;
      border: 1px solid #e7e5e4 !important;
      box-shadow: 0 2px 8px rgba(234, 88, 12, 0.05) !important;
      color: #1c1917 !important;
    }
    #hero .bg-slate-800 * {
      color: #1c1917 !important;
    }
    #hero .bg-slate-800 .text-slate-400 {
      color: #78716c !important;
    }

    /* Калькулятор: кнопки выбора направлений и категорий */
    #calculator button, #dest-grid button, #dest-grid-town button {
      background-color: #ffffff !important;
      border: 1.5px solid #d6d3d1 !important;
      color: #1c1917 !important;
      box-shadow: 0 1px 3px rgba(28, 25, 23, 0.03) !important;
    }
    #calculator button:hover, #dest-grid button:hover, #dest-grid-town button:hover {
      border-color: #ea580c !important;
      background-color: #fff7ed !important;
    }
    #calculator .border-brand-500, #dest-grid .border-brand-500, #dest-grid-town .border-brand-500 {
      background-color: #fff7ed !important;
      border-color: #ea580c !important;
      color: #c2410c !important;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.15) !important;
    }
    #calculator .border-brand-500 span, #calculator .border-brand-500 div {
      color: #c2410c !important;
    }
    #calculator .bg-slate-900, #calculator .bg-dark-900, #calculator .bg-slate-800 {
      background-color: #ffffff !important;
      border-color: #e7e5e4 !important;
      color: #1c1917 !important;
    }
    #calculator .text-slate-400, #calculator .text-slate-300 {
      color: #57534e !important;
    }

    /* Чекбоксы опций (Срочно, Растентовка) */
    label.cursor-pointer, .grid label {
      background-color: #ffffff !important;
      border: 1.5px solid #d6d3d1 !important;
      color: #1c1917 !important;
      box-shadow: 0 1px 3px rgba(28, 25, 23, 0.03) !important;
    }
    label.cursor-pointer:hover, .grid label:hover {
      border-color: #ea580c !important;
      background-color: #fff7ed !important;
    }
    label.cursor-pointer span.text-white {
      color: #1c1917 !important;
    }

    /* Плашка радиуса грузчиков */
    .bg-emerald-500\\/10 {
      background-color: #f0fdf4 !important;
      border-color: #bbf7d0 !important;
      color: #166534 !important;
    }
    .bg-emerald-500\\/10 * {
      color: #166534 !important;
    }

    /* Кнопки переключения грузчиков 0,1,2,3... */
    #calculator button[onclick*="setLoaders"], #calculator button[onclick*="setUnloaders"] {
      background-color: #f5f5f4 !important;
      border: 1px solid #d6d3d1 !important;
      color: #1c1917 !important;
    }

    /* Итоговая карточка расчета (Теплый белый карго-блок с оранжевой рамкой) */
    .md\\:col-span-5.bg-gradient-to-b {
      background: #ffffff !important;
      border: 2.5px solid #ea580c !important;
      box-shadow: 0 15px 35px -5px rgba(234, 88, 12, 0.16) !important;
      color: #1c1917 !important;
    }
    .md\\:col-span-5.bg-gradient-to-b h3, .md\\:col-span-5.bg-gradient-to-b .text-white {
      color: #1c1917 !important;
    }
    .md\\:col-span-5.bg-gradient-to-b #calc-total-price {
      color: #ea580c !important;
    }
    .md\\:col-span-5.bg-gradient-to-b #calc-total-price + span {
      color: #ea580c !important;
    }
    .md\\:col-span-5.bg-gradient-to-b .text-slate-400, .md\\:col-span-5.bg-gradient-to-b .text-slate-300 {
      color: #57534e !important;
    }
    .md\\:col-span-5.bg-gradient-to-b .text-brand-400, .md\\:col-span-5.bg-gradient-to-b b.text-brand-400 {
      color: #ea580c !important;
    }
    .md\\:col-span-5.bg-gradient-to-b button {
      background: linear-gradient(135deg, #ea580c, #f97316) !important;
      color: #ffffff !important;
      font-weight: 900 !important;
      box-shadow: 0 10px 25px -4px rgba(234, 88, 12, 0.35) !important;
    }

    /* Основные кнопки действий */
    .bg-gradient-to-r.from-brand-600 {
      background: linear-gradient(135deg, #ea580c, #f97316) !important;
      color: #ffffff !important;
    }

    /* Инпуты формы заявки */
    input, select, textarea {
      background-color: #ffffff !important;
      border: 1.5px solid #d6d3d1 !important;
      color: #1c1917 !important;
    }
    input:focus, select:focus, textarea:focus {
      background-color: #ffffff !important;
      border-color: #ea580c !important;
      box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15) !important;
    }

    /* Блок ввода номера телефона в форме */
    .phone-box, .digit-box, [id*="digit"], #phone-container, .phone-grid {
      background-color: #ffffff !important;
      border: 1.5px solid #d6d3d1 !important;
      color: #1c1917 !important;
    }
    #form-phone-raw {
      background: #ffffff !important;
      color: #1c1917 !important;
      border: 1.5px solid #d6d3d1 !important;
    }

    /* Реквизиты: нижние плашки (ЭДО, Безнал, АТИ) */
    #requisites .grid.grid-cols-3 > div, #requisites .bg-slate-900, #requisites .bg-dark-900 {
      background: #ffffff !important;
      border: 1.5px solid #e7e5e4 !important;
      color: #1c1917 !important;
      box-shadow: 0 2px 6px rgba(28, 25, 23, 0.03) !important;
    }
    #requisites .grid.grid-cols-3 > div * {
      color: #1c1917 !important;
    }
    #requisites .grid.grid-cols-3 > div .text-slate-400 {
      color: #78716c !important;
    }

    /* Мобильное меню (Drawer) */
    #mobile-drawer {
      background: rgba(250, 250, 249, 0.98) !important;
      color: #1c1917 !important;
    }
    #mobile-drawer a, #mobile-drawer button {
      background: #ffffff !important;
      border: 1px solid #e7e5e4 !important;
      color: #1c1917 !important;
    }
    #mobile-drawer .text-white {
      color: #1c1917 !important;
    }
    """
    
    html = html.replace('</style>', theme_2_css + '\n  </style>')
    
    # Top switcher banner
    switcher = """
  <!-- 🎨 ПЕРЕКЛЮЧАТЕЛЬ ДИЗАЙНОВ ДЛЯ ОЦЕНКИ -->
  <div class="sticky top-0 z-50 bg-stone-900 text-white px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between text-xs border-b border-stone-800 shadow-xl">
    <div class="flex items-center gap-2">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></span>
      <span class="font-black text-amber-400 uppercase tracking-wide">ДИЗАЙН 2 (СВЕТЛЫЙ):</span>
      <span class="text-stone-200 font-semibold">Тёплый Индустриальный Карго (Warm Cargo & Amber)</span>
    </div>
    <div class="flex items-center gap-2 mt-2 sm:mt-0 font-bold">
      <a href="/index.html" class="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition">🌙 Текущий тёмный</a>
      <a href="/light-design-1.html" class="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition">💎 Вариант 1 (Nordic)</a>
      <a href="/light-design-2.html" class="px-3 py-1 rounded-lg bg-orange-600 text-white border border-orange-400 shadow transition">🔥 Вариант 2 (Cargo)</a>
    </div>
  </div>
    """
    html = html.replace('<header class="fixed top-0', switcher + '\n  <header class="fixed top-0')
    html = html.replace('class="fixed top-0 left-0 right-0 z-40', 'class="sticky top-0 left-0 right-0 z-40')
    html = html.replace('<main class="w-full pt-14 sm:pt-20">', '<main class="w-full pt-2 sm:pt-4">')
    
    return html

def main():
    with open('apps/web/public/index.html', encoding='utf-8') as f:
        base_html = f.read()
        
    t1 = create_theme_1(base_html)
    with open('apps/web/public/light-design-1.html', 'w', encoding='utf-8') as f:
        f.write(t1)
    print(f'Generated apps/web/public/light-design-1.html ({len(t1)} bytes)')
    
    t2 = create_theme_2(base_html)
    with open('apps/web/public/light-design-2.html', 'w', encoding='utf-8') as f:
        f.write(t2)
    print(f'Generated apps/web/public/light-design-2.html ({len(t2)} bytes)')

if __name__ == '__main__':
    main()
