import os
import re
import shutil
import subprocess
import fitz

def generate_blank_waybill():
    src_html = r"c:\salda\pl_preview.html"
    with open(src_html, "r", encoding="utf-8") as f:
        html = f.read()

    # Скрываем верхнюю панель кнопок и убираем фон для печати
    blank_html = html.replace(".print-hide {", ".print-hide { display: none !important;")
    blank_html = blank_html.replace("background: #1e293b;", "background: #ffffff;")
    blank_html = blank_html.replace("box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);", "box-shadow: none;")
    blank_html = blank_html.replace("padding: 10px 0;", "padding: 0;")

    # Очищаем все заполняемые поля contenteditable='true', оставляя чистый бланк
    blank_html = re.sub(
        r'(<span[^>]*class=["\'][^"\']*editable-field[^"\']*["\'][^>]*>).*?(</span>)',
        r'\1\2',
        blank_html,
        flags=re.DOTALL
    )
    blank_html = re.sub(
        r'(<div[^>]*class=["\'][^"\']*editable-field[^"\']*["\'][^>]*>).*?(</div>)',
        r'\1\2',
        blank_html,
        flags=re.DOTALL
    )

    temp_html = r"c:\salda\waybill_4c_blank_temp.html"
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(blank_html)

    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    pdf_out = r"c:\salda\waybill_4c_blank_landscape.pdf"
    jpg_out = r"c:\salda\waybill_4c_blank_landscape.jpg"

    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_out}",
        temp_html
    ]
    subprocess.run(cmd, check=True)

    # Рендерим PDF в 300 DPI JPG через PyMuPDF
    doc = fitz.open(pdf_out)
    page = doc[0]
    pix = page.get_pixmap(dpi=300)
    pix.save(jpg_out)
    page_count = len(doc)
    doc.close()

    if os.path.exists(temp_html):
        os.remove(temp_html)

    # Копируем в web/public
    shutil.copy(pdf_out, r"c:\salda\apps\web\public\waybill_4c_blank_landscape.pdf")
    shutil.copy(jpg_out, r"c:\salda\apps\web\public\waybill_4c_blank_landscape.jpg")

    print(f"Generated successfully: {page_count} page(s).")
    print(f"JPG size: {pix.width}x{pix.height} px at 300 DPI.")

if __name__ == "__main__":
    generate_blank_waybill()
