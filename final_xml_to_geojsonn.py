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

# Функция для парсинга классов напряжения
def parse_voltage_classes(voltage_file):
    try:
        tree = ET.parse(voltage_file)
        root = tree.getroot()
        voltage_classes = {}
        for row in root.findall('.//CatalogObject.урскКлассыНапряжений'):
            ref = get_text(row, 'Ref')
            name = get_text(row, 'Description')
            voltage = get_text(row, 'Значение')
            if ref and name and voltage:
                try:
                    voltage_value = float(str(voltage).replace(',', '.'))
                except Exception:
                    voltage_value = None
                voltage_classes[ref] = {'name': name, 'voltage': voltage_value}
        logging.info("Спарсено %d классов напряжения из '%s'", len(voltage_classes), voltage_file)
        return voltage_classes
    except FileNotFoundError:
        logging.error("Файл '%s' не найден.", voltage_file)
        return {}
    except ET.ParseError:
        logging.error("Ошибка парсинга '%s'.", voltage_file)
        return {}

# Основная функция для обработки XML и создания GeoJSON
def process_xml_to_geojson(input_file, voltage_file='Классы_напряжения.xml', output_file='output.geojson', log_file='missing_coordinates.log'):
    # Парсинг классов напряжения
    voltage_classes = parse_voltage_classes(voltage_file)

    # Парсинг основного XML файла
    try:
        tree = ET.parse(input_file)
        root = tree.getroot()
    except FileNotFoundError:
        logging.error("Файл '%s' не найден.", input_file)
        return
    except ET.ParseError:
        logging.error("Ошибка парсинга '%s'.", input_file)
        return

    # Словарь объектов по Ref
    objects_by_ref = {get_text(obj, 'Ref'): obj for obj in root.findall('.//CatalogObject.урскСтруктураСети') if get_text(obj, 'Ref')}
    logging.info("Спарсено %d объектов из '%s'", len(objects_by_ref), input_file)

    # Категоризация объектов
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

    logging.info("Найдено %d ЛЭП, %d участков, %d пролетов, %d опор", 
                 len(lep_objects), sum(len(v) for v in uchastok_objects.values()), 
                 sum(len(v) for v in prolet_objects.values()), len(opora_objects))

    # Фильтрация валидных объектов
    valid_supports = set()
    missing_coords_supports = []
    for opora_ref, opora_obj in opora_objects.items():
        coords = extract_coordinates(opora_obj.find('СтатическиеХарактеристики'))
        if coords and all(coords):
            valid_supports.add(opora_ref)
        else:
            opora_name = get_text(opora_obj, 'Description')
            missing_coords_supports.append((opora_ref, opora_name))
    logging.info("Найдено %d валидных опор с координатами", len(valid_supports))

    # Запись в лог-файл опор без координат
    with open(log_file, 'w', encoding='utf-8') as f:
        for ref, name in missing_coords_supports:
            f.write(f"Опора '{name}' (Ref: {ref}) не имеет координат и не будет добавлена в GeoJSON.\n")
    logging.info("Обнаружено %d опор без координат, записано в '%s'", len(missing_coords_supports), log_file)

    # Валидные пролеты
    valid_spans = set()
    for ref, prolets in prolet_objects.items():
        for prolet in prolets:
            prolet_ref = get_text(prolet, 'Ref')
            nach_opora_ref = get_text(prolet, 'НачальнаяОпора')
            kon_opora_ref = get_text(prolet, 'КонечнаяОпора')
            if nach_opora_ref in valid_supports and kon_opora_ref in valid_supports:
                valid_spans.add(prolet_ref)
    logging.info("Найдено %d валидных пролетов", len(valid_spans))

    # Валидные участки
    valid_sections = set()
    for uchastok_ref, prolets in prolet_objects.items():
        if any(get_text(prolet, 'Ref') in valid_spans for prolet in prolets):
            valid_sections.add(uchastok_ref)
    logging.info("Найдено %d валидных участков", len(valid_sections))

    # Валидные ЛЭП
    valid_power_lines = set()
    for lep_ref, lep_obj in lep_objects.items():
        lep_guid = get_text(lep_obj, 'гуид')
        if lep_guid and lep_guid != '00000000-0000-0000-0000-000000000000':
            uchastki = [get_text(u, 'Ref') for u in uchastok_objects.get(lep_guid, []) if get_text(u, 'Ref') in valid_sections]
            if uchastki:
                valid_power_lines.add(lep_ref)
    logging.info("Найдено %d валидных ЛЭП", len(valid_power_lines))

    # Создание GeoJSON features
    features = []

    # Функция для получения свойств объекта
    def get_properties(obj, obj_type, ref, relations=None):
        properties = {
            "ref": ref,
            "type": obj_type,
            "IdDZO": get_text(obj, 'КодОбъекта'),
            "name": get_text(obj, 'Description'),
            "filial": get_text(obj, 'Филиал'),
            "responsible": get_text(obj, 'Ответственный'),
            "relations": relations if relations is not None else []
        }
        voltage_id = get_text(obj, 'КлассНапряжения')
        properties["voltage_id"] = voltage_id
        if voltage_id and voltage_id in voltage_classes:
            properties["voltage"] = voltage_classes[voltage_id].get('voltage')
        else:
            properties["voltage"] = None
        return properties

    # Опоры (с пустым relations)
    for opora_ref in valid_supports:
        opora_obj = opora_objects[opora_ref]
        coords = extract_coordinates(opora_obj.find('СтатическиеХарактеристики'))
        features.append({
            "type": "Feature",
            "properties": get_properties(opora_obj, "pylons", opora_ref),
            "geometry": {"type": "Point", "coordinates": [coords[1], coords[0]]}
        })

    # Пролеты (с relations на опоры)
    for uchastok_ref, prolets in prolet_objects.items():
        for prolet in prolets:
            prolet_ref = get_text(prolet, 'Ref')
            if prolet_ref not in valid_spans:
                continue
            nach_opora_ref = get_text(prolet, 'НачальнаяОпора')
            kon_opora_ref = get_text(prolet, 'КонечнаяОпора')
            nach_opora = opora_objects.get(nach_opora_ref)
            kon_opora = opora_objects.get(kon_opora_ref)
            if not (nach_opora and kon_opora):
                continue
            nach_coords = extract_coordinates(nach_opora.find('СтатическиеХарактеристики'))
            kon_coords = extract_coordinates(kon_opora.find('СтатическиеХарактеристики'))
            if not (all(nach_coords) and all(kon_coords)):
                continue
            relations = [{"objectId": nach_opora_ref}, {"objectId": kon_opora_ref}]
            features.append({
                "type": "Feature",
                "properties": get_properties(prolet, "span", prolet_ref, relations),
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[nach_coords[1], nach_coords[0]], [kon_coords[1], kon_coords[0]]]
                }
            })

    # Участки (с relations на пролеты)
    for lep_guid, uchastki in uchastok_objects.items():
        for uchastok in uchastki:
            uchastok_ref = get_text(uchastok, 'Ref')
            if uchastok_ref not in valid_sections:
                continue
            prolets = [get_text(p, 'Ref') for p in prolet_objects.get(uchastok_ref, []) if get_text(p, 'Ref') in valid_spans]
            if prolets:
                relations = [{"objectId": p} for p in prolets]
                features.append({
                    "type": "Feature",
                    "properties": get_properties(uchastok, "lines", uchastok_ref, relations),
                    "geometry": None
                })

    # ЛЭП (с relations на участки)
    for lep_ref in valid_power_lines:
        lep_obj = lep_objects[lep_ref]
        lep_guid = get_text(lep_obj, 'гуид')
        uchastki = [get_text(u, 'Ref') for u in uchastok_objects.get(lep_guid, []) if get_text(u, 'Ref') in valid_sections]
        if uchastki:
            relations = [{"objectId": u} for u in uchastki]
            features.append({
                "type": "Feature",
                "properties": get_properties(lep_obj, "fulllines", lep_ref, relations),
                "geometry": None
            })

    logging.info("Сгенерировано %d features", len(features))

    # Создание и запись GeoJSON
    geojson = {"type": "FeatureCollection", "features": features}
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    logging.info("GeoJSON записан в '%s' с %d features", output_file, len(features))

if __name__ == "__main__":
    process_xml_to_geojson('ЛЭП.xml')