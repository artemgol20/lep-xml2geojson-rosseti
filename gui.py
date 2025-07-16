import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import scrolledtext
from tkinter import ttk
import threading
import sys
import os
import logging

from final_xml_to_geojsonn import process_xml_to_geojson

class RedirectText(object):
    def __init__(self, text_widget):
        self.output = text_widget

    def write(self, string):
        self.output.configure(state='normal')
        self.output.insert(tk.END, string)
        self.output.see(tk.END)
        self.output.configure(state='disabled')

    def flush(self):
        pass

class TextHandler(logging.Handler):
    def __init__(self, text_widget):
        super().__init__()
        self.text_widget = text_widget

    def emit(self, record):
        msg = self.format(record)
        self.text_widget.configure(state='normal')
        self.text_widget.insert(tk.END, msg + '\n')
        self.text_widget.see(tk.END)
        self.text_widget.configure(state='disabled')

class GeojsonGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("XML to GeoJSON Converter")
        self.geometry("720x540")
        self.resizable(False, False)
        self.configure(bg="#f4f6fa")

        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure('TButton', font=("Segoe UI", 11), padding=6)
        style.configure('TLabel', font=("Segoe UI", 11), background="#f4f6fa")
        style.configure('TEntry', font=("Segoe UI", 11))
        style.configure('TFrame', background="#f4f6fa")
        style.configure('TProgressbar', thickness=8)

        self.input_file = tk.StringVar()
        self.voltage_file = tk.StringVar()
        self.output_file = tk.StringVar(value="output.geojson")
        self.status = tk.StringVar(value="Ожидание")

        # Входной XML
        ttk.Label(self, text="Входной XML-файл:").pack(anchor='w', padx=16, pady=(16,0))
        frame1 = ttk.Frame(self)
        frame1.pack(fill='x', padx=16)
        ttk.Entry(frame1, textvariable=self.input_file, width=60).pack(side='left', fill='x', expand=True)
        ttk.Button(frame1, text="Выбрать...", command=self.browse_input).pack(side='left', padx=6)

        # Классы напряжения
        ttk.Label(self, text="Файл классов напряжения:").pack(anchor='w', padx=16, pady=(12,0))
        frame2 = ttk.Frame(self)
        frame2.pack(fill='x', padx=16)
        ttk.Entry(frame2, textvariable=self.voltage_file, width=60).pack(side='left', fill='x', expand=True)
        ttk.Button(frame2, text="Выбрать...", command=self.browse_voltage).pack(side='left', padx=6)

        # Выходной файл
        ttk.Label(self, text="Имя выходного файла:").pack(anchor='w', padx=16, pady=(12,0))
        frame3 = ttk.Frame(self)
        frame3.pack(fill='x', padx=16)
        ttk.Entry(frame3, textvariable=self.output_file, width=60).pack(side='left', fill='x', expand=True)
        ttk.Button(frame3, text="Сохранить как...", command=self.browse_output).pack(side='left', padx=6)

        # Кнопка запуска и прогресс-бар
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill='x', padx=16, pady=(16,0))
        self.run_btn = ttk.Button(btn_frame, text="Запустить парсинг", command=self.run_parser)
        self.run_btn.pack(side='left')
        self.progress = ttk.Progressbar(btn_frame, mode='indeterminate', length=180)
        self.progress.pack(side='left', padx=16)
        self.progress.stop()

        # Статус
        self.status_label = ttk.Label(self, textvariable=self.status, font=("Segoe UI", 10, "italic"), foreground="#3b82f6")
        self.status_label.pack(anchor='w', padx=18, pady=(6,0))

        # Лог
        ttk.Label(self, text="Лог выполнения:").pack(anchor='w', padx=16, pady=(12,0))
        self.log_text = scrolledtext.ScrolledText(self, height=13, state='disabled', font=("Consolas", 10), bg="#f8fafc")
        self.log_text.pack(fill='both', expand=True, padx=16, pady=(0,14))

        # Логгер для logging
        self.text_handler = TextHandler(self.log_text)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        self.text_handler.setFormatter(formatter)
        logging.getLogger().addHandler(self.text_handler)
        logging.getLogger().setLevel(logging.INFO)

        # Оставляем перенаправление только для print (если нужно)
        sys.stdout = RedirectText(self.log_text)
        sys.stderr = RedirectText(self.log_text)

    def browse_input(self):
        file = filedialog.askopenfilename(filetypes=[("XML files", "*.xml"), ("All files", "*.*")])
        if file:
            self.input_file.set(file)

    def browse_voltage(self):
        file = filedialog.askopenfilename(filetypes=[("XML files", "*.xml"), ("All files", "*.*")])
        if file:
            self.voltage_file.set(file)

    def browse_output(self):
        file = filedialog.asksaveasfilename(defaultextension=".geojson", filetypes=[("GeoJSON", "*.geojson"), ("All files", "*.*")])
        if file:
            self.output_file.set(file)

    def run_parser(self):
        input_path = self.input_file.get()
        voltage_path = self.voltage_file.get()
        output_path = self.output_file.get()
        if not input_path or not voltage_path or not output_path:
            messagebox.showerror("Ошибка", "Пожалуйста, выберите все файлы и имя выходного файла.")
            return
        self.status.set("Выполняется...")
        self.progress.start(10)
        self.run_btn.config(state='disabled')
        threading.Thread(target=self._run_parser_thread, args=(input_path, voltage_path, output_path), daemon=True).start()

    def _run_parser_thread(self, input_path, voltage_path, output_path):
        try:
            print(f"Запуск парсинга...\nВходной файл: {input_path}\nКлассы напряжения: {voltage_path}\nВыходной файл: {output_path}\n")
            process_xml_to_geojson(input_path, voltage_path, output_path)
            print("\nГотово! ✅")
            self.status.set("Готово!")
        except Exception as e:
            print(f"\nОшибка: {e}")
            self.status.set("Ошибка!")
        finally:
            self.progress.stop()
            self.run_btn.config(state='normal')

if __name__ == '__main__':
    app = GeojsonGUI()
    app.mainloop()
