# -*- coding: utf-8 -*-
import os
from playwright.sync_api import sync_playwright

DOCS_DIR = os.path.abspath("docs/reconciliation")
PUBLIC_DIR = os.path.abspath("apps/web/public/documents")
os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

HTML_PATH = os.path.join(DOCS_DIR, "akt-sverki-geostroy-2026-10-29.html")
PDF_PATH = os.path.join(DOCS_DIR, "akt-sverki-geostroy-2026-10-29.pdf")
PNG_PATH = os.path.join(DOCS_DIR, "akt-sverki-geostroy-2026-10-29.png")
PUBLIC_PDF_PATH = os.path.join(PUBLIC_DIR, "akt-sverki-geostroy-2026-10-29.pdf")

# Сальдо начальное на 01.10.2026 (задолженность по счёту № 41 от 28.09.2026 на 50 000 руб.)
START_SALDO = 50000.00

# Операции за октябрь 2026
operations = [
    # Дата, Документ ООО, Документ ИП, Услуга (Дебет ИП), Оплата (Кредит ИП), Неоплачен
    ("01.10.26", "Приход (43 от 01.10.2026)", "Акт / Счёт № 43 от 01.10.2026", 15000, 0, False),
    ("02.10.26", "Приход (42 от 02.10.2026)", "Акт / Счёт № 42 от 02.10.2026", 40000, 0, False),
    ("06.10.26", "Приход (44 от 06.10.2026)", "Акт / Счёт № 44 от 06.10.2026", 50000, 0, False),
    ("07.10.26", "Приход (45 от 07.10.2026)", "Акт / Счёт № 45 от 07.10.2026", 30000, 0, False),
    ("09.10.26", "Приход (46 от 09.10.2026)", "Акт / Счёт № 46 от 09.10.2026", 50000, 0, False),
    ("09.10.26", "Оплата от 09.10.2026", "Оплата от 09.10.2026 (счета 41–44)", 0, 155000, False),
    ("13.10.26", "Приход (47 от 13.10.2026)", "Акт / Счёт № 47 от 13.10.2026", 46000, 0, False),
    ("14.10.26", "Оплата от 14.10.2026", "Оплата от 14.10.2026 (счета 45–47)", 0, 126000, False),
    ("16.10.26", "Приход (48 от 16.10.2026)", "Акт / Счёт № 48 от 16.10.2026", 50000, 0, False),
    ("17.10.26", "Приход (49 от 17.10.2026)", "Акт / Счёт № 49 от 17.10.2026", 26000, 0, False),
    ("18.10.26", "Приход (50 от 18.10.2026)", "Акт / Счёт № 50 от 18.10.2026", 26000, 0, False),
    ("19.10.26", "Оплата от 19.10.2026", "Оплата от 19.10.2026 (счета 48–50)", 0, 110000, False),
    ("19.10.26", "Приход (51 от 19.10.2026)", "Акт / Счёт № 51 от 19.10.2026", 40000, 0, True),
    ("22.10.26", "Приход (53 от 22.10.2026)", "Акт / Счёт № 53 от 22.10.2026", 50000, 0, True),
    ("22.10.26", "Приход (54 от 22.10.2026)", "Акт / Счёт № 54 от 22.10.2026", 50000, 0, True),
    ("23.10.26", "Приход (52 от 23.10.2026)", "Акт / Счёт № 52 от 23.10.2026", 18000, 0, True),
    ("23.10.26", "Приход (55 от 23.10.2026)", "Акт / Счёт № 55 от 23.10.2026", 50000, 0, True),
    ("28.10.26", "Приход (56 от 28.10.2026)", "Акт / Счёт № 56 от 28.10.2026", 50000, 0, True),
    ("28.10.26", "Приход (57 от 28.10.2026)", "Акт / Счёт № 57 от 28.10.2026", 50000, 0, True),
]

def fmt_val(v):
    if v == 0:
        return "—"
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")

