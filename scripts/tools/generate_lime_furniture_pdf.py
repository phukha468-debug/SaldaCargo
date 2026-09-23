# -*- coding: utf-8 -*-
"""
Генерация официального PDF-прейскуранта и PNG-превью ПРР для мебельного магазина «ЛАЙМ»
ТК501 (ИП Нигамедьянов А.С.)
"""
import os
import fitz
from playwright.sync_api import sync_playwright

pdf_filename = "apps/web/public/tarify_prr_mebel_lime.pdf"
png_filename = "apps/web/public/tarify_prr_mebel_lime.png"

items_data = [
    # (№, Группа, Название, Старая цена, Новая цена, Экономия, Лифт)
    (1, "Кухня", "Кухонный гарнитур — Верхний модуль", "100 ₽", "100 ₽", "Вынос 0 ₽", "В лифт"),
    (2, "Кухня", "Кухонный гарнитур — Нижний модуль", "150 ₽", "120 ₽", "-30 ₽ (-20%)", "В лифт"),
    (3, "Кухня", "Обеденная зона (стол + стулья)", "300 ₽", "250 ₽", "-50 ₽ (-17%)", "В лифт"),
    (4, "Кухня", "Столешница кухонная", "200 ₽", "200 ₽", "Базовая ставка", "Пешком"),
    
    (5, "Шкафы", "Шкаф 2-х дверный в сборе", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "Пешком"),
    (6, "Шкафы", "Шкаф в разборе (комплект)", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "В лифт"),
    (7, "Шкафы", "Комод малый в сборе", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "В лифт"),
    (8, "Шкафы", "Комод большой в сборе", "300 ₽", "250 ₽", "-50 ₽ (-17%)", "Пешком"),
    (9, "Шкафы", "Прихожая в сборе", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "Пешком"),
    (10, "Шкафы", "Стенка большая в разборе", "400 ₽", "400 ₽", "Спец. тариф", "Пешком"),
    
    (11, "Спальня", "Кровать односпальная (серия КР-3)", "200 ₽", "150 ₽", "-50 ₽ (-25%)", "В лифт"),
    (12, "Спальня", "Кровать 2-спальная (КР-16, КР-710, Кр-71)", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "В лифт"),
    (13, "Спальня", "Матрас малый (800–900 мм)", "200 ₽", "150 ₽", "-50 ₽ (-25%)", "В лифт"),
    (14, "Спальня", "Матрас большой (1400–1600 мм)", "300 ₽", "250 ₽", "-50 ₽ (-17%)", "Пешком"),
    
    (15, "Столы", "Тумбы, журнальные столы / стол-книжка", "200 ₽", "150 ₽", "-50 ₽ (-25%)", "В лифт"),
    (16, "Столы", "Стол компьютерный прямой", "250 ₽", "200 ₽", "-50 ₽ (-20%)", "В лифт"),
    (17, "Столы", "Стол компьютерный угловой", "300 ₽", "250 ₽", "-50 ₽ (-17%)", "Пешком"),
    
    (18, "Мягкая", "Кресло-кровать", "250 ₽", "250 ₽", "Базовая ставка", "Пешком"),
    (19, "Мягкая", "Канапе", "400 ₽", "300 ₽", "-100 ₽ (-25%)", "Пешком"),
    (20, "Мягкая", "Диван прямой (стандартный)", "400 ₽", "300 ₽", "-100 ₽ (-25%)", "Пешком"),
    (21, "Мягкая", "Диван угловой", "450 ₽", "400 ₽", "-50 ₽ (-11%)", "Пешком"),
    (22, "Мягкая", "Диван прямой 3-местный (тройной)", "500 ₽", "500 ₽", "Негабарит", "Пешком"),
]

