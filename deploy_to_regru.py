# -*- coding: utf-8 -*-
"""
Скрипт автоматического пуша (деплоя) сайта на хостинг REG.RU
ТК501 (ИП Нигамедьянов А.С.) | tk501.ru
Выгружает сайт в папки tk501.ru и ancargo66.ru
"""
import os
import sys
import paramiko

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HOST = "31.31.197.28"
PORT = 22
USER = "u3466140"
PASS = "9L4Rb1EVhX7tVefb"
TARGET_DIRS = ["www/tk501.ru", "www/ancargo66.ru"]

# Выгружаем файлы непосредственно из apps/web/public (где находится актуальный calc.html)
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = os.path.join(REPO_ROOT, "apps", "web", "public")
if not os.path.isdir(LOCAL_DIR):
    LOCAL_DIR = r"C:\ancargo66"

EXCLUDE_EXT = ['.ps1', '.bat', '.py', '.md']
EXCLUDE_PREFIX = ['.git', '.vscode']

def ensure_remote_dir(sftp, remote_dir):
    dirs = []
    head = remote_dir
    while head and head != '/' and head != 'www':
        dirs.append(head)
        head = os.path.dirname(head).replace('\\', '/')
    dirs.reverse()
    for d in dirs:
        try:
            sftp.stat(d)
        except Exception:
            try:
                sftp.mkdir(d)
            except Exception:
                pass

def main():
    print("\n" + "=" * 60)
    print(" [DEPLOY] ВЫГРУЗКА САЙТА НА REG.RU (tk501.ru & ancargo66.ru)")
    print("=" * 60 + "\n")
    
    print(f" Локальная папка: {LOCAL_DIR}")
    print(f" Сервер: {HOST}:{PORT}")
    print(f" Папки на сервере: {', '.join(TARGET_DIRS)}\n")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        print(" Подключение к серверу REG.RU по SFTP... ", end="", flush=True)
        ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)
        print("OK [УСПЕШНО]")
        
        sftp = ssh.open_sftp()
        
        files_to_upload = []
        for root, dirs, files in os.walk(LOCAL_DIR):
            dirs[:] = [d for d in dirs if not any(d.startswith(p) for p in EXCLUDE_PREFIX)]
            for filename in files:
                _, ext = os.path.splitext(filename)
                if ext.lower() in EXCLUDE_EXT:
                    continue
                if any(filename.startswith(p) for p in EXCLUDE_PREFIX):
                    continue
                
                full_local = os.path.join(root, filename)
                rel_path = os.path.relpath(full_local, LOCAL_DIR).replace('\\', '/')
                files_to_upload.append((full_local, rel_path))
            
        print(f"\n Найдено файлов для выгрузки: {len(files_to_upload)}\n")
        
        for target_dir in TARGET_DIRS:
            print(f"\n--- Выгрузка в {target_dir} ---")
            ensure_remote_dir(sftp, target_dir)
            success_count = 0
            for i, (local_file, rel_path) in enumerate(files_to_upload, 1):
                remote_file = f"{target_dir}/{rel_path}"
                remote_parent = os.path.dirname(remote_file).replace('\\', '/')
                if remote_parent != target_dir:
                    ensure_remote_dir(sftp, remote_parent)
                
                size_kb = os.path.getsize(local_file) / 1024
                
                print(f" [{i}/{len(files_to_upload)}] {rel_path} ({size_kb:.1f} KB)... ", end="", flush=True)
                try:
                    sftp.put(local_file, remote_file)
                    print("ГОТОВО [OK]")
                    success_count += 1
                except Exception as e:
                    print(f"ОШИБКА [FAIL] ({e})")
            print(f" Результат для {target_dir}: {success_count}/{len(files_to_upload)} файлов успешно.")
                
        sftp.close()
        ssh.close()
        
        print("\n" + "=" * 60)
        print(" ВСЕ ФАЙЛЫ УСПЕШНО ВЫГРУЖЕНЫ НА REG.RU!")
        print(" Проверьте сайты: http://tk501.ru и http://ancargo66.ru")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n[!] Ошибка подключения: {e}")

if __name__ == "__main__":
    main()
