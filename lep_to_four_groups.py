import xml.etree.ElementTree as ET
import uuid
from collections import defaultdict
import os

# Словарь для соответствия GUID и групп
groups = {
    'c0c2ac9d-fcee-11e1-8837-20cf30e80dd7': {'name': 'ВЛ_ЛЭП', 'count': 0, 'objects': []},
    'c0c2ad20-fcee-11e1-8837-20cf30e80dd7': {'name': 'Участок_магистрали', 'count': 0, 'objects': []},
    'c0c2acd0-fcee-11e1-8837-20cf30e80dd7': {'name': 'Пролет', 'count': 0, 'objects': []},
    'c0c2aca6-fcee-11e1-8837-20cf30e80dd7': {'name': 'Опора', 'count': 0, 'objects': []}
}

def process_xml_file(input_file):
    # Парсинг XML файла
    tree = ET.parse(input_file)
    root = tree.getroot()
    
    # Проходим по всем объектам CatalogObject.урскСтруктураСети
    for obj in root.findall('.//CatalogObject.урскСтруктураСети'):
        vid_teh_mesta = obj.find('ВидТехническогоМеста').text if obj.find('ВидТехническогоМеста') is not None else None
        
        # Если GUID соответствует одной из групп, добавляем объект в соответствующую группу
        if vid_teh_mesta in groups:
            groups[vid_teh_mesta]['count'] += 1
            groups[vid_teh_mesta]['objects'].append(obj)
    
    # Создаем отдельные XML файлы для каждой группы
    for guid, group_info in groups.items():
        if group_info['objects']:
            # Создаем новый XML документ
            new_root = ET.Element('root')
            for obj in group_info['objects']:
                new_root.append(obj)
            
            # Создаем дерево и записываем в файл
            new_tree = ET.ElementTree(new_root)
            output_file = f'output_{group_info["name"]}.xml'
            new_tree.write(output_file, encoding='utf-8', xml_declaration=True)
    
    # Выводим статистику в консоль
    print("Количество объектов по типам:")
    for guid, group_info in groups.items():
        print(f"{group_info['name']}: {group_info['count']}")

if __name__ == "__main__":
    input_file = "ЛЭП.xml"  # Замените на путь к вашему XML файлу
    if os.path.exists(input_file):
        process_xml_file(input_file)
    else:
        print(f"Файл {input_file} не найден")