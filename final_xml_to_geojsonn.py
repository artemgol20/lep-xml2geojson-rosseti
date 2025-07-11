import logging
import xml.etree.ElementTree as ET
import json
from collections import defaultdict

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Константы для типов объектов
GUID_VL_LEP = 'c0c2ac9d-fcee-11e1-8837-20cf30e80dd7'  # ЛЭП
GUID_UCHASTOK = 'c0c2ad20-fcee-11e1-8837-20cf30e80dd7'  # Участок
GUID_PROLET = 'c0c2acd0-fcee-11e1-8837-20cf30e80dd7'  # Пролет
GUID_OPORA = 'c0c2aca6-fcee-11e1-8837-20cf30e80dd7'  # Опора

# GUID для координат
GUID_LAT = '9a326f2d-0841-11e6-80f2-001b21b9eac9'
GUID_LON = 'b53e5884-0841-11e6-80f2-001b21b9eac9'

# Вспомогательная функция для получения текста из элемента
def get_text(element, tag):
    found = element.find(tag)
    return found.text if found is not None else None

# Функция для извлечения координат из статических характеристик
def extract_coordinates(static_params):
    lat = lon = None
    if static_params is not None:
        for row in static_params.findall('Row'):
            characteristic = get_text(row, 'Характеристика')
            value = get_text(row, 'Значение')
            if characteristic == GUID_LAT and value:
                lat = float(value.replace('N', '').replace('S', '-'))
            elif characteristic == GUID_LON and value:
                lon = float(value.replace('E', '').replace('W', '-'))
    return lat, lon

