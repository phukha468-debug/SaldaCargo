import os
from playwright.sync_api import sync_playwright

destinations_base = [
    # Left column (1..11)
    (1, "Верхняя Салда — п. Северный", 1000),
    (2, "Верхняя Салда, Сады: № 1, 3, 4, 5, 8, 9, 10, 13, 14, 20, 23, 26, Чернушка", 1000),
    (3, "Титановая Долина", 1200),
    (4, "Верхняя Салда, Сады: № 2, 7, 11, 12, 15, 16, 17, 18", 1500),
    (5, "Иса, Тирус Рыбное, Пучковка", 1500),
    (6, "г. Нижняя Салда (до плотины)", 1500),
    (7, "Северная", 1500),
    (8, "г. Нижняя Салда (после плотины)", 2000),
    (9, "п. Свободный", 2000),
    (10, "Никитино", 2000),
    (11, "Нелоба", 2500),
    
    # Right column (12..21) - item 14 crossed out was removed, item 16 "Басьяновский" is 5000
    (12, "г. Нижняя Салда — Шмаринские дачи", 2500),
    (13, "Покровское", 2500),
    (14, "Акинфиево", 4000),
    (15, "Басьяновский", 5000),
    (16, "Медведево", 4000),
    (17, "Песчаный", 4000),
    (18, "Бобровка", 4000),
    (19, "Тагильский Кордон", 4000),
    (20, "г. Нижний Тагил", 5000),
    (21, "г. Екатеринбург", 16000),
]

variants = [
    {
        "filename": "apps/web/public/tarify_dostavka_salda.pdf",
        "vehicle_badge": "АВТОМОБИЛЬ ГАЗЕЛЬ (ДО 3–4 МЕТРОВ)",
        "multiplier": 1.0,
        "zone1_price": 700,
        "zone2_price": 1000,
        "zone3_price": 1200,
        "hourly_note": "Почасовая аренда авто: <b>1 500 ₽/час</b> (включается при занятости свыше 30 мин). Переезд (машина + 2 грузчика): <b>3 500 ₽/час</b> (1 500 ₽ машина + по 1 000 ₽ за грузчика).",
        "special_desc": "Стандартная городская и междугородняя доставка грузов до 1.5–2 тонн"
    },
    {
        "filename": "apps/web/public/tarify_dostavka_gazel_6m.pdf",
        "vehicle_badge": "АВТОМОБИЛЬ ГАЗЕЛЬ 6 МЕТРОВ (ДЛИННОМЕРЫ)",
        "multiplier": 1.5,
        "zone1_price": 1050,
        "zone2_price": 1500,
        "zone3_price": 1800,
        "hourly_note": "Почасовая аренда авто: <b>2 250 ₽/час</b> (включается при занятости свыше 30 мин). Перевозка длинномеров до 6м (2–3 палки бруса/доски/профиля) с обозначением негабарита (красный знак/флаг).",
        "special_desc": "Экономичная перевозка длинномерного груза без заказа дорогой тяжелой спецтехники"
    },
    {
        "filename": "apps/web/public/tarify_dostavka_valday.pdf",
        "vehicle_badge": "ГРУЗОВОЙ АВТОМОБИЛЬ ВАЛДАЙ / 5 ТОНН",
        "multiplier": 2.0,
        "zone1_price": 1400,
        "zone2_price": 2000,
        "zone3_price": 2400,
        "hourly_note": "Почасовая аренда авто: <b>3 000 ₽/час</b> (включается при занятости свыше 30 мин). Вместимость до 36 м³ (12 паллет), грузоподъёмность до 5 000 кг.",
        "special_desc": "Тяжелые объёмные партии грузов, промышленные поставки и крупные переезды"
    }
]

def format_price(val):
    return f"{int(round(val)):,}".replace(",", " ") + " ₽"

