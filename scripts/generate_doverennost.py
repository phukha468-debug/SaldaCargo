import os
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = docx.Document()

# Margins
for section in doc.sections:
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

# Header: IP details
header_lines = [
    ('Индивидуальный предприниматель Нигамедьянов Александр Сергеевич', True, Pt(11)),
    ('Юр. адрес: 624760, Россия, Свердловская обл., г. Верхняя Салда, ул. 25 Октября, д. 11, кв. 22', False, Pt(9.5)),
    ('ИНН 660704814106 | ОГРНИП 321665800053976', False, Pt(9.5)),
    ('Р/С 40802810500001961654 в АО «ТБанк»', False, Pt(9.5)),
    ('К/С 30101810145250000974 | БИК 044525974', False, Pt(9.5)),
    ('Тел: +7 (922) 180-09-11 | Email: uralavto707@mail.ru', False, Pt(9.5))
]

for text, is_bold, sz in header_lines:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(1.5)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(text)
    run.bold = is_bold
    run.font.size = sz

doc.add_paragraph().paragraph_format.space_after = Pt(10)

# Title: ДОВЕРЕННОСТЬ
title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_p.paragraph_format.space_before = Pt(6)
title_p.paragraph_format.space_after = Pt(12)
r_title = title_p.add_run('ДОВЕРЕННОСТЬ')
r_title.bold = True
r_title.font.size = Pt(14)

# Date and city line
date_p = doc.add_paragraph()
date_p.paragraph_format.space_after = Pt(12)
r_city = date_p.add_run('г. Верхняя Салда / г. Екатеринбург')
r_city.font.size = Pt(10.5)
r_space = date_p.add_run(' ' * 50)
r_date = date_p.add_run('«15» октября 2026 г.')
r_date.bold = True
r_date.font.size = Pt(10.5)

# Body text
p_body = doc.add_paragraph()
p_body.paragraph_format.space_before = Pt(6)
p_body.paragraph_format.space_after = Pt(10)
p_body.paragraph_format.line_spacing = 1.25
p_body.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

p_body.add_run('Настоящая доверенность выдана гражданину РФ ')
r_dr = p_body.add_run('Насртдинову Вячеславу Аксановичу')
r_dr.bold = True
p_body.add_run(', паспорт серия ')
r_ser = p_body.add_run('6521')
r_ser.bold = True
p_body.add_run(' номер ')
r_num = p_body.add_run('342609')
r_num.bold = True
p_body.add_run(', выдан ')
r_giv = p_body.add_run('27.07.2021 г. ГУ МВД России по Свердловской области')
r_giv.bold = True
p_body.add_run(', водительское удостоверение № ')
r_lic = p_body.add_run('99 31 051064')
r_lic.bold = True
p_body.add_run(', управляющему автомобилем ')
r_car = p_body.add_run('Валдай (гос. номер О 188 ТА 196)')
r_car.bold = True
p_body.add_run(', в том, что он уполномочен совершать от имени Индивидуального предпринимателя Нигамедьянова Александра Сергеевича в ')
r_org = p_body.add_run('ООО «Байт Транзит Континент» (ООО «БТК»)')
r_org.bold = True
p_body.add_run(' следующие операции:')

# Powers
powers = [
    'Сдавать и получать грузы для транспортировки;',
    'Подписывать заявки на транспортировку груза, транспортные накладные (ТрН / ТТН), акты выполненных работ (оказанных услуг), акты сдачи-приемки груза, а также совершать все иные действия и формальности, связанные с выполнением настоящего поручения.'
]

for i, p_text in enumerate(powers, 1):
    item_p = doc.add_paragraph()
    item_p.paragraph_format.left_indent = Inches(0.3)
    item_p.paragraph_format.space_before = Pt(3)
    item_p.paragraph_format.space_after = Pt(4)
    item_p.paragraph_format.line_spacing = 1.2
    item_p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_num = item_p.add_run(f'{i}. ')
    r_num.bold = True
    item_p.add_run(p_text)

# Validity
p_val = doc.add_paragraph()
p_val.paragraph_format.space_before = Pt(14)
p_val.paragraph_format.space_after = Pt(20)
p_val.add_run('Настоящая доверенность выдана 15.10.2026 г. и действительна по 31.12.2026 г. включительно без права передоверия.')

# Specimen signature
p_sig = doc.add_paragraph()
p_sig.paragraph_format.space_before = Pt(10)
p_sig.paragraph_format.space_after = Pt(20)
p_sig.add_run('Образец подписи доверенного лица: ____________________ / ')
r_dr_sig = p_sig.add_run('Насртдинов В. А.')
r_dr_sig.bold = True
p_sig.add_run(' / подтверждаю.')

doc.add_paragraph().paragraph_format.space_after = Pt(16)

# Principal signature
p_prin = doc.add_paragraph()
p_prin.paragraph_format.space_before = Pt(10)
p_prin.paragraph_format.space_after = Pt(4)
p_prin.add_run('Индивидуальный предприниматель: _________________ / ')
r_ip_name = p_prin.add_run('Нигамедьянов А. С.')
r_ip_name.bold = True
p_prin.add_run(' /')

p_mp = doc.add_paragraph()
p_mp.paragraph_format.space_before = Pt(6)
p_mp.paragraph_format.left_indent = Inches(2.2)
r_mp = p_mp.add_run('М.П.')
r_mp.bold = True
r_mp.font.size = Pt(10)

# Save both translit and cyrillic filenames
for filename in ['Doverennost_Voditel_Bayt_Tranzit.docx', 'Доверенность_на_водителя_Байт_Транзит.docx']:
    full_path = os.path.join(r'c:\salda', filename)
    doc.save(full_path)
    print(f'Successfully saved: {filename}')

# Remove garbage file if exists
for f in os.listdir(r'c:\salda'):
    if f.endswith('.docx') and '' in f:
        try:
            os.remove(os.path.join(r'c:\salda', f))
            print(f'Removed corrupted name file: {f}')
        except:
            pass