# Основная функция для обработки XML и создания GeoJSON
def process_xml_to_geojson(input_file):
    try:
        tree = ET.parse(input_file)
        root = tree.getroot()
    except FileNotFoundError:
        logging.error("Файл '%s' не найден.", input_file)
        return
    except ET.ParseError:
        logging.error("Ошибка парсинга '%s'.", input_file)
        return

    # Словарь для хранения объектов по их Ref
    objects_by_ref = {get_text(obj, 'Ref'): obj for obj in root.findall('.//CatalogObject.урскСтруктураСети') if get_text(obj, 'Ref')}
    logging.info("Спарсено %d объектов из '%s'", len(objects_by_ref), input_file)
    with open('objects_by_ref.json', 'w', encoding='utf-8') as f:
        json.dump({ref: {'Description': get_text(obj, 'Description'), 'ВидТехническогоМеста': get_text(obj, 'ВидТехническогоМеста')} for ref, obj in objects_by_ref.items()}, f, indent=2, ensure_ascii=False)

    # Разделение объектов по категориям
    lep_objects = {}
    uchastok_objects = defaultdict(list)
    prolet_objects = defaultdict(list)
    opora_objects = {}

    for ref, obj in objects_by_ref.items():
        vid_teh_mesta = get_text(obj, 'ВидТехническогоМеста')
        if vid_teh_mesta == GUID_VL_LEP:
            lep_objects[ref] = obj
        elif vid_teh_mesta == GUID_UCHASTOK:
            parent = get_text(obj, 'Parent')
            if parent and parent != '00000000-0000-0000-0000-000000000000':
                uchastok_objects[parent].append(obj)
        elif vid_teh_mesta == GUID_PROLET:
            parent = get_text(obj, 'Parent')
            if parent and parent != '00000000-0000-0000-0000-000000000000':
                prolet_objects[parent].append(obj)
        elif vid_teh_mesta == GUID_OPORA:
            opora_objects[ref] = obj

    logging.info("Найдено %d ЛЭП, %d участков, %d пролетов, %d опор", len(lep_objects), sum(len(v) for v in uchastok_objects.values()), sum(len(v) for v in prolet_objects.values()), len(opora_objects))
    with open('categorized_objects.json', 'w', encoding='utf-8') as f:
        json.dump({
            'lep_objects': list(lep_objects.keys()),
            'uchastok_objects': {k: [get_text(u, 'Ref') for u in v] for k, v in uchastok_objects.items()},
            'prolet_objects': {k: [get_text(p, 'Ref') for p in v] for k, v in prolet_objects.items()},
            'opora_objects': list(opora_objects.keys())
        }, f, indent=2, ensure_ascii=False)

    # Фильтрация валидных объектов
    # 1. Валидные опоры (только с координатами)
    valid_supports = set()
    for opora_ref, opora_obj in opora_objects.items():
        coords = extract_coordinates(opora_obj.find('СтатическиеХарактеристики'))
        if coords and all(coords):
            valid_supports.add(opora_ref)
    logging.info("Найдено %d валидных опор с координатами", len(valid_supports))
    with open('valid_supports.json', 'w', encoding='utf-8') as f:
        json.dump(list(valid_supports), f, indent=2)

    # 2. Валидные пролеты (только с опорами, у которых есть координаты)
    valid_spans = set()
    for uchastok_ref, prolets in prolet_objects.items():
        for prolet in prolets:
            prolet_ref = get_text(prolet, 'Ref')
            nach_opora_ref = get_text(prolet, 'НачальнаяОпора')
            kon_opora_ref = get_text(prolet, 'КонечнаяОпора')
            if nach_opora_ref in valid_supports and kon_opora_ref in valid_supports:
                valid_spans.add(prolet_ref)
    logging.info("Найдено %d валидных пролетов", len(valid_spans))
    with open('valid_spans.json', 'w', encoding='utf-8') as f:
        json.dump(list(valid_spans), f, indent=2)

    # 3. Валидные участки (только с хотя бы одним валидным пролетом)
    valid_sections = set()
    for uchastok_ref, prolets in prolet_objects.items():
        if any(get_text(prolet, 'Ref') in valid_spans for prolet in prolets):
            valid_sections.add(uchastok_ref)
    logging.info("Найдено %d валидных участков", len(valid_sections))
    with open('valid_sections.json', 'w', encoding='utf-8') as f:
        json.dump(list(valid_sections), f, indent=2)

    # 4. Валидные ЛЭП (только с хотя бы одним валидным участком)
    valid_power_lines = set()
    for lep_ref, lep_obj in lep_objects.items():
        lep_guid = get_text(lep_obj, 'гуид')
        if lep_guid and lep_guid != '00000000-0000-0000-0000-000000000000':
            uchastki = [get_text(uchastok, 'Ref') for uchastok in uchastok_objects.get(lep_guid, []) if get_text(uchastok, 'Ref') in valid_sections]
            if uchastki:
                valid_power_lines.add(lep_ref)
    logging.info("Найдено %d валидных ЛЭП", len(valid_power_lines))
    with open('valid_power_lines.json', 'w', encoding='utf-8') as f:
        json.dump(list(valid_power_lines), f, indent=2)

    # Построение GeoJSON features
    features = []

    # Добавление валидных опор
    for opora_ref in valid_supports:
        opora_obj = opora_objects[opora_ref]
        opora_name = get_text(opora_obj, 'Description')
        coords = extract_coordinates(opora_obj.find('СтатическиеХарактеристики'))
        features.append({
            "type": "Feature",
            "properties": {
                "ref": opora_ref,
                "name": opora_name,
                "type": "pylons"
            },
            "geometry": {
                "type": "Point",
                "coordinates": [coords[1], coords[0]]  # [lon, lat]
            }
        })
    logging.info("Добавлено %d опор в features", len(valid_supports))

    # Добавление валидных пролетов
    for uchastok_ref, prolets in prolet_objects.items():
        for prolet in prolets:
            prolet_ref = get_text(prolet, 'Ref')
            if prolet_ref not in valid_spans:
                continue
            nach_opora_ref = get_text(prolet, 'НачальнаяОпора')
            kon_opora_ref = get_text(prolet, 'КонечнаяОпора')
            nach_opora = opora_objects.get(nach_opora_ref)
            kon_opora = opora_objects.get(kon_opora_ref)
            if nach_opora is None or kon_opora is None:  # Исправлено для устранения DeprecationWarning
                continue
            nach_coords = extract_coordinates(nach_opora.find('СтатическиеХарактеристики'))
            kon_coords = extract_coordinates(kon_opora.find('СтатическиеХарактеристики'))
            if not all(nach_coords) or not all(kon_coords):
                continue
            prolet_name = get_text(prolet, 'Description')
            features.append({
                "type": "Feature",
                "properties": {
                    "ref": prolet_ref,
                    "name": prolet_name,
                    "type": "span",
                    "relations": [
                        {"objectId": nach_opora_ref},
                        {"objectId": kon_opora_ref}
                    ]
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [nach_coords[1], nach_coords[0]],
                        [kon_coords[1], kon_coords[0]]
                    ]
                }
            })

    # Добавление валидных участков
    for lep_guid, uchastki in uchastok_objects.items():
        for uchastok in uchastki:
            uchastok_ref = get_text(uchastok, 'Ref')
            if uchastok_ref not in valid_sections:
                continue
            uchastok_name = get_text(uchastok, 'Description')
            prolets = [get_text(prolet, 'Ref') for prolet in prolet_objects.get(uchastok_ref, []) if get_text(prolet, 'Ref') in valid_spans]
            if prolets:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "ref": uchastok_ref,
                        "name": uchastok_name,
                        "type": "lines",
                        "relations": [{"objectId": prolet} for prolet in prolets]
                    },
                    'geometry': None
                })

    # Добавление валидных ЛЭП
    for lep_ref in valid_power_lines:
        lep_obj = lep_objects[lep_ref]
        lep_guid = get_text(lep_obj, 'гуид')
        lep_name = get_text(lep_obj, 'Description')
        uchastki = [get_text(uchastok, 'Ref') for uchastok in uchastok_objects.get(lep_guid, []) if get_text(uchastok, 'Ref') in valid_sections]
        if uchastki:
            features.append({
                "type": "Feature",
                "properties": {
                    "ref": lep_ref,
                    "name": lep_name,
                    "type": "fulllines",
                    "relations": [{"objectId": uchastok} for uchastok in uchastki]
                },
                'geometry': None
            })

    logging.info("Сгенерировано %d features", len(features))
    with open('features.json', 'w', encoding='utf-8') as f:
        json.dump(features, f, indent=2, ensure_ascii=False)

    # Создание GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # Запись в файл
    try:
        with open('output.geojson', 'w', encoding='utf-8') as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        logging.info("Записан GeoJSON в 'output.geojson' с %d features", len(features))
    except IOError as e:
        logging.error("Ошибка записи GeoJSON: %s", e)

if __name__ == '__main__':
    process_xml_to_geojson('ЛЭП.xml')  # Укажите путь к вашему XML-файлу