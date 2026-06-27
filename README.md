# Kord Meet - Premium Chat and Video

Plataforma de comunicacao em tempo real: chat, chamadas P2P, compartilhamento de tela, tradutor IA, e comunidades.

## Funcionalidades

- Chat em tempo real com Firebase
- Chamadas de voz/video P2P
- Compartilhamento de tela
- Tradutor IA simultaneo
- Comunidades (servidores)
- Sistema de amizade
- Upload de arquivos P2P
- Temas customizaveis
- Seguranca multi-camada

## Como rodar

1. Clone: git clone https://github.com/NexusGroup2026/kordmeet.git
2. Copie para htdocs do XAMPP
3. Inicie Apache
4. Acesse http://localhost

## Stack

Frontend: Vanilla JS, CSS3, HTML5
Realtime: Firebase Realtime Database
Auth: Firebase Authentication
Backend: PHP 8 + Apache
P2P: WebTorrent

## GitHub Pages

https://nexusgroup2026.github.io/kordmeet/

## Python Script Execution (Windows CMD)

To run Python scripts directly without typing `python` first in CMD:

1. Double-click `add_python_path.bat` or run: `cmd /c C:\xampp\htdocs\add_python_path.bat`
2. Close the Command Prompt window
3. Open a NEW Command Prompt
4. Run scripts like: `myscript.py` (no need for `python myscript.py`)

The batch file configures:
- Adds `.PY` to PATHEXT (so CMD recognizes .py as executable)
- Adds Python to PATH if not present
- Associates .py files with the Python interpreter
