# -*- coding: utf-8 -*-
"""
Генерация официального крупношрифтового PDF-прейскуранта и PNG-превью ПРР для мебельного магазина «ЛАЙМ»
ТК501 (ИП Нигамедьянов А.С.)
Убраны: старая цена, сравнение, лифт.
Увеличен шрифт для максимальной читаемости превью без распечатки.
Указан номер в АТИ.su: 2811269.
"""
import os
import fitz
from playwright.sync_api import sync_playwright

pdf_filename = "apps/web/public/tarify_prr_mebel_lime.pdf"
png_filename = "apps/web/public/tarify_prr_mebel_lime.png"

items_data = [
    # (№, Название, Новая цена, Грузчики)
    (1, "Кухонный гарнитур — Верхний модуль", "100 ₽", "1 чел"),
    (2, "Кухонный гарнитур — Нижний модуль", "120 ₽", "1 чел"),
    (3, "Столешница кухонная", "200 ₽", "2 чел"),
    (4, "Обеденная зона (стол + стулья)", "250 ₽", "2 чел"),
    
    (5, "Шкаф 2-х дверный в сборе", "200 ₽", "2 чел"),
    (6, "Шкаф в разборе (комплект)", "200 ₽", "1 чел"),
    (7, "Комод малый в сборе", "200 ₽", "1 чел"),
    (8, "Комод большой в сборе", "250 ₽", "2 чел"),
    (9, "Прихожая в сборе", "200 ₽", "2 чел"),
    (10, "Стенка большая в разборе", "400 ₽", "2 чел"),
    (11, "Кровать 1-спальная (серия КР-3)", "150 ₽", "1 чел"),
    
    (12, "Кровать 2-спальная (КР-16, КР-710, КР-71)", "200 ₽", "2 чел"),
    (13, "Матрас малый (800–900 мм)", "150 ₽", "1 чел"),
    (14, "Матрас большой (1400–1600 мм)", "250 ₽", "2 чел"),
    (15, "Тумбы / столики журнальные / стол-книжка", "150 ₽", "1 чел"),
    (16, "Стол компьютерный прямой", "200 ₽", "1 чел"),
    (17, "Стол компьютерный угловой", "250 ₽", "2 чел"),
    (18, "Кресло-кровать", "250 ₽", "2 чел"),
    (19, "Канапе", "300 ₽", "2 чел"),
    (20, "Диван прямой (стандартный 2-местный)", "300 ₽", "2 чел"),
    (21, "Диван угловой", "400 ₽", "2 чел"),
    (22, "Диван прямой 3-местный (тройной)", "500 ₽", "2 чел"),
]