def generate_html():
    half = len(items_data) // 2
    left_items = items_data[:half]
    right_items = items_data[half:]

    def render_table_rows(items):
        html_rows = ""
        for i, it in enumerate(items):
            num, grp, name, old_p, new_p, diff, lift = it
            bg = "#ffffff" if i % 2 == 0 else "#f8fafc"
            lift_badge = f'<span class="badge-lift-in">{lift}</span>' if lift == "В лифт" else f'<span class="badge-lift-out">{lift}</span>'
            diff_color = "#16a34a" if diff.startswith("-") else "#64748b"
            
            html_rows += f"""
            <tr style="background: {bg};">
              <td class="col-num">{num}</td>
              <td class="col-name">{name}</td>
              <td class="col-old">{old_p}</td>
              <td class="col-new">{new_p}</td>
              <td class="col-diff" style="color: {diff_color}; font-weight: 700;">{diff}</td>
              <td class="col-lift">{lift_badge}</td>
            </tr>
            """
        return html_rows

    left_rows_html = render_table_rows(left_items)
    right_rows_html = render_table_rows(right_items)

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Прейскурант ПРР мебели - Магазин «Лайм»</title>
<style>
  @page {{
    size: 297mm 210mm;
    margin: 5mm 8mm 5mm 8mm;
  }}
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    width: 281mm;
    height: 198mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }}

  /* ШАПКА */
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #ea580c;
    padding-bottom: 6px;
    margin-bottom: 6px;
  }}
  .logo-block {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .brand-title {{
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.5px;
    color: #0f172a;
    line-height: 1.1;
  }}
  .brand-title span {{
    color: #ea580c;
  }}
  .brand-sub {{
    font-size: 9.5px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .partner-badge {{
    text-align: right;
    background: #fff7ed;
    border: 1px solid #fdba74;
    border-radius: 8px;
    padding: 6px 12px;
  }}
  .partner-title {{
    font-size: 12.5px;
    font-weight: 900;
    color: #c2410c;
  }}
  .partner-sub {{
    font-size: 9.5px;
    color: #7c2d12;
    font-weight: 600;
  }}

  /* ЗАГОЛОВОК */
  .doc-title-bar {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }}
  .doc-main-title {{
    font-size: 13.5px;
    font-weight: 900;
    text-transform: uppercase;
    color: #0f172a;
    letter-spacing: 0.3px;
  }}
  .doc-desc {{
    font-size: 10px;
    color: #475569;
    font-weight: 500;
  }}

  /* КАРТОЧКИ РЕГЛАМЕНТА ЛИФТОВ */
  .rules-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }}
  .rule-box {{
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 9.5px;
    line-height: 1.25;
  }}
  .rule-box-cargo {{
    background: #ecfdf5;
    border: 1px solid #6ee7b7;
    color: #065f46;
  }}
  .rule-box-pass {{
    background: #eff6ff;
    border: 1px solid #93c5fd;
    color: #1e40af;
  }}
  .rule-box-stairs {{
    background: #faf5ff;
    border: 1px solid #d8b4fe;
    color: #6b21a8;
  }}
  .rule-box b {{
    font-weight: 800;
  }}

  /* ОСНОВНАЯ ТАБЛИЦА (2 КОЛОНКИ СТОРОНА К СТОРОНЕ) */
  .tables-container {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    flex-grow: 1;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }}
  th {{
    background: #0f172a;
    color: #ffffff;
    padding: 4px 6px;
    text-align: left;
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }}
  th.th-center, td.col-num, td.col-old, td.col-new, td.col-diff, td.col-lift {{
    text-align: center;
  }}
  td {{
    padding: 3.5px 6px;
    border-bottom: 1px solid #e2e8f0;
    line-height: 1.2;
  }}
  .col-num {{
    width: 18px;
    font-weight: 800;
    color: #94a3b8;
  }}
  .col-name {{
    font-weight: 600;
    color: #1e293b;
  }}
  .col-old {{
    width: 48px;
    color: #94a3b8;
    text-decoration: line-through;
    font-weight: 500;
  }}
  .col-new {{
    width: 52px;
    font-weight: 900;
    color: #ea580c;
    background: #fff7ed;
    font-size: 10px;
  }}
  .col-diff {{
    width: 76px;
    font-size: 8.5px;
  }}
  .col-lift {{
    width: 56px;
  }}
  .badge-lift-in {{
    display: inline-block;
    padding: 1px 4px;
    border-radius: 4px;
    background: #dcfce7;
    color: #15803d;
    font-weight: 800;
    font-size: 8px;
  }}
  .badge-lift-out {{
    display: inline-block;
    padding: 1px 4px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #64748b;
    font-weight: 700;
    font-size: 8px;
  }}

  /* ПОДВАЛ */
  .footer {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #cbd5e1;
    padding-top: 5px;
    margin-top: 6px;
  }}
  .footer-left {{
    font-size: 9px;
    color: #475569;
    line-height: 1.3;
  }}
  .footer-left b {{
    color: #0f172a;
  }}
  .footer-right {{
    display: flex;
    align-items: center;
    gap: 20px;
  }}
  .sign-block {{
    font-size: 9px;
    color: #334155;
    line-height: 1.25;
  }}
  .sign-line {{
    display: inline-block;
    width: 80px;
    border-bottom: 1px solid #0f172a;
    margin: 0 4px;
  }}
  .stamp-box {{
    width: 48px;
    height: 48px;
    border: 1.5px dashed #0284c7;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    color: #0284c7;
    font-weight: 900;
    text-transform: uppercase;
  }}
