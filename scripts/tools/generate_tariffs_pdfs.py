import os
import fitz
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
    
    # Right column (12..21)
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
        "png_filename": "apps/web/public/tarify_dostavka_salda.png",
        "vehicle_badge": "АВТОМОБИЛЬ ГАЗЕЛЬ (ДО 3–4 МЕТРОВ, ДО 1.5 ТОНН)",
        "multiplier": 1.0,
        "box1_title": "БЫСТРЫЙ ЗАКАЗ ПО ГОРОДУ",
        "box1_price": "1 000 ₽",
        "box1_desc": "Единый разовый рейс по Верхней Салде (до 30 минут без задержек)",
        
        "box2_title": "ПОЧАСОВАЯ ОПЛАТА АВТО",
        "box2_price": "1 500 ₽ / час",
        "box2_desc": "Включается при занятости автомобиля свыше 30 минут",
        
        "box3_title": "ПЕРЕЕЗД ПОД КЛЮЧ",
        "box3_price": "3 500 ₽ / час",
        "box3_desc": "Автомобиль 1 500 ₽/ч + 2 опытных грузчика (по 1 000 ₽/ч за чел)",
        
        "hourly_note": "Почасовая аренда авто: <b>1 500 ₽/час</b> (свыше 30 мин). Квартирный/офисный переезд: <b>3 500 ₽/час</b> (авто + 2 грузчика).",
    },
    {
        "filename": "apps/web/public/tarify_dostavka_gazel_6m.pdf",
        "png_filename": "apps/web/public/tarify_dostavka_gazel_6m.png",
        "vehicle_badge": "АВТОМОБИЛЬ ГАЗЕЛЬ 6 МЕТРОВ (ДЛИННОМЕРЫ)",
        "multiplier": 1.5,
        "box1_title": "БЫСТРЫЙ ЗАКАЗ (ДО 30 МИН)",
        "box1_price": "1 500 ₽",
        "box1_desc": "Минимальный заказ на 4м авто (+50% к базовой ставке)",
        
        "box2_title": "ПОЧАСОВАЯ АРЕНДА АВТО",
        "box2_price": "2 250 ₽ / час",
        "box2_desc": "+50% к базовой ставке (при занятости авто свыше 30 минут)",
        
        "box3_title": "ПЕРЕВОЗКА НЕГАБАРИТА",
        "box3_price": "3–4 палки бруса",
        "box3_desc": "Доска, брус, профиль до 6м на 4м авто со спецзнаком негабарита",
        
        "hourly_note": "Почасовая аренда: <b>2 250 ₽/час</b> (свыше 30 мин). Перевозка 3–4 шт. бруса/доски до 6м на 4м машине с обозначением негабарита.",
    },
    {
        "filename": "apps/web/public/tarify_dostavka_valday.pdf",
        "png_filename": "apps/web/public/tarify_dostavka_valday.png",
        "vehicle_badge": "ГРУЗОВОЙ АВТОМОБИЛЬ ВАЛДАЙ (ДО 5 ТОНН / 36 М³)",
        "multiplier": 2.0,
        "box1_title": "КОРОТКИЙ РЕЙС (ДО 30 МИН)",
        "box1_price": "2 000 ₽",
        "box1_desc": "Минимальная стоимость короткого рейса по городу (до 30 минут)",
        
        "box2_title": "СТАНДАРТНЫЙ РЕЙС / ЧАС",
        "box2_price": "3 000 ₽ / час",
        "box2_desc": "Меньше 3 000 ₽ нет рейса, кроме короткого до 30 мин за 2 000 ₽",
        
        "box3_title": "ВМЕСТИМОСТЬ И ПАРАМЕТРЫ",
        "box3_price": "до 5 тонн • 36 м³",
        "box3_desc": "Вместимость до 12 паллет, грузоподъёмность 5 000 кг (межгород от 70 ₽/км)",
        
        "hourly_note": "Стандартная ставка: <b>3 000 ₽/час</b> (минимальный рейс от 3 000 ₽, кроме короткого до 30 мин за <b>2 000 ₽</b>). Кузов 36 м³, 12 паллет, до 5 тонн.",
    }
]

def format_price(val):
    return f"{int(round(val)):,}".replace(",", " ") + " ₽"

