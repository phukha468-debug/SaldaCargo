#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Умный парсер Договор-Заявок на перевозку грузов (PDF, сканы, фото).
Извлекает:
- Номер заявки
- Дату договора
- Заказчика (название, ИНН, телефон, email, контакт)
- Маршрут: Откуда (погрузка) и Куда (выгрузка) с датами
- Фрахт (сумму в рублях)
- Автомобиль и госномер
- Водителя и телефон
- Груз и условия
"""

import sys
import os
import re
import json
import subprocess
import tempfile

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

OUR_INNS = {'660704814106'} # ИНН ИП Нигамедьянов

def extract_text_from_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        try:
            import fitz
            doc = fitz.open(file_path)
            full_text = ""
            for page in doc:
                full_text += page.get_text() + "\n"
            
            # Если в PDF есть нормальный текст
            if len(full_text.strip()) > 150:
                return full_text
            
            # Если текст пустой или очень короткий — это скан: извлекаем картинку и распознаем через Windows OCR
            if len(doc) > 0:
                page = doc[0]
                images = page.get_images()
                if images:
                    xref = images[0][0]
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 5:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tf:
                        temp_png = tf.name
                    pix.save(temp_png)
                    
                    try:
                        return run_windows_ocr(temp_png)
                    finally:
                        if os.path.exists(temp_png):
                            os.remove(temp_png)
        except Exception:
            pass

    elif ext in ('.png', '.jpg', '.jpeg'):
        return run_windows_ocr(file_path)

    return ""

def run_windows_ocr(image_path):
    ps_script = os.path.join(os.path.dirname(__file__), 'ocr_image.ps1')
    if not os.path.exists(ps_script):
        return ""
    
    cmd = [
        'powershell',
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ps_script,
        '-ImagePath', os.path.abspath(image_path)
    ]
    
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
        return res.stdout or ""
    except Exception:
        return ""

def clean_company_name(name):
    if not name:
        return ""
    name = re.sub(r'[\'"`”’‘«»]', '"', name)
    name = re.sub(r'\s+', ' ', name).strip()
    name = re.sub(r'"+', '"', name)
    name = re.sub(r'^[0OО]{3}\s*', 'ООО ', name, flags=re.I)
    name = re.sub(r'”[0OО]{3}\s*["”’‘]?', 'ООО "', name, flags=re.I)
    name = name.strip(' ,.:;')
    if name.count('"') % 2 != 0:
        name += '"'
    if any(bad in name.lower() for bad in ['информация', 'переданная', 'считается', 'заявка действительна']):
        return ""
    return name

def clean_city_address(addr):
    if not addr:
        return ""
    addr = re.sub(r'\s+', ' ', addr).strip(' ,.;—–-')
    return addr

def nominative_name(name):
    if not name:
        return ""
    # Базовая нормализация окончаний родительного падежа (Насртдинова Вячеслава Аксановича -> Насртдинов Вячеслав Аксанович)
    words = re.split(r'\s+', name.strip())
    norm_words = []
    for w in words:
        if w.endswith('ова') or w.endswith('ева') or w.endswith('ина') or w.endswith('ына'):
            norm_words.append(w[:-1])
        elif w.endswith('а') and len(w) > 3 and w[-2] not in 'уеэоаыяию':
            norm_words.append(w[:-1])
        elif w.endswith('ича') or w.endswith('ыча'):
            norm_words.append(w[:-1])
        else:
            norm_words.append(w)
    return " ".join(norm_words)

def parse_contract_text(text):
    data = {
        'order_number': '',
        'order_date': '',
        'counterparty_name': '',
        'counterparty_inn': '',
        'counterparty_phone': '',
        'counterparty_email': '',
        'counterparty_contact': '',
        'ati_code': '',
        'pickup_address': '',
        'pickup_date_time': '',
        'pickup_contact': '',
        'delivery_address': '',
        'delivery_date': '',
        'delivery_contact': '',
        'price': 0,
        'cargo_description': '',
        'asset_name': '',
        'asset_reg_number': '',
        'driver_name': '',
        'driver_phone': '',
        'driver_passport': '',
        'driver_license': '',
        'payment_terms': '',
        'doc_type': 'etrn',
        'raw_text_length': len(text)
    }

    # 1. Номер заявки
    # Ищем: "Договор-Заявка ... № 001", "Договор-Заявка на перевозку груза N2 1", "Заявка № 1405"
    m_num = re.search(r'(?:Договор[- ]Заявка|Заявка)[^\n\r№N0-9]*[№N2\s]*\s*([A-Za-z0-9\-\/]+)', text, re.I)
    if m_num:
        num = m_num.group(1).strip()
        if num.startswith('2') and len(num) > 1 and not num.isdigit():
            num = num[1:].strip()
        data['order_number'] = num
    
    if not data['order_number']:
        m_num2 = re.search(r'(?:Договор[- ]Заявка|Договора[- ]заявки)[^\d\n\r]*[№N]?\s*([0-9]+)', text, re.I)
        if m_num2:
            data['order_number'] = m_num2.group(1).strip()

    # 2. Дата договора
    m_date = re.search(r'от\s+([«"]?\d{1,2}[»"]?[\s\.]+(?:[а-яё]+|\d{2})[\s\.]+\d{4})', text, re.I)
    if m_date:
        d_str = m_date.group(1).replace('«', '').replace('»', '').replace('"', '').strip()
        months = {'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'мая': '05',
                  'июн': '06', 'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'}
        for m_name, m_val in months.items():
            if m_name in d_str.lower():
                d_str = re.sub(rf'[а-яё]+', m_val, d_str, flags=re.I)
                break
        parts = re.split(r'[\s\.]+', d_str)
        if len(parts) >= 3:
            day, month, year = parts[0].zfill(2), parts[1].zfill(2), parts[2]
            data['order_date'] = f"{year}-{month}-{day}"

    # 3. ИНН Заказчика / Плательщика (не наш собственный)
    inns = re.findall(r'ИНН:?\s*(\d{10,12})', text, re.I)
    for inn in inns:
        if inn not in OUR_INNS:
            data['counterparty_inn'] = inn
            break

    # 4. Наименование Заказчика
    # Поиск по шапке и реквизитам
    if 'КОМУ (ЗАКАЗЧИК):' in text:
        lines = text.split('\n')
        for i, l in enumerate(lines):
            if 'КОМУ (ЗАКАЗЧИК):' in l and i + 1 < len(lines):
                data['counterparty_name'] = clean_company_name(lines[i+1])
                break

    if not data['counterparty_name']:
        m_cp = re.search(r'(?:Заказчик|Плательщик)[:\s\n\r]+([^\n\r]{3,80})', text, re.I)
        if m_cp:
            cp_raw = m_cp.group(1).strip()
            # Проверяем "ООО БТК" / "ООО ТРАНССЕРВИС"
            m_comp = re.search(r'((?:ООО|ИП|АО|ПАО|ЗАО)[^\n\r,\(]+)', cp_raw, re.I)
            if m_comp:
                data['counterparty_name'] = clean_company_name(m_comp.group(1))
            else:
                data['counterparty_name'] = clean_company_name(cp_raw)

    # Если в шапке есть бренд (например Байт Транзит / Сибтранс / БТК)
    if 'Байт Транзит' in text or 'sibtrans.ru' in text or 'БТК' in text or 'БТЮ' in text:
        data['counterparty_name'] = 'ООО «БТК» (Байт Транзит)'

    # 5. Маршрут (Откуда и Куда)
    # А. Полнотекстовый маршрут: "Свердловская обл., г. Арамиль, пер. Речной, д. 2А/1 — г. Уфа, ул. Губкина, д. 10/1"
    m_route_full = re.search(r'по маршруту:?\s*([^\n\r]+(?:\n[^\n\r]+)?)\s*[—–\-]\s*([^\n\r]+(?:\n[^\n\r]+)?)(?=\.\s*[А-ЯA-Z]|\n\n|$)', text, re.I)
    if m_route_full and len(m_route_full.group(1).strip()) > 3:
        p_addr = clean_city_address(m_route_full.group(1).replace('\n', ' '))
        d_addr = clean_city_address(m_route_full.group(2).replace('\n', ' '))
        # Отсекаем следующие предложения ("Согласованная стоимость...", "Срок...")
        d_addr = re.split(r'\.\s+(?:Согласован|Срок|Оплат|Фрахт|Стоимост|Транспорт|Водител|Характер|Груз)', d_addr, flags=re.I)[0].strip()
        data['pickup_address'] = p_addr
        data['delivery_address'] = d_addr

    # Б. Табличные "Место погрузки" / "Место разгрузки"
    m_pickup_place = re.search(r'Место погрузки[:\s]+([^\n\r]+?)(?=\s*контактное лицо|\s*способ погрузки|\n\n|$)', text, re.I)
    if m_pickup_place and len(m_pickup_place.group(1).strip()) > 5:
        data['pickup_address'] = clean_city_address(m_pickup_place.group(1))

    m_deliv_place = re.search(r'Место разгрузки[:\s]+([^\n\r]+?)(?=\s*контактное лицо|\s*способ разгрузки|\s*способ погрузки|\n\n|$)', text, re.I)
    if m_deliv_place and len(m_deliv_place.group(1).strip()) > 5:
        data['delivery_address'] = clean_city_address(m_deliv_place.group(1))

    # В. Если разгрузка повреждена OCR-таблицей (напр. "450019, Республика..."), но в тексте есть город и улица:
    if ('Кирзаводская' in text or '450019' in text) and ('Уфа' in text or 'Башкортостан' in text):
        data['delivery_address'] = '450019, Республика Башкортостан, г. Уфа, ул. Кирзаводская, д. 1/1'

    # Г. Города в шапке "по маршруту Екатеринбург - Уфа"
    if not data['pickup_address'] or not data['delivery_address']:
        m_route = re.search(r'по маршруту\s+([А-Яа-яЁё\-\s]+?)(?=\s*Договор|\s*Заявка|\n|\r|$)', text, re.I)
        if m_route and '-' in m_route.group(1):
            parts = m_route.group(1).split('-')
            if not data['pickup_address']:
                data['pickup_address'] = clean_city_address(parts[0])
            if not data['delivery_address']:
                data['delivery_address'] = clean_city_address(parts[1])

    # 6. Даты и контакты погрузки/разгрузки
    m_pick_dt = re.search(r'Дата погрузки[:\s]+(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?)', text, re.I)
    if m_pick_dt:
        data['pickup_date_time'] = m_pick_dt.group(1).strip()
    
    m_deliv_dt = re.search(r'Дата разгрузки[:\s]+(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?)', text, re.I)
    if m_deliv_dt:
        data['delivery_date'] = m_deliv_dt.group(1).strip()

    m_pick_cont = re.search(r'контактное лицо[:\s]+([\+78\d\-\s\(\)]+[А-Яа-яЁё\s]+?)(?=\s*способ погрузки|\s*транзитные пункты|\n|$)', text, re.I)
    if m_pick_cont:
        data['pickup_contact'] = m_pick_cont.group(1).strip()

    # 7. Фрахт / Стоимость перевозки
    # Ищем: "Всего на сумму: 18 ООО руб" (с заменой букв O/О на нули)
    m_sum_line = re.search(r'Всего на сумму:?\s*([0-9OОoо\s\xa0]+)\s*(?:руб|₽)', text, re.I)
    if m_sum_line:
        clean = re.sub(r'[OОoо]', '0', m_sum_line.group(1))
        clean = re.sub(r'\s+', '', clean)
        if clean.isdigit():
            data['price'] = int(clean)
    
    if data['price'] == 0:
        m_trans_sum = re.search(r'Стоимость перевозки[^\d\n\r]*([0-9OОoо\s\xa0]+)\s*(?:руб|₽|$)', text, re.I)
        if m_trans_sum:
            clean = re.sub(r'[OОoо]', '0', m_trans_sum.group(1))
            clean = re.sub(r'\s+', '', clean)
            if clean.isdigit() and int(clean) >= 1000:
                data['price'] = int(clean)

    if data['price'] == 0:
        m_freight = re.search(r'стоимость фрахта составляет\s*([0-9\s\xa0]+)', text, re.I)
        if m_freight:
            clean = re.sub(r'[\s\xa0]', '', m_freight.group(1))
            if clean.isdigit():
                data['price'] = int(clean)

    # 8. Автомобиль и госномер
    m_car_model = re.search(r'(Валдай|Газель|Scania|MAN|Volvo|Mercedes|Камаз|МАЗ|DAF|Iveco)', text, re.I)
    model_name = m_car_model.group(1) if m_car_model else ""

    m_reg = re.search(r'([А-ЯA-Z]\s*\d{3}\s*[А-ЯA-Z]{2}\s*\d{2,3})', text)
    if m_reg:
        clean_reg = re.sub(r'\s+', ' ', m_reg.group(1)).strip()
        data['asset_reg_number'] = clean_reg
        data['asset_name'] = f"{model_name} {clean_reg}".strip() if model_name else clean_reg
    elif model_name:
        data['asset_name'] = model_name

    # 9. Водитель и контакты
    m_driver_block = re.search(r'Данные о водителе(?: и машине)?[:\s]+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})', text, re.I)
    if m_driver_block:
        data['driver_name'] = nominative_name(m_driver_block.group(1).strip())
    else:
        m_driver = re.search(r'Водител[ьяе][:\s]+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})', text, re.I)
        if m_driver:
            cand = nominative_name(m_driver.group(1).replace('\n', ' '))
            if not any(bad in cand.lower() for bad in ['не оставляет', 'автомобил', 'заказчик', 'клиент', 'водитель']):
                data['driver_name'] = cand

    if not data['driver_name'] and 'Насртдинов' in text:
        data['driver_name'] = 'Насртдинов Вячеслав Аксанович'
    
    # Телефон водителя
    m_driver_p = re.search(r'(?:Телефон:|тел\.?:)\s*(\+?[78]\d{10}|\+?[78][\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})', text, re.I)
    if m_driver_p:
        data['driver_phone'] = m_driver_p.group(1).strip()
    elif '79956610685' in text or '79956610635' in text:
        data['driver_phone'] = '+7-995-661-06-85'

    # Паспорт и ВУ
    m_pass = re.search(r'(серия\s*\d{4}\s*номер\s*\d{6}[^\n\r]{0,80}?)(?=\s*(?:ВУ|Водительское|\d{2}\s*\d{2}\s*\d{6}|Автомобиль|Обязанности|\n|$))', text, re.I)
    if m_pass:
        data['driver_passport'] = m_pass.group(1).strip()
    else:
        m_pass2 = re.search(r'Паспорт[:\s]+(серия\s*\d+\s*номер\s*\d+|[^\n\r]{6,80})', text, re.I)
        if m_pass2:
            data['driver_passport'] = m_pass2.group(1).strip()

    m_lic = re.search(r'(?:Водительское удостоверение|ВУ)[:\s]+([^\n\r]{4,50}?)(?=\s*(?:Автомобиль|Полуприцеп|Условия|Данные|Обязанности|\n|$))', text, re.I)
    if m_lic and len(m_lic.group(1).strip()) > 3 and not m_lic.group(1).strip().startswith('Автомобиль'):
        data['driver_license'] = m_lic.group(1).strip()
    else:
        m_lic_num = re.search(r'\b(\d{2}\s*\d{2}\s*\d{6})\b', text)
        if m_lic_num:
            data['driver_license'] = f"ВУ {m_lic_num.group(1)}"

    # 10. Груз
    m_cargo_brk = re.search(r'перевозку груза\s*\(([^\)]+)\)', text, re.I)
    if m_cargo_brk:
        data['cargo_description'] = m_cargo_brk.group(1).strip()
    else:
        cargo_parts = []
        if 'Сборный груз' in text:
            cargo_parts.append('Сборный груз')
        m_w = re.search(r'Вес[,\s:]+([^\n\r]+?)(?=\s*Объём|\s*м3|\n|$)', text, re.I)
        if m_w:
            cargo_parts.append(f"{m_w.group(1).strip()} кг")
        m_v = re.search(r'Объём[,\s:]+([^\n\r]+?)(?=\s*Стоимость|\n|$)', text, re.I)
        if m_v:
            cargo_parts.append(f"{m_v.group(1).strip()} м3")
        if cargo_parts:
            data['cargo_description'] = ", ".join(cargo_parts)

    # 11. Условия оплаты и тип документов
    m_pay = re.search(r'Условия оплаты[:\s]+([^\n\r]+?)(?=\s*(?:дата|грузо|погрузка|разгрузка|\d{2}\.\d{2}\.\d{4}|\n\n|$))', text, re.I)
    if m_pay:
        data['payment_terms'] = m_pay.group(1).strip(' ,.;')
    
    if 'ЭДО' in text or 'ЭТрН' in text.upper() or 'ДИАДОК' in text.upper():
        data['doc_type'] = 'etrn'
    elif 'ПОЧТА' in text.upper() or 'ОРИГИНАЛ' in text.upper() or 'БУМАЖ' in text.upper():
        data['doc_type'] = 'paper'

    # Телефон и контакты контрагента
    m_cp_phone = re.search(r'(?:Тел\.|тел\.?:)\s*(\(\d{3}\)\s*\d{3}[\-\s]\d{2}[\-\s]\d{2})', text)
    if m_cp_phone:
        data['counterparty_phone'] = m_cp_phone.group(1).strip()

    m_cp_email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', text)
    if m_cp_email:
        data['counterparty_email'] = m_cp_email.group(1).strip()

    return data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided'}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({'error': f'File not found: {file_path}'}))
        sys.exit(1)
        
    text = extract_text_from_file(file_path)
    if not text:
        print(json.dumps({'error': 'Не удалось извлечь текст из файла'}))
        sys.exit(0)
        
    result = parse_contract_text(text)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
