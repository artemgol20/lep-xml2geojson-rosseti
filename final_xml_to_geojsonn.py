import xml.etree.ElementTree as ET
import json
from collections import defaultdict

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
                lat = float(value.replace('N', ''))
            elif characteristic == GUID_LON and value:
                lon = float(value.replace('E', ''))
    return lat, lon

# Основная функция для обработки XML и создания GeoJSON
def process_xml_to_geojson(input_file):
    tree = ET.parse(input_file)
    root = tree.getroot()

    # Словарь для хранения объектов по их Ref
    objects_by_ref = {get_text(obj, 'Ref'): obj for obj in root.findall('.//CatalogObject.урскСтруктураСети') if get_text(obj, 'Ref')}

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

    # Построение GeoJSON features
    features = []

    # Добавление опор (supports) как точечных объектов
    for opora_ref, opora_obj in opora_objects.items():
        opora_name = get_text(opora_obj, 'Description')
        coords = extract_coordinates(opora_obj.find('СтатическиеХарактеристики'))
        if coords and all(coords):
            features.append({
                "type": "Feature",
                "properties": {
                    "ref": opora_ref,
                    "name": opora_name,
                    "type": "support"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [coords[1], coords[0]]  # [lon, lat]
                }
            })

    # Добавление пролетов (spans) как линий с отношениями к опорам
    for uchastok_ref, prolets in prolet_objects.items():
        for prolet in prolets:
            prolet_ref = get_text(prolet, 'Ref')
            nach_opora_ref = get_text(prolet, 'НачальнаяОпора')
            kon_opora_ref = get_text(prolet, 'КонечнаяОпора')
            if nach_opora_ref == '00000000-0000-0000-0000-000000000000' or kon_opora_ref == '00000000-0000-0000-0000-000000000000':
                continue

            nach_opora = opora_objects.get(nach_opora_ref)
            kon_opora = opora_objects.get(kon_opora_ref)
            if not nach_opora or not kon_opora:
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
                        [nach_coords[1], nach_coords[0]],  # [lon, lat] начальной опоры
                        [kon_coords[1], kon_coords[0]]     # [lon, lat] конечной опоры
                    ]
                }
            })

    # Добавление участков (sections) с отношениями к пролетам
    for lep_guid, uchastki in uchastok_objects.items():
        for uchastok in uchastki:
            uchastok_ref = get_text(uchastok, 'Ref')
            uchastok_name = get_text(uchastok, 'Description')
            prolets = prolet_objects.get(uchastok_ref, [])
            relations = [{"objectId": get_text(prolet, 'Ref')} for prolet in prolets if get_text(prolet, 'Ref')]
            if relations:
                features.append({
                    "type": "Feature",
                    "properties": {
                        "ref": uchastok_ref,
                        "name": uchastok_name,
                        "type": "section",
                        "relations": relations
                    }
                    
                })

    # Добавление ЛЭП (power lines) с отношениями к участкам
    for lep_ref, lep_obj in lep_objects.items():
        lep_guid = get_text(lep_obj, 'гуид')
        if not lep_guid or lep_guid == '00000000-0000-0000-0000-000000000000':
            continue

        lep_name = get_text(lep_obj, 'Description')
        uchastki = uchastok_objects.get(lep_guid, [])
        relations = [{"objectId": get_text(uchastok, 'Ref')} for uchastok in uchastki if get_text(uchastok, 'Ref')]
        if relations:
            features.append({
                "type": "Feature",
                "properties": {
                    "ref": lep_ref,
                    "name": lep_name,
                    "type": "power_line",
                    "relations": relations
                }
            })

    # Создание GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # Запись в файл
    with open('output.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    process_xml_to_geojson('ЛЭП.xml')  # Укажите путь к вашему XML-файлу