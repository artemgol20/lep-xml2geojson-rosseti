import xml.etree.ElementTree as ET
import json
from collections import defaultdict

# Константы для типов объектов
GUID_VL_LEP = 'c0c2ac9d-fcee-11e1-8837-20cf30e80dd7'
GUID_UCHASTOK = 'c0c2ad20-fcee-11e1-8837-20cf30e80dd7'
GUID_PROLET = 'c0c2acd0-fcee-11e1-8837-20cf30e80dd7'
GUID_OPORA = 'c0c2aca6-fcee-11e1-8837-20cf30e80dd7'

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

# Основная функция обработки XML и создания GeoJSON
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

    # Построение структуры GeoJSON
    features = []
    for lep_ref, lep_obj in lep_objects.items():
        lep_guid = get_text(lep_obj, 'гуид')
        if not lep_guid or lep_guid == '00000000-0000-0000-0000-000000000000':
            continue

        lep_description = get_text(lep_obj, 'Description')
        uchastki = uchastok_objects.get(lep_guid, [])

        uchastki_data = []
        for uchastok in uchastki:
            uchastok_ref = get_text(uchastok, 'Ref')
            uchastok_description = get_text(uchastok, 'Description')
            prolets = prolet_objects.get(uchastok_ref, [])

            prolets_data = []
            for prolet in prolets:
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

                prolets_data.append({
                    "пролет": {
                        'ref': get_text(prolet, 'Ref'),
                        'description': get_text(prolet, 'Description'),
                        'начальная_опора': {
                            'ref': nach_opora_ref,
                            'description': get_text(nach_opora, 'Description'),
                            'coordinates': [nach_coords[1], nach_coords[0]]  # [lon, lat]
                        },
                        'конечная_опора': {
                            'ref': kon_opora_ref,
                            'description': get_text(kon_opora, 'Description'),
                            'coordinates': [kon_coords[1], kon_coords[0]]
                        }
                    }
                })

            if prolets_data:
                uchastki_data.append({
                    'ref': uchastok_ref,
                    'description': uchastok_description,
                    'Пролетты': prolets_data
                })

        if uchastki_data:
            features.append({
                'type': 'Feature',
                'properties': {
                    'ref': lep_ref,
                    'ЛЭП': lep_description,
                    'участки': uchastki_data
                },
                'geometry': None
            })

    # Создание GeoJSON
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }

    # Запись в файл
    with open('output.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    process_xml_to_geojson('ЛЭП.xml')  # Укажите путь к вашему XML файлу