</style>
</head>
<body>

  <!-- ШАПКА -->
  <div class="header">
    <div class="logo-block">
      <div>
        <div class="brand-title">ТК<span>501</span> &nbsp;|&nbsp; СЛУЖБА ДОСТАВКИ И ПРР</div>
        <div class="brand-sub">ИП Нигамедьянов А.С. • ИНН 660702652150 • ОГРНИП 324665800043812 • г. Верхняя Салда</div>
      </div>
    </div>
    <div class="partner-badge">
      <div class="partner-title">МАГАЗИН «ЛАЙМ» (МЕБЕЛЬ)</div>
      <div class="partner-sub">г. Верхняя Салда, ул. Энгельса, 87, корп. 1 • Согласованный тариф</div>
    </div>
  </div>

  <!-- ЗАГОЛОВОК ДОКУМЕНТА -->
  <div class="doc-title-bar">
    <div class="doc-main-title">Прейскурант поштучной оплаты подъёма мебели на этаж (ПРР)</div>
    <div class="doc-desc">Утверждено для интеграции в онлайн-калькулятор доставки <b>tk501.ru/calc.html</b></div>
  </div>

  <!-- РЕГЛАМЕНТ ЛИФТОВ -->
  <div class="rules-grid">
    <div class="rule-box rule-box-cargo">
      🛗 <b>Грузовой лифт:</b> Подъём всего заказа считается <b>как за 1 этаж</b> независимо от фактического этажа!
    </div>
    <div class="rule-box rule-box-pass">
      🚪 <b>Пассажирский лифт:</b> Позиции со статусом «В лифт» (до 200 ₽) — как 1 этаж; негабарит/диваны — пешком.
    </div>
    <div class="rule-box rule-box-stairs">
      🚶 <b>Без лифта:</b> Оплата строго по позиции &times; количество &times; номер фактического этажа заноса.
    </div>
  </div>

  <!-- ТАБЛИЦА В ДВЕ КОЛОНКИ ДЛЯ ИДЕАЛЬНОЙ ЧИТАЕМОСТИ -->
  <div class="tables-container">
    <!-- Левая колонка -->
    <table>
      <thead>
        <tr>
          <th class="th-center">№</th>
          <th>Наименование мебели</th>
          <th class="th-center">Старая</th>
          <th class="th-center">Тариф Лайм</th>
          <th class="th-center">Сравнение</th>
          <th class="th-center">Лифт</th>
        </tr>
      </thead>
      <tbody>
        {left_rows_html}
      </tbody>
    </table>

    <!-- Правая колонка -->
    <table>
      <thead>
        <tr>
          <th class="th-center">№</th>
          <th>Наименование мебели</th>
          <th class="th-center">Старая</th>
          <th class="th-center">Тариф Лайм</th>
          <th class="th-center">Сравнение</th>
          <th class="th-center">Лифт</th>
        </tr>
      </thead>
      <tbody>
        {right_rows_html}
      </tbody>
    </table>
  </div>

  <!-- ПОДВАЛ -->
  <div class="footer">
    <div class="footer-left">
      <div>📞 Диспетчерская служба: <b>+7-963-0-501-501</b> &nbsp;•&nbsp; Сайт: <b>tk501.ru</b> / <b>ancargo66.ru</b></div>
      <div style="font-size: 8px; color: #64748b; margin-top: 2px;">* Пронос мебели от машины до подъезда свыше 30 метров оплачивается дополнительно как +1 этаж. Вывоз старой мебели: +1 000 ₽.</div>
    </div>
    <div class="footer-right">
      <div class="sign-block">
        <div><b>ИСПОЛНИТЕЛЬ:</b> ИП Нигамедьянов А.С.</div>
        <div>Подпись: <span class="sign-line"></span> / Нигамедьянов А.С. /</div>
      </div>
      <div class="sign-block">
        <div><b>ЗАКАЗЧИК:</b> Магазин «Лайм»</div>
        <div>Согласовано: <span class="sign-line"></span> / Дирекция /</div>
      </div>
      <div class="stamp-box">
        <div>М. П.</div>
        <div style="font-size: 6px;">ТК501</div>
      </div>
    </div>
  </div>

</body>
</html>"""
    return html

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        html = generate_html()
        temp_html = "temp_lime_tariffs.html"
        with open(temp_html, "w", encoding="utf-8") as f:
            f.write(html)
            
        abs_html = os.path.abspath(temp_html)
        page.goto("file:///" + abs_html.replace("\\", "/"))
        
        page.pdf(
            path=pdf_filename,
            format="A4",
            landscape=True,
            print_background=True,
            margin={"top": "5mm", "bottom": "5mm", "left": "8mm", "right": "8mm"}
        )
        
        if os.path.exists(temp_html):
            os.remove(temp_html)
            
        # Render high-resolution preview image (.png)
        doc = fitz.open(pdf_filename)
        print(f"Generated PDF: {pdf_filename}, pages: {len(doc)}, size: {os.path.getsize(pdf_filename)} bytes")
        pix = doc[0].get_pixmap(dpi=175)
        pix.save(png_filename)
        print(f"Generated Image Preview: {png_filename}, size: {os.path.getsize(png_filename)} bytes")
            
        browser.close()

if __name__ == "__main__":
    main()