def generate_html():
    half = len(items_data) // 2
    left_items = items_data[:half]
    right_items = items_data[half:]

    def render_table_rows(items):
        html_rows = ""
        for i, it in enumerate(items):
            num, name, price, crew = it
            bg = "#ffffff" if i % 2 == 0 else "#f8fafc"
            crew_badge = f'<span class="badge-crew-2">👥 {crew}</span>' if "2" in crew else f'<span class="badge-crew-1">👤 {crew}</span>'
            
            html_rows += f"""
            <tr style="background: {bg};">
              <td class="col-num">{num}</td>
              <td class="col-name">{name}</td>
              <td class="col-crew">{crew_badge}</td>
              <td class="col-price">{price}</td>
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
    margin: 6mm 10mm 6mm 10mm;
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
    width: 277mm;
    height: 196mm;
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
    border-bottom: 3px solid #ea580c;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }}
  .logo-block {{
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .brand-title {{
    font-size: 24px;
    font-weight: 900;
    letter-spacing: -0.5px;
    color: #0f172a;
    line-height: 1.15;
  }}
  .brand-title span {{
    color: #ea580c;
  }}
  .brand-sub {{
    font-size: 11px;
    color: #475569;
    font-weight: 700;
    margin-top: 2px;
  }}
  .ati-badge {{
    display: inline-block;
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 800;
    font-size: 10px;
    margin-left: 6px;
  }}
  .partner-badge {{
    text-align: right;
    background: #fff7ed;
    border: 1.5px solid #ea580c;
    border-radius: 10px;
    padding: 6px 16px;
    box-shadow: 0 2px 4px rgba(234, 88, 12, 0.08);
  }}
  .partner-title {{
    font-size: 15px;
    font-weight: 900;
    color: #c2410c;
    letter-spacing: 0.2px;
  }}
  .partner-sub {{
    font-size: 11px;
    color: #7c2d12;
    font-weight: 700;
    margin-top: 1px;
  }}

  /* ЗАГОЛОВОК ДОКУМЕНТА */
  .doc-title-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #ffffff;
    padding: 7px 14px;
    border-radius: 8px;
    margin-bottom: 8px;
  }}
  .doc-main-title {{
    font-size: 15px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .doc-desc {{
    font-size: 11.5px;
    color: #cbd5e1;
    font-weight: 600;
  }}
  .doc-desc b {{
    color: #fba94b;
  }}

  /* ОСНОВНАЯ ТАБЛИЦА (2 КРУПНЫЕ КОЛОНКИ СТОРОНА К СТОРОНЕ) */
  .tables-container {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: auto;
  }}
  .table-box {{
    border: 1.5px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }}
  thead tr {{
    background: #1e293b;
  }}
  th {{
    color: #ffffff;
    padding: 7px 10px;
    text-align: left;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid #ea580c;
  }}
  th.th-center, td.col-num, td.col-crew, td.col-price {{
    text-align: center;
  }}
  td {{
    padding: 5.5px 10px;
    border-bottom: 1px solid #e2e8f0;
    line-height: 1.25;
  }}
  .col-num {{
    width: 28px;
    font-weight: 900;
    color: #64748b;
    font-size: 13px;
  }}
  .col-name {{
    font-weight: 800;
    color: #090d16;
    font-size: 15.5px;
    letter-spacing: -0.3px;
  }}
  .col-crew {{
    width: 86px;
  }}
  .badge-crew-1 {{
    display: inline-block;
    padding: 2.5px 8px;
    border-radius: 6px;
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 800;
    font-size: 12px;
  }}
  .badge-crew-2 {{
    display: inline-block;
    padding: 2.5px 8px;
    border-radius: 6px;
    background: #fef3c7;
    color: #b45309;
    font-weight: 800;
    font-size: 12px;
  }}
  .col-price {{
    width: 92px;
    font-weight: 900;
    color: #ea580c;
    background: #fff7ed;
    font-size: 17.5px;
    border-left: 1.5px solid #fed7aa;
  }}

  /* ПОДВАЛ */
  .footer {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #cbd5e1;
    padding-top: 6px;
    margin-top: 5px;
  }}
  .footer-left {{
    font-size: 11px;
    color: #334155;
    line-height: 1.4;
  }}
  .footer-left b {{
    color: #0f172a;
  }}
  .footer-note {{
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    margin-top: 2px;
  }}
  .footer-right {{
    display: flex;
    align-items: center;
    gap: 22px;
  }}
  .sign-block {{
    font-size: 11px;
    color: #1e293b;
    line-height: 1.35;
  }}
  .sign-line {{
    display: inline-block;
    width: 90px;
    border-bottom: 1.5px solid #0f172a;
    margin: 0 4px;
  }}
  .stamp-box {{
    width: 54px;
    height: 54px;
    border: 2px dashed #0284c7;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: #0284c7;
    font-weight: 900;
    text-transform: uppercase;
    background: #f0f9ff;
  }}
</style>
</head>
<body>

  <!-- ШАПКА -->
  <div class="header">
    <div class="logo-block">
      <div>
        <div class="brand-title">ТК<span>501</span> &nbsp;|&nbsp; СЛУЖБА ДОСТАВКИ И ПРР</div>
        <div class="brand-sub">
          ИП Нигамедьянов А.С. • ОГРНИП 321665800053976 • ИНН 660704814106 • г. Верхняя Салда
          <span class="ati-badge">ATI.SU: 2811269 ⭐ 5.0</span>
        </div>
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
    <div class="doc-desc">Тариф за <b>1 этаж</b> заноса • В калькуляторе: <b>tk501.ru/calc.html</b></div>
  </div>

  <!-- ТАБЛИЦА В ДВЕ КОЛОНКИ С КРУПНЫМ ШРИФТОМ -->
  <div class="tables-container">
    <!-- Левая колонка (позиции 1-11) -->
    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th class="th-center">№</th>
            <th>Наименование мебели</th>
            <th class="th-center">Состав</th>
            <th class="th-center">Тариф / эт</th>
          </tr>
        </thead>
        <tbody>
          {left_rows_html}
        </tbody>
      </table>
    </div>

    <!-- Правая колонка (позиции 12-22) -->
    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th class="th-center">№</th>
            <th>Наименование мебели</th>
            <th class="th-center">Состав</th>
            <th class="th-center">Тариф / эт</th>
          </tr>
        </thead>
        <tbody>
          {right_rows_html}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ПОДВАЛ -->
  <div class="footer">
    <div class="footer-left">
      <div>📞 Диспетчерская служба: <b>+7-963-0-501-501</b> &nbsp;•&nbsp; Сайт: <b>tk501.ru</b> &nbsp;•&nbsp; <b>ancargo66.ru</b></div>
      <div class="footer-note">* Пронос мебели от машины до подъезда свыше 30 метров оплачивается как +1 этаж. Подъём осуществляется аккуратно опытными грузчиками.</div>
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
        <div style="font-size: 7px; color: #0369a1;">ТК501</div>
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
            margin={"top": "6mm", "bottom": "6mm", "left": "10mm", "right": "10mm"}
        )
        
        if os.path.exists(temp_html):
            os.remove(temp_html)
            
        # Render high-resolution preview image (.png)
        doc = fitz.open(pdf_filename)
        print(f"Generated PDF: {pdf_filename}, pages: {len(doc)}, size: {os.path.getsize(pdf_filename)} bytes")
        pix = doc[0].get_pixmap(dpi=185)
        pix.save(png_filename)
        print(f"Generated Image Preview: {png_filename}, size: {os.path.getsize(png_filename)} bytes")
            
        browser.close()

if __name__ == "__main__":
    main()
