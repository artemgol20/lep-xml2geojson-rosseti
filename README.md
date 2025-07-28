# Конвертер ЛЭП XML → GeoJSON

Программа для конвертации данных о линиях электропередач (ЛЭП), участках, пролётах и опорах из XML в формат GeoJSON с удобным графическим интерфейсом.

## Возможности
- Загрузка исходных XML-файлов (структура сети и классы напряжения)
- Валидация и обработка данных
- Генерация GeoJSON для последующей визуализации на карте
- Удобный современный интерфейс с прогресс-баром и логом выполнения
- Не требует установки Python у пользователя (готовый exe)

## Как пользоваться
1. Скачайте готовую программу по ссылке:
   [Скачать exe (Google Drive)](https://drive.google.com/file/d/1J1zIgZafNIYqOgbiRLAx4MF0xe4GxcMj/view?usp=sharing)
2. Запустите файл 
3. Выберите входные XML-файлы и задайте имя выходного GeoJSON
4. Нажмите "Запустить парсинг" и дождитесь завершения
5. Готовый GeoJSON появится в выбранной папке

## Описание проекта
- **Язык:** Python 3
- **GUI:** Tkinter (ttk)
- **Сборка exe:** PyInstaller (`--onefile --noconsole`)
- **Исходный код:** в этом репозитории
- **Готовый exe:** по ссылке выше

### Для разработчиков
- Для запуска из исходников нужен Python 3.8+ и стандартные библиотеки
- Основные файлы: `gui.py`, `final_xml_to_geojsonn.py`
- Для сборки exe: `pip install pyinstaller` и `pyinstaller --onefile --noconsole gui.py`

## Отчености
- [Отчет по скрипту](https://docs.google.com/document/d/1QsnNjPqmaPNXoq2bWJq_hCrJC8RI5p8jEW2u3TjNkRY/edit?tab=t.0#heading=h.fwfh3j1kzutc)
- [Отчет по сайту](https://docs.google.com/document/d/1x8hZD2z8UejIvBWcv4cQeP7jgpKX8Ke4m74Uz8WxrCw/edit?tab=t.0)
- [Ссылка на сайт](https://artemgol20.github.io/lep-xml2geojson-rosseti/)