def generate_landscape_html(config):
    mult = config["multiplier"]
    
    left_rows = destinations_base[:11]
    right_rows = destinations_base[11:]
    max_rows = max(len(left_rows), len(right_rows))
    
    rows_html = ""
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
        
        rows_html += f"""
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
<title>Тарифы tk501.ru - {config['vehicle_badge']}</title>
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
    font-size: 11.5px;
    line-height: 1.25;
    height: 198mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }}
  
  /* Верхняя полоса */
  .top-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 6px;
    margin-bottom: 7px;
  }}
  .top-left {{
    text-align: left;
  }}
  .org-title {{
    font-size: 17px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
  }}
  .top-left-sub {{
    font-size: 10px;
    color: #64748b;
    font-weight: 500;
    margin-top: 1px;
  }}
  .top-center {{
    text-align: center;
  }}
  .doc-title {{
    font-size: 16px;
    font-weight: 900;
    color: #1d4ed8;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }}
  .doc-vehicle {{
    display: inline-block;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1.5px solid #93c5fd;
    padding: 2px 14px;
    border-radius: 20px;
    font-weight: 800;
    font-size: 11.5px;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }}
  .top-right {{
    text-align: right;
    font-size: 10.5px;
    color: #334155;
  }}
  .ati-badge {{
    display: inline-block;
    background: #fef3c7;
    color: #92400e;
    font-weight: 800;
    padding: 1.5px 8px;
    border-radius: 5px;
    margin-top: 2px;
    font-size: 10px;
    border: 1px solid #fde68a;
  }}

  /* 3 КАРТОЧКИ В ОДИН РЯД */
  .zones-grid {{
    display: grid;
    grid-template-columns: 1fr 1.05fr 1.05fr;
    gap: 10px;
    margin-bottom: 7px;
  }}
  .zone-card {{
    border: 1.5px solid #93c5fd;
    border-radius: 8px;
    padding: 6px 10px;
    text-align: center;
    background: #f8fafc;
  }}
  .zone-card.main-zone {{
    border: 2px solid #2563eb;
    background: #eff6ff;
  }}
  .zone-title {{
    font-size: 10.5px;
    font-weight: 800;
    color: #1e3a8a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }}
  .zone-price {{
    font-size: 22px;
    font-weight: 900;
    color: #1d4ed8;
    margin: 1px 0;
    font-family: "Segoe UI", Arial, sans-serif;
  }}
  .zone-desc {{
    font-size: 9.8px;
    color: #475569;
    line-height: 1.2;
  }}

  /* ТАБЛИЦА В 2 КОЛОНКИ */
  table {{
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #2563eb;
    font-size: 11px;
    margin-bottom: 7px;
  }}
  th {{
    background: #1d4ed8;
    color: #ffffff;
    font-weight: 800;
    padding: 5px 8px;
    font-size: 11px;
    text-align: left;
    border: 1px solid #1e40af;
  }}
  td {{
    padding: 4.8px 8px;
    border-bottom: 1px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    vertical-align: middle;
  }}
  .col-num {{
    width: 26px;
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
    width: 90px;
    text-align: right;
    font-weight: 900;
    color: #0f172a;
    font-family: "Segoe UI", Arial, sans-serif;
    white-space: nowrap;
    padding-right: 8px;
    font-size: 12.5px;
  }}
  .col-sep {{
    border-left: 2.5px solid #2563eb !important;
  }}
  
  /* Нижняя панель: Условия + Подпись + Печать */
  .bottom-panel {{
    display: grid;
    grid-template-columns: 1.45fr 1fr;
    gap: 15px;
    align-items: center;
    background: #f8fafc;
    border: 1.5px solid #bfdbfe;
    border-radius: 10px;
    padding: 8px 14px;
  }}
  .panel-left {{
    font-size: 11px;
    line-height: 1.4;
  }}
  .panel-left b {{
    color: #1d4ed8;
  }}
  .dispatcher-box {{
    margin-top: 4px;
    padding: 3px 8px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 5px;
    color: #b91c1c;
    font-weight: 800;
    font-size: 10.5px;
  }}
  .panel-contacts {{
    margin-top: 5px;
    font-size: 11.5px;
    color: #334155;
    font-weight: 600;
  }}
  
  /* Блок утверждения с круглой печатью */
  .panel-right {{
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 14px;
    border-left: 1.5px solid #cbd5e1;
    padding-left: 15px;
  }}
  .sign-text {{
    font-size: 11px;
    color: #1e293b;
    line-height: 1.35;
    text-align: left;
  }}
  .sign-title {{
    font-weight: 900;
    font-size: 11.5px;
    text-transform: uppercase;
    color: #0f172a;
  }}
  .sign-underline {{
    border-bottom: 1.5px solid #0f172a;
    width: 120px;
    display: inline-block;
    margin-right: 4px;
  }}
  .stamp-circle {{
    width: 76px;
    height: 76px;
    border: 2px dashed #2563eb;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #2563eb;
    font-size: 11px;
    font-weight: 900;
    background: #eff6ff;
    flex-shrink: 0;
    text-align: center;
    line-height: 1.15;
  }}
  .stamp-circle span {{
    font-size: 8px;
    font-weight: normal;
    color: #64748b;
  }}
</style>
</head>
<body>

  <div>
    <!-- ШАПКА -->
    <div class="top-bar">
      <div class="top-left">
        <div class="org-title">ИП Нигамедьянов А.С.</div>
        <div class="top-left-sub">ИНН 660704814106 • ОГРНИП 321665800053976</div>
        <div class="top-left-sub">г. Верхняя Салда • Без НДС (УСН)</div>
      </div>
      
      <div class="top-center">
        <div class="doc-title">ОФИЦИАЛЬНЫЙ ПРЕЙСКУРАНТ ТАРИФОВ</div>
        <div class="doc-vehicle">{config['vehicle_badge']}</div>
      </div>
      
      <div class="top-right">
        <div>Официальный сайт: <strong>tk501.ru</strong></div>
        <div>Служба грузоперевозок УрФО и РФ</div>
        <div class="ati-badge">⭐ ATI.SU 5.0 (Код: 2811269)</div>
      </div>
    </div>

    <!-- 3 КАРТОЧКИ -->
    <div class="zones-grid">
      <div class="zone-card main-zone">
        <div class="zone-title">{config['box1_title']}</div>
        <div class="zone-price">{config['box1_price']}</div>
        <div class="zone-desc">{config['box1_desc']}</div>
      </div>
      <div class="zone-card">
        <div class="zone-title">{config['box2_title']}</div>
        <div class="zone-price">{config['box2_price']}</div>
        <div class="zone-desc">{config['box2_desc']}</div>
      </div>
      <div class="zone-card">
        <div class="zone-title">{config['box3_title']}</div>
        <div class="zone-price">{config['box3_price']}</div>
        <div class="zone-desc">{config['box3_desc']}</div>
      </div>
    </div>

    <!-- ТАБЛИЦА -->
    <table>
      <thead>
        <tr>
          <th style="width: 24px; text-align: center;">№</th>
          <th>Пункт назначения / Направление рейса</th>
          <th style="width: 82px; text-align: right; padding-right: 10px;">Тариф</th>
          <th style="width: 24px; text-align: center; border-left: 2.5px solid #2563eb;">№</th>
          <th>Пункт назначения / Направление рейса</th>
          <th style="width: 82px; text-align: right; padding-right: 10px;">Тариф</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <!-- НИЖНЯЯ ПАНЕЛЬ: УСЛОВИЯ + ПОДПИСЬ + ПЕЧАТЬ -->
  <div class="bottom-panel">
    <div class="panel-left">
      <div>{config['hourly_note']}</div>
      <div class="dispatcher-box">
        ⚠️ <b>Внимание:</b> Окончательный расчёт стоимости перевозки и рейсов согласовывается с диспетчером.
      </div>
      <div class="panel-contacts">
        📞 Диспетчер: <strong style="color: #0f172a; font-size: 12px;">+7-963-0-<span style="color: #ea580c; font-weight: 900;">501</span>-<span style="color: #ea580c; font-weight: 900;">501</span></strong> &nbsp;•&nbsp; Сайт: <strong>tk501.ru</strong> &nbsp;•&nbsp; Действует на 2026 год
      </div>
    </div>

    <div class="panel-right">
      <div class="sign-text">
        <div class="sign-title">УТВЕРЖДАЮ:</div>
        <div>ИП Нигамедьянов А.С.</div>
        <div style="margin-top: 4px;">Подпись: <span class="sign-underline"></span></div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 3px;">«01» января 2026 г.</div>
      </div>
      <div class="stamp-circle">
        <div>М. П.</div>
        <span>ИП Нигамедьянов</span>
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
        
        for var in variants:
            html = generate_landscape_html(var)
            temp_html = "temp_" + os.path.basename(var["filename"]).replace(".pdf", ".html")
            with open(temp_html, "w", encoding="utf-8") as f:
                f.write(html)
            
            abs_html = os.path.abspath(temp_html)
            page.goto("file:///" + abs_html.replace("\\", "/"))
            
            page.pdf(
                path=var["filename"],
                format="A4",
                landscape=True,
                print_background=True,
                margin={"top": "6mm", "bottom": "6mm", "left": "10mm", "right": "10mm"}
            )
            
            if os.path.exists(temp_html):
                os.remove(temp_html)
                
            # Render high-resolution preview image (.png)
            doc = fitz.open(var["filename"])
            print(f"Generated PDF: {var['filename']}, pages: {len(doc)}, size: {os.path.getsize(var['filename'])} bytes")
            pix = doc[0].get_pixmap(dpi=150)
            pix.save(var["png_filename"])
            print(f"Generated Image Preview: {var['png_filename']}, size: {os.path.getsize(var['png_filename'])} bytes")
                
        browser.close()

if __name__ == "__main__":
    main()