def generate_html(config):
    mult = config["multiplier"]
    
    # Split destinations into left (1..11) and right (12..21)
    left_rows = destinations_base[:11]
    right_rows = destinations_base[11:]
    
    max_rows = max(len(left_rows), len(right_rows))
    
    table_rows_html = ""
    for idx in range(max_rows):
        l_item = left_rows[idx] if idx < len(left_rows) else None
        r_item = right_rows[idx] if idx < len(right_rows) else None
        
        row_bg = "background: #f8fafc;" if idx % 2 == 1 else "background: #ffffff;"
        
        l_num = l_item[0] if l_item else ""
        l_name = l_item[1] if l_item else ""
        l_price = format_price(l_item[2] * mult) if l_item else ""
        
        r_num = r_item[0] if r_item else ""
        r_name = r_item[1] if r_item else ""
        r_price = format_price(r_item[2] * mult) if r_item else ""
        
        table_rows_html += f"""
        <tr style="{row_bg}">
          <td class="col-num">{l_num}</td>
          <td class="col-name">{l_name}</td>
          <td class="col-price">{l_price}</td>
          <td class="col-num col-sep">{r_num}</td>
          <td class="col-name">{r_name}</td>
          <td class="col-price">{r_price}</td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Тарифы ancargo66.ru - {config['vehicle_badge']}</title>
<style>
  @page {{
    size: 210mm 297mm;
    margin: 8mm 10mm 8mm 10mm;
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
    font-size: 11px;
    line-height: 1.25;
  }}
  .header {{
    text-align: center;
    margin-bottom: 8px;
    position: relative;
  }}
  .org-title {{
    font-size: 19px;
    font-weight: 800;
    color: #1e293b;
    letter-spacing: -0.2px;
  }}
  .doc-title {{
    font-size: 15px;
    font-weight: 800;
    color: #1d4ed8;
    margin-top: 2px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }}
  .doc-vehicle {{
    display: inline-block;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    padding: 2px 10px;
    border-radius: 6px;
    font-weight: 800;
    font-size: 11.5px;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }}
  .doc-sub {{
    font-size: 10px;
    color: #475569;
    margin-top: 2px;
  }}
  
  /* 3 Boxes */
  .zones-grid {{
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }}
  .zone-card {{
    border: 1px solid #93c5fd;
    border-radius: 8px;
    padding: 6px 8px;
    text-align: center;
    background: #f0f7ff;
  }}
  .zone-card.main-zone {{
    border: 1.5px solid #2563eb;
    background: #e0eefe;
  }}
  .zone-title {{
    font-size: 10px;
    font-weight: 800;
    color: #1e3a8a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }}
  .zone-price {{
    font-size: 19px;
    font-weight: 900;
    color: #1d4ed8;
    margin: 1px 0;
    font-family: "Segoe UI", Arial, sans-serif;
  }}
  .zone-desc {{
    font-size: 9px;
    color: #475569;
    line-height: 1.15;
  }}

  /* Section table title */
  .sec-heading {{
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 5px;
  }}

  /* Table */
  table {{
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #93c5fd;
    font-size: 9.8px;
  }}
  th {{
    background: #1d4ed8;
    color: #ffffff;
    font-weight: 700;
    padding: 4px 5px;
    font-size: 9.8px;
    text-align: left;
    border: 1px solid #1e40af;
  }}
  td {{
    padding: 3.5px 5px;
    border-bottom: 1px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    vertical-align: middle;
  }}
  .col-num {{
    width: 22px;
    text-align: center;
    font-weight: 800;
    color: #0f172a;
    background: #f1f5f9;
  }}
  .col-name {{
    font-weight: 600;
    color: #1e293b;
  }}
  .col-price {{
    width: 65px;
    text-align: right;
    font-weight: 800;
    color: #0f172a;
    font-family: "Segoe UI", Arial, sans-serif;
    white-space: nowrap;
    padding-right: 6px;
  }}
  .col-sep {{
    border-left: 2px solid #2563eb !important;
  }}

  /* Bottom banner */
  .footer-block {{
    margin-top: 8px;
    border: 1px solid #bfdbfe;
    background: #f8fafc;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 9.5px;
    line-height: 1.35;
  }}
  .footer-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
  }}
  .hourly-tag {{
    color: #0f172a;
  }}
  .hourly-tag b {{
    color: #1d4ed8;
    font-weight: 800;
  }}
  .dispatcher-notice {{
    color: #b91c1c;
    font-weight: 700;
    background: #fef2f2;
    border: 1px solid #fecaca;
    padding: 2.5px 8px;
    border-radius: 5px;
    display: inline-block;
    margin-top: 2px;
  }}
  .contacts-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid #e2e8f0;
    font-size: 9px;
    color: #64748b;
  }}
  .contacts-bar strong {{
    color: #0f172a;
  }}
</style>
</head>
<body>

  <div class="header">
    <div class="org-title">ИП Нигамедьянов А.С.</div>
    <div class="doc-title">ТАРИФЫ НА ДОСТАВКУ</div>
    <div class="doc-vehicle">{config['vehicle_badge']}</div>
    <div class="doc-sub">Официальный прейскурант | Приложение к визуальной схеме зон доставки | ancargo66.ru</div>
    <div class="doc-sub">({config['special_desc']})</div>
  </div>

  <div class="zones-grid">
    <div class="zone-card">
      <div class="zone-title">ЗОНА 1 (МАГАЗИНЫ-ПАРТНЁРЫ)</div>
      <div class="zone-price">{format_price(config['zone1_price'])}</div>
      <div class="zone-desc">ул. Ленина, Энгельса, К. Маркса, Воронова и др. (по договору)</div>
    </div>
    <div class="zone-card main-zone">
      <div class="zone-title">ПО ГОРОДУ (БЫСТРЫЙ ЗАКАЗ)</div>
      <div class="zone-price">{format_price(config['zone2_price'])}</div>
      <div class="zone-desc">Единый тариф по Верхней Салде (разовый рейс до 30 минут)</div>
    </div>
    <div class="zone-card">
      <div class="zone-title">ЗОНА 3 (ОТДАЛЁННЫЙ СЕКТОР)</div>
      <div class="zone-price">{format_price(config['zone3_price'])}</div>
      <div class="zone-desc">Отдельный сектор города согласно утверждённой визуальной карте</div>
    </div>
  </div>

  <div class="sec-heading">ФИКСИРОВАННЫЕ НАПРАВЛЕНИЯ И ПРИГОРОД</div>

  <table>
    <thead>
      <tr>
        <th style="width: 22px; text-align: center;">№</th>
        <th>Пункт назначения / Направление</th>
        <th style="width: 65px; text-align: right; padding-right: 6px;">Тариф</th>
        <th style="width: 22px; text-align: center; border-left: 2px solid #2563eb;">№</th>
        <th>Пункт назначения / Направление</th>
        <th style="width: 65px; text-align: right; padding-right: 6px;">Тариф</th>
      </tr>
    </thead>
    <tbody>
      {table_rows_html}
    </tbody>
  </table>

  <div class="footer-block">
    <div class="footer-row">
      <div class="hourly-tag">{config['hourly_note']}</div>
    </div>
    <div>
      <span class="dispatcher-notice">⚠️ Внимание: Окончательный расчёт стоимости согласовывается с диспетчером.</span>
    </div>
    <div class="contacts-bar">
      <div>Диспетчерская служба: <strong>+7 (963) 050-15-01</strong></div>
      <div>Официальный сайт: <strong>ancargo66.ru</strong></div>
      <div>Мессенджер MAX: <strong>@id660704814106_bot</strong></div>
      <div>Верхняя Салда • Актуально на 2026 г.</div>
    </div>
  </div>

</body>
</html>
"""
    return html

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        for var in variants:
            html = generate_html(var)
            temp_html = "temp_" + os.path.basename(var["filename"]).replace(".pdf", ".html")
            with open(temp_html, "w", encoding="utf-8") as f:
                f.write(html)
            
            abs_html = os.path.abspath(temp_html)
            page.goto("file:///" + abs_html.replace("\\", "/"))
            
            page.pdf(
                path=var["filename"],
                format="A4",
                print_background=True,
                margin={"top": "8mm", "bottom": "8mm", "left": "10mm", "right": "10mm"}
            )
            print(f"Generated {var['filename']}, size: {os.path.getsize(var['filename'])} bytes")
            if os.path.exists(temp_html):
                os.remove(temp_html)
                
        browser.close()

if __name__ == "__main__":
    main()