def generate_pdf():
    tot_deb_left = 0
    tot_cred_left = 0
    tot_deb_right = 0
    tot_cred_right = 0

    rows_html = []
    for op in operations:
        date, doc_l, doc_r, deb_r, cred_r, is_unpaid = op
        deb_l = cred_r
        cred_l = deb_r
        
        tot_deb_left += deb_l
        tot_cred_left += cred_l
        tot_deb_right += deb_r
        tot_cred_right += cred_r

        is_pay = (cred_r > 0)
        right_style = 'color: #b45309; font-weight: bold;' if is_unpaid else ('font-weight: bold;' if is_pay else '')
        left_style = 'font-weight: bold;' if is_pay else ''

        rows_html.append(f"""
        <tr>
          <td class="text-center">{date}</td>
          <td class="{left_style}">{doc_l}</td>
          <td class="text-right {left_style}">{fmt_val(deb_l)}</td>
          <td class="text-right {left_style}">{fmt_val(cred_l)}</td>
          <td class="text-center">{date}</td>
          <td class="{right_style}">{doc_r}</td>
          <td class="text-right {right_style}">{fmt_val(deb_r)}</td>
          <td class="text-right {right_style}">{fmt_val(cred_r)}</td>
        </tr>
        """)

    saldo = START_SALDO + tot_deb_right - tot_cred_right

    html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>АКТ СВЕРКИ взаимных расчетов — ООО "ГЕОСТРОЙИНДУСТРИЯ" и ИП Нигамедьянов А.С.</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 8mm 10mm 8mm 10mm;
  }}
  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}
  body {{
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    font-size: 8pt;
    line-height: 1.25;
  }}
  .act-title {{
    text-align: center;
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 3px;
    letter-spacing: 0.5px;
  }}
  .act-period {{
    text-align: center;
    font-size: 8.5pt;
    margin-bottom: 3px;
  }}
  .act-parties {{
    text-align: center;
    font-size: 8.5pt;
    font-weight: bold;
    margin-bottom: 8px;
    line-height: 1.3;
  }}
  .preamble {{
    text-align: justify;
    font-size: 7.5pt;
    color: #374151;
    margin-bottom: 8px;
    line-height: 1.25;
  }}
  table.reconciliation {{
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    margin-bottom: 8px;
  }}
  table.reconciliation th, table.reconciliation td {{
    border: 1px solid #cbd5e1;
    padding: 3px 5px;
  }}
  table.reconciliation th {{
    background-color: #f1f5f9;
    font-weight: bold;
    text-align: center;
  }}
  .party-header {{
    background-color: #e2e8f0 !important;
    font-weight: bold;
    font-size: 8pt;
    text-align: center;
    padding: 4px !important;
  }}
  .sub-header {{
    background-color: #f8fafc;
    font-size: 7pt;
    font-weight: bold;
  }}
  .text-center {{ text-align: center; white-space: nowrap; }}
  .text-right {{ text-align: right; white-space: nowrap; }}
  .bold {{ font-weight: bold; }}
  .totals-row {{
    background-color: #f8fafc;
    font-weight: bold;
    border-top: 1.5px solid #64748b;
  }}
  .saldo-row {{
    background-color: #f1f5f9;
    font-weight: bold;
  }}
  .summary-card {{
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background-color: #f8fafc;
    padding: 6px 10px;
    margin-top: 8px;
    margin-bottom: 12px;
    font-size: 8pt;
    line-height: 1.35;
  }}
  .summary-card .debt-lead {{
    font-weight: bold;
    color: #0f172a;
    font-size: 8.5pt;
  }}
  .summary-card .debt-words {{
    color: #475569;
    margin-bottom: 3px;
    font-size: 8pt;
  }}
  .summary-card .unpaid-list {{
    color: #0f172a;
    font-weight: 500;
  }}
  .signatures {{
    width: 100%;
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
  }}
  .sign-col {{
    width: 48%;
    font-size: 8.5pt;
  }}
  .sign-col .org-name {{
    font-weight: bold;
    margin-bottom: 16px;
  }}
  .sign-col .role-line {{
    display: flex;
    align-items: flex-end;
    margin-bottom: 8px;
  }}
  .sign-col .line {{
    flex: 1;
    border-bottom: 1px solid #111827;
    margin: 0 8px;
    height: 12px;
  }}
  .sign-col .mp {{
    margin-top: 5px;
    color: #475569;
    font-weight: bold;
    font-size: 8pt;
  }}
  @media print {{
    body {{
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
  }}
</style>
</head>
<body>

  <div class="act-title">АКТ СВЕРКИ</div>
  <div class="act-period">взаимных расчетов за период: 01.10.2026 - 29.10.2026</div>
  <div class="act-parties">
    между ООО "ГЕОСТРОЙИНДУСТРИЯ" (ИНН 7415089601)<br>
    и ИП Нигамедьянов Александр Сергеевич (ИНН 660704814106)
  </div>

  <div class="preamble">
    Мы, нижеподписавшиеся, Директор ООО "ГЕОСТРОЙИНДУСТРИЯ" Ефременко Арсений Викторович, с одной стороны, и ИП Нигамедьянов Александр Сергеевич, с другой стороны, составили настоящий акт сверки в том, что состояние взаимных расчетов по данным учета следующее:
  </div>

  <table class="reconciliation">
    <thead>
      <tr>
        <th colspan="4" class="party-header">По данным ООО "ГЕОСТРОЙИНДУСТРИЯ", руб.</th>
        <th colspan="4" class="party-header">По данным ИП Нигамедьянов Александр Сергеевич, руб.</th>
      </tr>
      <tr class="sub-header">
        <th style="width: 50px;">Дата</th>
        <th>Документ</th>
        <th style="width: 65px;">Дебет</th>
        <th style="width: 65px;">Кредит</th>
        <th style="width: 50px;">Дата</th>
        <th>Документ</th>
        <th style="width: 65px;">Дебет</th>
        <th style="width: 65px;">Кредит</th>
      </tr>
    </thead>
    <tbody>
      <tr class="saldo-row">
        <td colspan="3" class="bold">Сальдо начальное на 01.10.2026</td>
        <td class="text-right bold">{fmt_val(START_SALDO)}</td>
        <td colspan="2" class="bold">Сальдо начальное на 01.10.2026</td>
        <td class="text-right bold">{fmt_val(START_SALDO)}</td>
        <td class="text-center bold">—</td>
      </tr>
      {"".join(rows_html)}
      <tr class="totals-row">
        <td colspan="2" class="bold">Обороты за период</td>
        <td class="text-right bold">{fmt_val(tot_deb_left)}</td>
        <td class="text-right bold">{fmt_val(tot_cred_left)}</td>
        <td colspan="2" class="bold">Обороты за период</td>
        <td class="text-right bold">{fmt_val(tot_deb_right)}</td>
        <td class="text-right bold">{fmt_val(tot_cred_right)}</td>
      </tr>
      <tr class="saldo-row">
        <td colspan="3" class="bold">Сальдо конечное на 29.10.2026</td>
        <td class="text-right bold">{fmt_val(saldo)}</td>
        <td colspan="2" class="bold">Сальдо конечное на 29.10.2026</td>
        <td class="text-right bold">{fmt_val(saldo)}</td>
        <td class="text-center bold">—</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-card">
    <div class="debt-lead">
      По данным учета сторон на 29 октября 2026 года задолженность в пользу ИП Нигамедьянов Александр Сергеевич составляет {fmt_val(saldo)} руб
    </div>
    <div class="debt-words">
      (Триста восемь тысяч рублей 00 копеек).
    </div>
    <div class="unpaid-list">
      <b>Неоплаченные счета:</b> № 51 (40 000 ₽), № 53 (50 000 ₽), № 54 (50 000 ₽), № 52 (18 000 ₽), № 55 (50 000 ₽), № 56 (50 000 ₽), № 57 (50 000 ₽).
    </div>
  </div>

  <div class="signatures">
    <div class="sign-col">
      <div class="org-name">От ООО "ГЕОСТРОЙИНДУСТРИЯ"</div>
      <div class="role-line">
        <span>Директор</span>
        <span class="line"></span>
        <span>(Ефременко А. В.)</span>
      </div>
      <div class="mp">М.П.</div>
    </div>
    <div class="sign-col">
      <div class="org-name">От ИП Нигамедьянов Александр Сергеевич</div>
      <div class="role-line">
        <span>ИП</span>
        <span class="line"></span>
        <span>(Нигамедьянов А. С.)</span>
      </div>
      <div class="mp">М.П.</div>
    </div>
  </div>

</body>
</html>
"""

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content, wait_until="networkidle")
        page.pdf(
            path=PDF_PATH,
            format="A4",
            print_background=True,
            margin={"top": "8mm", "bottom": "8mm", "left": "10mm", "right": "10mm"}
        )
        page.pdf(
            path=PUBLIC_PDF_PATH,
            format="A4",
            print_background=True,
            margin={"top": "8mm", "bottom": "8mm", "left": "10mm", "right": "10mm"}
        )
        page.screenshot(path=PNG_PATH, full_page=True)
        browser.close()
    print("PDF created successfully at:", PDF_PATH)

if __name__ == "__main__":
    generate_pdf()
