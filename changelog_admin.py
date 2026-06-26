e"""
============================================================
LUMINOUS CONTROL CENTER v3.0 - OFFICIAL ADMIN 
Premium PyQt5 Dashboard for AI Curator Management
============================================================

Features:
- Dashboard (Revenue, Stats, Growth)
- Changelog Manager (Real-time Sync)
- Supporters Manager (Verified Ranking)
- Real-time Notifications (Global Push)
- Premium Glassmorphism UI

Requirements:
pip install PyQt5 requests python-dateutil
============================================================
"""

import sys
import json
import requests
import subprocess
import os
from datetime import datetime
from dateutil import tz
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QTextEdit, QComboBox, QFrame,
    QTableWidget, QTableWidgetItem, QHeaderView, QMessageBox,
    QSplitter, QScrollArea, QDialog, QFormLayout, QSpinBox,
    QTabWidget, QGraphicsDropShadowEffect, QAbstractItemView, QSizePolicy,
    QInputDialog, QDateEdit
)
from PyQt5.QtCore import Qt, QTimer, QThread, pyqtSignal, QPropertyAnimation, QEasingCurve, QSize, QDate, QPoint
from PyQt5.QtGui import QFont, QColor, QPalette, QLinearGradient, QBrush, QIcon, QPainter, QPixmap, QRegion
import traceback


# ============================================================
# FIREBASE CONFIG
# ============================================================
FIREBASE_URL = "https://kakaxicenter-default-rtdb.firebaseio.com"
FIREBASE_API_KEY = "AIzaSyDKL_tODwAIEnCq10-s5DRzFeHWsQLViOs" # Key publica do projeto
EMAIL_ADMIN = "moisesvvanti@gmail.com"


# ============================================================
# STYLES - Ultra Premium Dark Theme
# ============================================================
ULTRA_DARK_STYLESHEET = """
QMainWindow, QWidget {
    background: qradialgradient(cx:0.5, cy:0.5, radius:1.5, fx:0.5, fy:0.5, stop:0 #0d0f18, stop:1 #050508);
    color: #e2e8f0;
    font-family: 'Inter', 'Segoe UI', sans-serif;
}

/* Ultra-Premium Glassmorphism Cards */
QFrame#card {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 rgba(255, 255, 255, 0.05), stop:1 rgba(255, 255, 255, 0.02));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
}

QFrame#card:hover {
    border: 1px solid rgba(99, 102, 241, 0.4);
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 rgba(255, 255, 255, 0.08), stop:1 rgba(255, 255, 255, 0.03));
}

QLabel#title {
    font-size: 42px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: -2px;
    background: transparent;
}

QPushButton {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 16px 32px;
    font-weight: 700;
    font-size: 13px;
    color: #f8fafc;
    text-transform: uppercase;
    letter-spacing: 1px;
}

QPushButton:hover {
    background: rgba(99, 102, 241, 0.25);
    border: 1px solid #6366f1;
    color: #ffffff;
}

QPushButton#primary {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #6366f1, stop:1 #4338ca);
    border: 1px solid rgba(255,255,255,0.2);
}

QPushButton#active {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #10b981, stop:1 #047857);
    border: none;
}

QTableWidget {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    gridline-color: rgba(255, 255, 255, 0.03);
}

QHeaderView::section {
    background: rgba(0,0,0,0.2);
    color: #94a3b8;
    padding: 18px;
    font-weight: 800;
    border: none;
    text-transform: uppercase;
    font-size: 11px;
}

/* Date Edit Specifics */
QDateEdit {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 10px;
    color: #fff;
    font-size: 14px;
}
"""

# ============================================================
# CONSTANTS
# ============================================================
UPDATE_CATEGORIES = {
    "feature": {"label": "🚀 Feature", "color": "#10b981", "icon": "✨"},
    "fix": {"label": "🔧 Bug Fix", "color": "#f59e0b", "icon": "🐛"},
    "security": {"label": "🛡️ Security", "color": "#ef4444", "icon": "🔒"},
    "performance": {"label": "⚡ Speed", "color": "#22d3ee", "icon": "🚀"},
    "ui": {"label": "🎨 UI/UX", "color": "#8b5cf6", "icon": "🖌️"},
    "database": {"label": "💾 Database", "color": "#f472b6", "icon": "📁"},
}

# ============================================================
# API WORKER - Com Retry Automático
# ============================================================
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def create_session_with_retries():
    """Cria uma sessão requests com retry automático para erros de conexão."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,  # 1s, 2s, 4s entre tentativas
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

class FirebaseWorker(QThread):
    finished = pyqtSignal(object) # Changed from dict to object to be more flexible
    error = pyqtSignal(str)
    
    def __init__(self, method="GET", path="", data=None, token=None):
        super().__init__()
        self.method = method
        self.path = path
        self.data = data
        self.token = token
        
    def run(self):
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Append Auth Token if available
                auth_suffix = f"?auth={self.token}" if self.token else ""
                url = f"{FIREBASE_URL}{self.path}.json{auth_suffix}"
                
                # Usar timeout maior e sessão com retry
                session = create_session_with_retries()
                
                if self.method == "GET":
                    r = session.get(url, timeout=30)
                elif self.method == "POST":
                    r = session.post(url, json=self.data, timeout=30)
                elif self.method == "PATCH":
                    r = session.patch(url, json=self.data, timeout=30)
                elif self.method == "DELETE":
                    r = session.delete(url, timeout=30)
                    
                if r.status_code in [200, 201, 204]:
                    # Ensure we always return a dict to avoid Signal type errors
                    res = r.json() if r.content else {}
                    if res is None: res = {}
                    self.finished.emit(res)
                    return  # Sucesso, sair do loop
                elif r.status_code == 401:
                    # Mostrar mensagem real do Firebase para debug (Permission denied vs Invalid Token)
                    self.error.emit(f"Erro 401 (Auth/Permissão):\n{r.text}")
                    return
                else:
                    last_error = f"Status: {r.status_code} - {r.text}"
                    
            except (requests.exceptions.SSLError, 
                    requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout) as e:
                last_error = f"Tentativa {attempt+1}/{max_retries}: {str(e)}"
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                continue
            except Exception as e:
                self.error.emit(str(e))
                return
        
        # Se chegou aqui, todas as tentativas falharam
        self.error.emit(f"Conexão falhou após {max_retries} tentativas.\n{last_error}")

# ============================================================
# MAIN WINDOW
# ============================================================
class ControlCenter(QMainWindow):
    def __init__(self):
        super().__init__()
        self.id_token = None # Store Firebase Auth Token
        
        self.setWindowTitle("LUMINOUS | Admin Control Center")
        self.setMinimumSize(1300, 900)
        
        # Premium Frameless UI Setup
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self.setStyleSheet(ULTRA_DARK_STYLESHEET)
        
        self.dragPos = None # Position for dragging the window
        
        self.workers = [] # Keep references to avoid GC
        
        # 1. First, try to login
        if not self.perform_login():
            sys.exit(0)
            
        # 2. If success, setup UI
        self.setup_ui()
        self.refresh_all()
        
        # Real-time sync for Discovery Queue (Poll every 5s for 'live' feel)
        self.timer_sync = QTimer()
        self.timer_sync.timeout.connect(self.sync_discovery_only)
        self.timer_sync.start(5000)

    # Window Dragging Logic
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.dragPos = event.globalPos()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.LeftButton and self.dragPos is not None:
            self.move(self.pos() + event.globalPos() - self.dragPos)
            self.dragPos = event.globalPos()

    def perform_login(self):
        """Shows modern custom dialog for password and authenticates with Firebase REST API."""
        # Must be parentless (None) to render the frameless/translucent background correctly before the main window is shown
        dialog = LoginDialog(None)
        if dialog.exec_() != QDialog.Accepted:
            return False
            
        password = dialog.get_password()
        if not password:
            return False
            
        try:
            # Firebase Auth REST API: SignInWithPassword
            auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
            payload = {
                "email": EMAIL_ADMIN,
                "password": password,
                "returnSecureToken": True
            }
            r = requests.post(auth_url, json=payload)
            data = r.json()
            
            if 'error' in data:
                QMessageBox.critical(None, "Erro de Login", f"Falha ao entrar:\n{data['error']['message']}")
                return False
                
            self.id_token = data['idToken']
            # Optional: Store refresh token if needed, but for now memory is fine
            return True
            
        except Exception as e:
            QMessageBox.critical(None, "Erro Fatal", f"Erro de conexão:\n{str(e)}")
            return False
        
    def setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(15, 15, 15, 15) # Outer margin for drop shadow
        
        # Wrapper frame with glassmorphism to replace native window
        main_frame = QFrame()
        main_frame.setObjectName("card")
        main_layout = QVBoxLayout(main_frame)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        layout.addWidget(main_frame)
        
        # Header (Top Bar)
        header = QFrame()
        header.setFixedHeight(80)
        header.setStyleSheet("background: #0a0a12; border-bottom: 1px solid rgba(255,255,255,0.05); border-top-left-radius: 12px; border-top-right-radius: 12px;")
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(30, 0, 30, 0)
        
        title_lbl = QLabel("LUMINOUS | CONTROL")
        title_lbl.setObjectName("title")
        title_lbl.setFont(QFont("Outfit", 24, QFont.Black))
        # Gradient effect via QSS for true premium feel
        title_lbl.setStyleSheet("color: #ffffff; letter-spacing: -1px;")
        h_layout.addWidget(title_lbl)
        
        h_layout.addStretch()
        
        self.status_pill = QLabel("🟢 Conectado (Auth)")
        self.status_pill.setStyleSheet("background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 6px 15px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.3);")
        h_layout.addWidget(self.status_pill)
        
        reload_btn = QPushButton("🔄")
        reload_btn.setFixedSize(45, 45)
        reload_btn.setCursor(Qt.PointingHandCursor)
        reload_btn.clicked.connect(self.refresh_all)
        h_layout.addWidget(reload_btn)
        
        # Window Controls (Min / Close)
        min_btn = QPushButton("—")
        min_btn.setFixedSize(45, 45)
        min_btn.setCursor(Qt.PointingHandCursor)
        min_btn.setStyleSheet("QPushButton { font-weight: bold; font-size: 16px; border-radius: 22px; background: rgba(255,255,255,0.05); margin-left:10px; } QPushButton:hover { background: rgba(255,255,255,0.1); }")
        min_btn.clicked.connect(self.showMinimized)
        h_layout.addWidget(min_btn)
        
        close_btn = QPushButton("✕")
        close_btn.setFixedSize(45, 45)
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.setStyleSheet("QPushButton { font-weight: bold; font-size: 16px; border-radius: 22px; background: rgba(239, 68, 68, 0.1); color: #ef4444; } QPushButton:hover { background: rgba(239, 68, 68, 0.3); }")
        close_btn.clicked.connect(self.close)
        h_layout.addWidget(close_btn)
        
        main_layout.addWidget(header)
        
        # Dashboard Content
        content = QWidget()
        c_layout = QVBoxLayout(content)
        c_layout.setContentsMargins(40, 40, 40, 40)
        c_layout.setSpacing(30)
        
        # Tabs
        self.tabs = QTabWidget()
        
        # TAB 1: DASHBOARD
        self.tab_dashboard = QWidget()
        self.setup_tab_dashboard()
        self.tabs.addTab(self.tab_dashboard, "📊 DASHBOARD")
        
        # TAB 2: CHANGELOG
        self.tab_updates = QWidget()
        self.setup_tab_updates()
        self.tabs.addTab(self.tab_updates, "📝 ATUALIZAÇÕES")
        
        # TAB 3: SUPPORTERS
        self.tab_supporters = QWidget()
        self.setup_tab_supporters()
        self.tabs.addTab(self.tab_supporters, "🏆 APOIADORES")
        
        # TAB 4: SYSTEM NOTIFICATIONS
        self.tab_system = QWidget()
        self.setup_tab_system()
        self.tabs.addTab(self.tab_system, "⚡ NOTIFICAÇÕES")

        # TAB 5: ACCESS LOGS
        self.tab_access_logs = QWidget()
        self.setup_tab_access_logs()
        self.tabs.addTab(self.tab_access_logs, "📡 LOGS DE ACESSO")

        # TAB 6: AUTO-CURATOR
        self.tab_autocurator = QWidget()
        self.setup_tab_autocurator()
        self.tabs.addTab(self.tab_autocurator, "🤖 AUTO-CURATOR")

        # TAB 7: BUG REPORTS
        self.tab_bugs = QWidget()
        self.setup_tab_bugs()
        self.tabs.addTab(self.tab_bugs, "🐛 BUG REPORTS")
        
        c_layout.addWidget(self.tabs)
        main_layout.addWidget(content)

    def setup_tab_access_logs(self):
        layout = QVBoxLayout(self.tab_access_logs)
        
        table_frame = QFrame()
        table_frame.setObjectName("card")
        t_layout = QVBoxLayout(table_frame)
        
        header_lay = QHBoxLayout()
        header_lay.addWidget(QLabel("📡 Visitantes Recentes"))
        header_lay.addStretch()
        
        clear_logs_btn = QPushButton("🗑️ Limpar Logs")
        clear_logs_btn.setObjectName("danger")
        clear_logs_btn.setFixedWidth(120)
        clear_logs_btn.clicked.connect(self.clear_access_logs)
        header_lay.addWidget(clear_logs_btn)
        t_layout.addLayout(header_lay)
        
        self.table_access = QTableWidget()
        self.table_access.setColumnCount(4)
        self.table_access.setHorizontalHeaderLabels(["DATA/HORA", "DISPOSITIVO / BROWSER", "REFERÊNCIA", "RELAÇÃO"])
        self.table_access.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.table_access.verticalHeader().setVisible(False)
        t_layout.addWidget(self.table_access)
        
        layout.addWidget(table_frame)

    def setup_tab_autocurator(self):
        layout = QVBoxLayout(self.tab_autocurator)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(25)
        
        # Header Section
        header = QFrame()
        header.setObjectName("card")
        h_layout = QHBoxLayout(header)
        title_v = QVBoxLayout()
        title_v.addWidget(QLabel("🦾 AUTO-CURATOR MISSION CONTROL"))
        title_v.addWidget(QLabel("Sistema de inteligência artificial para descoberta e gestão de nichos proativos."))
        h_layout.addLayout(title_v)
        h_layout.addStretch()
        self.lbl_sync_status = QLabel("🟢 DUAL-SYNC ATIVO")
        self.lbl_sync_status.setStyleSheet("background: rgba(16,185,129,0.1); color: #10b981; padding: 10px 20px; border-radius: 10px; font-weight: bold;")
        h_layout.addWidget(self.lbl_sync_status)
        layout.addWidget(header)

        # Control Panel
        card_auto = QFrame()
        card_auto.setObjectName("card")
        l_auto = QVBoxLayout(card_auto)
        l_auto.addWidget(QLabel("🤖 AUTO-CURATOR | USER-DRIVEN"))
        l_auto.addWidget(QLabel("O robô irá buscar IAs baseadas estritamente no que os usuários pesquisaram e não encontraram."))
        
        btn_discovery = QPushButton("🔥 BUSCAR IAs (PEDIDOS DE USUÁRIOS)")
        btn_discovery.setObjectName("primary")
        btn_discovery.setFixedHeight(60)
        btn_discovery.setCursor(Qt.PointingHandCursor)
        btn_discovery.clicked.connect(lambda: self.run_ai_manager("discovery"))
        l_auto.addWidget(btn_discovery)
        
        l_auto.addWidget(QLabel("Limpeza Automática:"))
        btn_health = QPushButton("🗑️ REMOVER LINKS OFFLINE")
        btn_health.setFixedHeight(50)
        btn_health.clicked.connect(lambda: self.run_ai_manager("health"))
        l_auto.addWidget(btn_health)
        
        layout.addWidget(card_auto)

        # Dashboard Grid
        grid_layout = QHBoxLayout()
        
        # Left Side: Real-time Activity
        left_v = QVBoxLayout()
        act_card = QFrame()
        act_card.setObjectName("card")
        act_l = QVBoxLayout(act_card)
        
        act_header = QHBoxLayout()
        act_header.addWidget(QLabel("🔍 ATIVIDADE DE PESQUISA (LIVE)"))
        act_header.addStretch()
        btn_clear_activity = QPushButton("🗑️ Limpar")
        btn_clear_activity.setFixedWidth(80)
        btn_clear_activity.clicked.connect(self.clear_search_activity)
        act_header.addWidget(btn_clear_activity)
        act_l.addLayout(act_header)
        
        self.list_activity = QTableWidget()
        self.list_activity.setColumnCount(3)
        self.list_activity.setHorizontalHeaderLabels(["HORA", "DEVICE", "TERMO"])
        act_l.addWidget(self.list_activity)
        left_v.addWidget(act_card)
        
        mw_card = QFrame()
        mw_card.setObjectName("card")
        mw_l = QVBoxLayout(mw_card)
        mw_l.addWidget(QLabel("🥇 MAIS BUSCADOS (RANKING)"))
        self.most_wanted = QTableWidget()
        self.most_wanted.setColumnCount(2)
        mw_l.addWidget(self.most_wanted)
        left_v.addWidget(mw_card)
        grid_layout.addLayout(left_v, 2)

        # Right Side: Queues & History
        right_v = QVBoxLayout()
        
        q_card = QFrame()
        q_card.setObjectName("card")
        q_l = QVBoxLayout(q_card)
        qh_l = QHBoxLayout()
        qh_l.addWidget(QLabel("📋 FILA DE ESPERA"))
        self.btn_refresh_q = QPushButton("🔄")
        self.btn_refresh_q.setFixedWidth(50)
        self.btn_refresh_q.clicked.connect(self.refresh_all)
        qh_l.addWidget(self.btn_refresh_q)
        q_l.addLayout(qh_l)
        
        self.list_discovery = QTableWidget()
        self.list_discovery.setColumnCount(1)
        q_l.addWidget(self.list_discovery)
        right_v.addWidget(q_card)

        hist_card = QFrame()
        hist_card.setObjectName("card")
        hist_l = QVBoxLayout(hist_card)
        hist_l.addWidget(QLabel("📜 HISTÓRICO RECENTE"))
        self.list_history = QTableWidget()
        self.list_history.setColumnCount(3)
        self.list_history.setHorizontalHeaderLabels(["DATA", "TERMO", "STATUS"])
        hist_l.addWidget(self.list_history)
        right_v.addWidget(hist_card)
        
        grid_layout.addLayout(right_v, 1)
        layout.addLayout(grid_layout)

    def setup_tab_bugs(self):
        layout = QVBoxLayout(self.tab_bugs)
        layout.setContentsMargins(40, 40, 40, 40)
        
        card = QFrame()
        card.setObjectName("card")
        l = QVBoxLayout(card)
        
        h = QHBoxLayout()
        h.addWidget(QLabel("🐛 Bugs e Falhas Reportadas"))
        h.addStretch()
        
        btn_clear = QPushButton("🗑️ Limpar Concluídos")
        btn_clear.setObjectName("danger")
        btn_clear.clicked.connect(self.clear_bugs)
        h.addWidget(btn_clear)
        l.addLayout(h)
        
        self.table_bugs = QTableWidget()
        self.table_bugs.setColumnCount(5)
        self.table_bugs.setHorizontalHeaderLabels(["TIPO", "DESCRIÇÃO", "PÁGINA", "DATA", "AÇÕES"])
        self.table_bugs.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        l.addWidget(self.table_bugs)
        
        layout.addWidget(card)

    def run_ai_manager(self, action):
        """Executa o script ai_manager.py usando Python 3.10 em uma nova janela de terminal para monitoramento."""
        actions_map = {
            "migrate": ["migrate", "Migração Turbo"],
            "health": ["health", "Limpeza de Links"],
            "discovery": ["discovery", "Busca por Pedidos (Usuários)"]
        }
        
        arg, name = actions_map[action]
        msg = f"Deseja iniciar o processo de '{name}'?\n\nUma nova janela de terminal será aberta para você acompanhar o progresso em tempo real."
        
        if QMessageBox.question(self, "Confirmar Monitoramento", msg) == QMessageBox.Yes:
            try:
                # Usar CREATE_NEW_CONSOLE para que o usuário veja a janela preta rodando
                subprocess.Popen(
                    ["py", "-3.10", "ai_manager.py", arg],
                    cwd=os.path.dirname(os.path.abspath(__file__)),
                    creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
                )
                QMessageBox.information(self, "Iniciado", f"O console do '{name}' foi aberto.\n\nVocê pode ver o robô trabalhando agora! 🤖")
            except Exception as e:
                QMessageBox.critical(self, "Erro", f"Falha ao abrir console: {str(e)}")

    def setup_tab_dashboard(self):
        layout = QVBoxLayout(self.tab_dashboard)
        layout.setSpacing(30)
        
        # Stats Grid
        stats_frame = QHBoxLayout()
        self.stat_revenue = self.create_stat_card("0.00", "RECEITA TOTAL ($)", "#10b981")
        self.stat_supporters = self.create_stat_card("0", " APOIADORES", "#fbbf24")
        self.stat_updates = self.create_stat_card("0", "ATUALIZAÇÕES", "#6366f1")
        self.stat_latest_v = self.create_stat_card("1.0.0", "VERSÃO ATUAL", "#22d3ee")
        
        stats_frame.addWidget(self.stat_revenue)
        stats_frame.addWidget(self.stat_supporters)
        stats_frame.addWidget(self.stat_updates)
        stats_frame.addWidget(self.stat_latest_v)
        layout.addLayout(stats_frame)
        
        # Welcome Card
        welcome = QFrame()
        welcome.setObjectName("card")
        w_layout = QVBoxLayout(welcome)
        w_layout.addWidget(QLabel("🚀 Visão Geral do Sistema"))
        welcome_txt = QLabel("Bem-vindo ao centro de controle Luminous. Aqui você gerencia atualizações e vê o ranking de apoiadores.")
        welcome_txt.setWordWrap(True)
        w_layout.addWidget(welcome_txt)
        layout.addWidget(welcome)
        layout.addStretch()

    def create_stat_card(self, value, label, color):
        card = QFrame()
        card.setObjectName("statCard")
        card.setGraphicsEffect(QGraphicsDropShadowEffect(blurRadius=25, xOffset=0, yOffset=10, color=QColor(0,0,0,100)))
        l = QVBoxLayout(card)
        l.setContentsMargins(20, 20, 20, 20)
        
        val_lbl = QLabel(value)
        val_lbl.setObjectName("statValue")
        val_lbl.setFont(QFont("Inter", 28, QFont.Bold))
        val_lbl.setStyleSheet(f"color: {color}; margin-bottom: 5px;")
        
        txt_lbl = QLabel(label)
        txt_lbl.setObjectName("statLabel")
        txt_lbl.setFont(QFont("Inter", 10, QFont.Medium))
        txt_lbl.setStyleSheet("color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1.5px;")
        
        l.addWidget(val_lbl)
        l.addWidget(txt_lbl)
        return card

    def setup_tab_updates(self):
        layout = QHBoxLayout(self.tab_updates)
        layout.setSpacing(20)
        
        # Left: Entry Form
        form_frame = QFrame()
        form_frame.setFixedWidth(400)
        form_frame.setObjectName("card")
        f_layout = QVBoxLayout(form_frame)
        f_layout.addWidget(QLabel("✏️ Nova Atualização"))
        
        self.entry_title = QLineEdit()
        self.entry_title.setPlaceholderText("Título da mudança...")
        f_layout.addWidget(self.entry_title)

        # Date Picker for Custom Dates
        from PyQt5.QtWidgets import QDateEdit
        from PyQt5.QtCore import QDate
        f_layout.addWidget(QLabel("📅 Data da Atualização:"))
        self.entry_date = QDateEdit()
        self.entry_date.setDate(QDate.currentDate())
        self.entry_date.setCalendarPopup(True)
        self.entry_date.setDisplayFormat("dd/MM/yyyy")
        f_layout.addWidget(self.entry_date)
        
        self.entry_type = QComboBox()
        for k, v in UPDATE_CATEGORIES.items():
            self.entry_type.addItem(f"{v['icon']} {v['label']}", k)
        f_layout.addWidget(self.entry_type)
        
        self.entry_version = QLineEdit("1.0.0")
        f_layout.addWidget(self.entry_version)
        
        self.entry_desc = QTextEdit()
        self.entry_desc.setPlaceholderText("Descrição detalhada (pule linhas para virar lista no site)...")
        f_layout.addWidget(self.entry_desc)
        
        self.post_btn = QPushButton("🚀 PUBLICAR NO SITE")
        self.post_btn.setObjectName("primary")
        self.post_btn.setFixedHeight(50)
        self.post_btn.setCursor(Qt.PointingHandCursor)
        self.post_btn.clicked.connect(self.add_changelog)
        f_layout.addWidget(self.post_btn)
        
        f_layout.addStretch()
        layout.addWidget(form_frame)
        
        # Right: Table
        table_frame = QFrame()
        table_frame.setObjectName("card")
        t_layout = QVBoxLayout(table_frame)
        
        table_header = QHBoxLayout()
        table_header.addWidget(QLabel("📋 Lista de Atualizações"))
        table_header.addStretch()
        
        clear_btn = QPushButton("🗑️ Limpar Tudo")
        clear_btn.setObjectName("danger")
        clear_btn.setFixedWidth(120)
        clear_btn.clicked.connect(self.clear_all_logs)
        table_header.addWidget(clear_btn)
        t_layout.addLayout(table_header)
        
        self.table_updates = QTableWidget()
        self.table_updates.setColumnCount(4)
        self.table_updates.setHorizontalHeaderLabels(["DATA", "VERSÃO", "TÍTULO", "AÇÕES"])
        self.table_updates.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table_updates.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table_updates.verticalHeader().setVisible(False)
        t_layout.addWidget(self.table_updates)
        
        layout.addWidget(table_frame)

    def setup_tab_supporters(self):
        layout = QVBoxLayout(self.tab_supporters)
        
        table_frame = QFrame()
        table_frame.setObjectName("card")
        t_layout = QVBoxLayout(table_frame)
        
        self.table_supporters = QTableWidget()
        self.table_supporters.setColumnCount(4)
        self.table_supporters.setHorizontalHeaderLabels(["APOIADOR", "VALOR TOTAL", "TIER", "DOAÇÕES"])
        self.table_supporters.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table_supporters.verticalHeader().setVisible(False)
        t_layout.addWidget(self.table_supporters)
        
        layout.addWidget(table_frame)

    def setup_tab_system(self):
        layout = QVBoxLayout(self.tab_system)
        
        card = QFrame()
        card.setObjectName("card")
        card.setFixedWidth(600)
        cl = QVBoxLayout(card)
        
        cl.addWidget(QLabel("📣 Notificação Global (Push Real-time)"))
        cl.addWidget(QLabel("Isso enviará um alerta para todos os usuários navegando no Luminous agora."))
        
        self.push_msg = QTextEdit()
        self.push_msg.setPlaceholderText("Ex: Nova IA de vídeo adicionada! Confira na aba Explorar.")
        self.push_msg.setFixedHeight(120)
        cl.addWidget(self.push_msg)
        
        push_btn = QPushButton("⚡ ENVIAR ALERTA GLOBAL")
        push_btn.setObjectName("primary")
        push_btn.setFixedHeight(60)
        push_btn.setCursor(Qt.PointingHandCursor)
        push_btn.clicked.connect(self.push_notification)
        cl.addWidget(push_btn)
        
        layout.addWidget(card, 0, Qt.AlignCenter)

        # Danger Zone
        danger_card = QFrame()
        danger_card.setObjectName("card")
        danger_card.setFixedWidth(600)
        danger_card.setStyleSheet("QFrame#card { border: 1px solid rgba(239, 68, 68, 0.3); }")
        dl = QVBoxLayout(danger_card)
        dl.addWidget(QLabel("⚠️ ZONA DE PERIGO (LIMPEZA)"))
        dl.addWidget(QLabel("Remove todos os dados de popularidade da semana."))
        
        reset_pop_btn = QPushButton("🔥 RESETAR POPULARES DA SEMANA")
        reset_pop_btn.setStyleSheet("background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444;")
        reset_pop_btn.setFixedHeight(50)
        reset_pop_btn.clicked.connect(self.reset_popularity)
        dl.addWidget(reset_pop_btn)
        
        layout.addWidget(danger_card, 0, Qt.AlignCenter)
        layout.addStretch()

    # ============================================================
    # LOGIC
    # ============================================================
    def on_error(self, error_msg):
        self.status_pill.setText("🔴 Erro de Conexão")
        self.status_pill.setStyleSheet("background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 6px 15px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(239, 68, 68, 0.3);")
        QMessageBox.critical(self, "Erro Firebase", f"Falha na ação:\n{error_msg}\n\nSe for erro 401, reinicie e logue novamente.")

    def refresh_all(self):
        self.status_pill.setText("🟡 Sincronizando...")
        self.status_pill.setStyleSheet("background: rgba(251, 191, 36, 0.1); color: #fbbf24; padding: 6px 15px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(251, 191, 36, 0.3);")
        
        # Fetch Changelog
        w_logs = FirebaseWorker("GET", "/changelog", token=self.id_token)
        w_logs.finished.connect(self.update_logs_ui)
        w_logs.error.connect(self.on_error)
        w_logs.start()
        self.workers.append(w_logs)
        
        # Fetch Supporters
        w_supp = FirebaseWorker("GET", "/supporters", token=self.id_token)
        w_supp.finished.connect(self.update_supporters_ui)
        w_supp.error.connect(self.on_error)
        w_supp.start()
        self.workers.append(w_supp)

        # Fetch Access Logs
        w_access = FirebaseWorker("GET", "/access_logs", token=self.id_token)
        w_access.finished.connect(self.update_access_ui)
        w_access.error.connect(self.on_error)
        w_access.start()
        self.workers.append(w_access)

        # Fetch Discovery Queue
        w_discovery = FirebaseWorker("GET", "/discovery_queue", token=self.id_token)
        w_discovery.finished.connect(self.update_discovery_ui)
        w_discovery.error.connect(self.on_error)
        w_discovery.start()
        self.workers.append(w_discovery)

        # Fetch Discovery History
        w_history = FirebaseWorker("GET", "/discovery_history", token=self.id_token)
        w_history.finished.connect(self.update_history_ui)
        w_history.error.connect(self.on_error)
        w_history.start()
        self.workers.append(w_history)

        # Fetch Search Activity
        w_activity = FirebaseWorker("GET", "/search_activity", token=self.id_token)
        w_activity.finished.connect(self.update_activity_ui)
        w_activity.error.connect(self.on_error)
        w_activity.start()
        self.workers.append(w_activity)

        # Fetch Bug Reports
        w_bugs = FirebaseWorker("GET", "/bug_reports", token=self.id_token)
        w_bugs.finished.connect(self.update_bugs_ui)
        w_bugs.error.connect(self.on_error)
        w_bugs.start()
        self.workers.append(w_bugs)

    def sync_discovery_only(self):
        """Silently syncs discovery queue and history for 'live' feel."""
        # Limpeza de memória: Remove workers que já terminaram
        self.workers = [w for w in self.workers if w.isRunning()]

        wQ = FirebaseWorker("GET", "/discovery_queue", token=self.id_token)
        wQ.finished.connect(self.update_discovery_ui)
        wQ.start()
        self.workers.append(wQ)

        wH = FirebaseWorker("GET", "/discovery_history", token=self.id_token)
        wH.finished.connect(self.update_history_ui)
        wH.start()
        self.workers.append(wH)

        wA = FirebaseWorker("GET", "/search_activity", token=self.id_token)
        wA.finished.connect(self.update_activity_ui)
        wA.start()
        self.workers.append(wA)

    def update_access_ui(self, data):
        data = data or {}
        logs = sorted(data.items(), key=lambda x: x[1].get('timestamp', 0), reverse=True)
        # Limitar a 200 para performance
        logs = logs[:200]
        
        self.table_access.setRowCount(len(logs))
        for i, (log_id, val) in enumerate(logs):
            try:
                dt = datetime.fromtimestamp(val.get('timestamp', 0)/1000).strftime('%d/%m/%y %H:%M')
            except:
                dt = "??"
            
            ua = val.get('userAgent', 'N/A')
            device = "📱 Mobile" if "Mobi" in ua else "💻 Desktop"
            
            browser = "Unknown"
            if "Chrome" in ua: browser = "Chrome"
            elif "Firefox" in ua: browser = "Firefox"
            elif "Safari" in ua: browser = "Safari"
            elif "Edge" in ua: browser = "Edge"
            
            self.table_access.setItem(i, 0, QTableWidgetItem(dt))
            self.table_access.setItem(i, 1, QTableWidgetItem(f"{device} ({browser}) - {val.get('screen', '')}"))
            self.table_access.setItem(i, 2, QTableWidgetItem(val.get('referrer', '')))
            self.table_access.setItem(i, 3, QTableWidgetItem(val.get('url', '').split('/')[-1] or '/'))

    def update_discovery_ui(self, data):
        """Atualiza a tabela de termos pesquisados que não deram resultado."""
        data = data or {}
        # Firebase pode retornar dict ou list dependendo de como as chaves são geradas
        items = []
        if isinstance(data, dict):
            items = list(data.values())
        elif isinstance(data, list):
            items = [x for x in data if x is not None]
        
        # Filtrar duplicatas e ordenar (mais recentes primeiro se houvesse timestamp, mas aqui é só texto)
        unique_items = sorted(list(set(items)))
        
        self.list_discovery.setRowCount(len(unique_items))
        for i, term in enumerate(unique_items):
            item = QTableWidgetItem(str(term).upper())
            item.setTextAlignment(Qt.AlignCenter)
            self.list_discovery.setItem(i, 0, item)

    def update_history_ui(self, data):
        """Atualiza a tabela de histórico de descobertas."""
        data = data or {}
        # Firebase pode retornar dict
        items = []
        if isinstance(data, dict):
            items = list(data.values())
        
        # Inverter para mostrar os mais novos primeiro
        items = sorted(items, key=lambda x: x.get('date', ''), reverse=True)
        items = items[:50] # Mostrar os 50 últimos
        
        self.list_history.setRowCount(len(items))
        for i, entry in enumerate(items):
            self.list_history.setItem(i, 0, QTableWidgetItem(entry.get('date', '')))
            self.list_history.setItem(i, 1, QTableWidgetItem(entry.get('query', '').upper()))
            
            status = entry.get('status', '??')
            s_item = QTableWidgetItem(status)
            s_item.setForeground(QColor("#10b981") if status == "Sucesso" else QColor("#ef4444"))
            self.list_history.setItem(i, 2, s_item)

    def update_activity_ui(self, data):
        """Atualiza a tabela de todas as buscas feitas no site com agregação."""
        data = data or {}
        items = list(data.values()) if isinstance(data, dict) else [x for x in data if x]
        
        if not items: return

        # 1. Agregação p/ MAIS BUSCADOS (Top 10)
        counts = {}
        for entry in items:
            q = str(entry.get('query', '')).upper().strip()
            if q: counts[q] = counts.get(q, 0) + 1
        
        sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]
        self.most_wanted.setRowCount(len(sorted_counts))
        for i, (term, count) in enumerate(sorted_counts):
            self.most_wanted.setItem(i, 0, QTableWidgetItem(term))
            c_item = QTableWidgetItem(str(count))
            c_item.setTextAlignment(Qt.AlignCenter)
            c_item.setForeground(QColor("#6366f1"))
            self.most_wanted.setItem(i, 1, c_item)

        # 2. Lista de Atividade Detalhada
        items.sort(key=lambda x: x.get('timestamp', 0), reverse=True)
        items = items[:50]
        
        self.list_activity.setColumnCount(3)
        self.list_activity.setHorizontalHeaderLabels(["HORA", "DISPOSITIVO", "TERMO"])
        
        self.list_activity.setRowCount(len(items))
        for i, entry in enumerate(items):
            try:
                ts = entry.get('timestamp', 0)
                dt = datetime.fromtimestamp(ts/1000).strftime('%H:%M:%S')
            except:
                dt = "??"
            
            device = "📱 Mobile" if entry.get('is_mobile') else "💻 PC"
            sess = entry.get('session', '???')[:4] # Mini prefix
            
            self.list_activity.setItem(i, 0, QTableWidgetItem(dt))
            self.list_activity.setItem(i, 1, QTableWidgetItem(f"{device} [{sess}]"))
            self.list_activity.setItem(i, 2, QTableWidgetItem(str(entry.get('query', '')).upper()))

    def clear_access_logs(self):
        reply = QMessageBox.question(self, 'Limpar Logs', "Deseja apagar todos os registros de acessos?", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No: return

        w_clear = FirebaseWorker("DELETE", "/access_logs", token=self.id_token)
        w_clear.finished.connect(self.refresh_all)
        w_clear.error.connect(self.on_error)
        w_clear.start()
        self.workers.append(w_clear)

    def clear_search_activity(self):
        reply = QMessageBox.question(self, 'Limpar Pesquisas', "Deseja apagar toda a atividade de pesquisa e ranking?", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No: return

        def on_clear_done(data):
            self.list_activity.setRowCount(0)
            self.most_wanted.setRowCount(0)
            QMessageBox.information(self, "Limpo", "✅ Atividade de pesquisa limpa com sucesso!")
            self.refresh_all()

        # Limpar search_activity
        w1 = FirebaseWorker("DELETE", "/search_activity", token=self.id_token)
        w1.finished.connect(on_clear_done)
        w1.error.connect(self.on_error)
        w1.start()
        self.workers.append(w1)

    def update_bugs_ui(self, data):
        data = data or {}
        reports = sorted(data.items(), key=lambda x: x[1].get('timestamp', ''), reverse=True)
        
        self.table_bugs.setRowCount(len(reports))
        for i, (report_id, val) in enumerate(reports):
            status = val.get('status', 'new')
            color = "#f59e0b" if status == 'new' else "#10b981"
            
            tipo_item = QTableWidgetItem(val.get('type', 'desconhecido').upper())
            tipo_item.setForeground(QColor(color))
            
            self.table_bugs.setItem(i, 0, tipo_item)
            self.table_bugs.setItem(i, 1, QTableWidgetItem(val.get('description', '')))
            self.table_bugs.setItem(i, 2, QTableWidgetItem(val.get('page', '')))
            
            ts = val.get('timestamp', '')
            try:
                if isinstance(ts, int) or isinstance(ts, float):
                    # It's an integer timestamp now!
                    date_str = datetime.fromtimestamp(ts/1000).strftime('%d/%m/%Y')
                else:
                    date_str = ts.split('T')[0] if 'T' in str(ts) else '??'
            except:
                date_str = '??'

            self.table_bugs.setItem(i, 3, QTableWidgetItem(date_str))
            
            # Action Buttons
            container = QWidget()
            lay = QHBoxLayout(container)
            lay.setContentsMargins(0,0,0,0)
            
            del_btn = QPushButton("🗑️")
            del_btn.setFixedSize(40, 30)
            del_btn.setObjectName("danger")
            del_btn.clicked.connect(lambda checked, r=report_id: self.delete_bug(r))
            lay.addWidget(del_btn)
            
            self.table_bugs.setCellWidget(i, 4, container)

    def delete_bug(self, report_id):
        w = FirebaseWorker("DELETE", f"/bug_reports/{report_id}", token=self.id_token)
        w.finished.connect(self.refresh_all)
        w.start()
        self.workers.append(w)

    def clear_bugs(self):
        if QMessageBox.question(self, "Limpar Bugs", "Deseja apagar todos os relatos de bugs?") == QMessageBox.Yes:
            w = FirebaseWorker("DELETE", "/bug_reports", token=self.id_token)
            w.finished.connect(self.refresh_all)
            w.start()
            self.workers.append(w)

    def update_logs_ui(self, data):
        data = data or {}
        entries = sorted(data.items(), key=lambda x: x[1].get('timestamp', 0), reverse=True)
        
        self.table_updates.setRowCount(len(entries))
        for i, (log_id, val) in enumerate(entries):
            try:
                dt = datetime.fromtimestamp(val.get('timestamp', 0)/1000).strftime('%d/%m/%y')
            except:
                dt = "??"
                
            self.table_updates.setItem(i, 0, QTableWidgetItem(dt))
            self.table_updates.setItem(i, 1, QTableWidgetItem(val.get('version', '0.0.0')))
            self.table_updates.setItem(i, 2, QTableWidgetItem(val.get('title', '')))
            
            # Action Button Container
            container = QWidget()
            c_lay = QHBoxLayout(container)
            c_lay.setContentsMargins(0, 0, 0, 0)
            
            del_btn = QPushButton("🗑️")
            del_btn.setFixedSize(40, 30)
            del_btn.setObjectName("danger")
            del_btn.setCursor(Qt.PointingHandCursor)
            del_btn.clicked.connect(lambda checked, x=log_id: self.delete_log(x))
            
            c_lay.addWidget(del_btn)
            c_lay.setAlignment(Qt.AlignCenter)
            self.table_updates.setCellWidget(i, 3, container)

        self.stat_updates.findChild(QLabel, "statValue").setText(str(len(entries)))
        if entries:
            self.stat_latest_v.findChild(QLabel, "statValue").setText(entries[0][1].get('version', '1.0.0'))
        
        self.status_pill.setText("🟢 Conectado (Auth)")
        self.status_pill.setStyleSheet("background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 6px 15px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.3);")

    def update_supporters_ui(self, data):
        data = data or {}
        supporters = sorted(data.values(), key=lambda x: x.get('total_amount', 0), reverse=True)
        
        self.table_supporters.setRowCount(len(supporters))
        total_rev = 0
        for i, s in enumerate(supporters):
            total_rev += s.get('total_amount', 0)
            self.table_supporters.setItem(i, 0, QTableWidgetItem(s.get('display_name', 'Anonimo')))
            self.table_supporters.setItem(i, 1, QTableWidgetItem(f"$ {s.get('total_amount', 0):.2f}"))
            self.table_supporters.setItem(i, 2, QTableWidgetItem(s.get('tier', 'bronze').upper()))
            self.table_supporters.setItem(i, 3, QTableWidgetItem(str(s.get('donation_count', 1))))

        self.stat_revenue.findChild(QLabel, "statValue").setText(f"{total_rev:.2f}")
        self.stat_supporters.findChild(QLabel, "statValue").setText(str(len(supporters)))

    def add_changelog(self):
        title = self.entry_title.text()
        if not title: 
            QMessageBox.warning(self, "Título Vazio", "Por favor, insira um título.")
            return
        
        # Date Handling
        qdate = self.entry_date.date()
        dt_val = datetime(qdate.year(), qdate.month(), qdate.day(), 12, 0, 0)
        ts = int(dt_val.timestamp() * 1000)

        data = {
            "title": title,
            "description": self.entry_desc.toPlainText(),
            "type": self.entry_type.currentData(),
            "version": self.entry_version.text(),
            "timestamp": ts
        }
        
        self.post_btn.setEnabled(False)
        self.post_btn.setText("⏳ PUBLICANDO...")
        
        w_add = FirebaseWorker("POST", "/changelog", data, token=self.id_token)
        w_add.finished.connect(self.on_add_success)
        w_add.error.connect(self.on_action_error)
        w_add.start()
        self.workers.append(w_add)

    def on_add_success(self, _):
        self.post_btn.setEnabled(True)
        self.post_btn.setText("🚀 PUBLICAR NO SITE")
        self.entry_title.clear()
        self.entry_desc.clear()
        QMessageBox.information(self, "Sucesso", "Changelog publicado com sucesso!")
        self.refresh_all()

    def on_action_error(self, err):
        self.post_btn.setEnabled(True)
        self.post_btn.setText("🚀 PUBLICAR NO SITE")
        self.on_error(err)

    def delete_log(self, log_id):
        reply = QMessageBox.question(self, 'Confirmar Exclusão', "Tem certeza que deseja excluir esta atualização?", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No: return

        w_del = FirebaseWorker("DELETE", f"/changelog/{log_id}", token=self.id_token)
        w_del.finished.connect(self.refresh_all)
        w_del.error.connect(self.on_error)
        w_del.start()
        self.workers.append(w_del)

    def push_notification(self):
        msg = self.push_msg.toPlainText()
        if not msg: return
        
        data = {
            "message": msg,
            "timestamp": int(datetime.now().timestamp() * 1000),
            "id": int(datetime.now().timestamp())
        }
        
        w_push = FirebaseWorker("PATCH", "/system_config/announcement", data, token=self.id_token)
        w_push.finished.connect(self.on_push_success)
        w_push.error.connect(self.on_error)
        w_push.start()
        self.workers.append(w_push)

    def on_push_success(self, _):
        self.push_msg.clear()
        QMessageBox.information(self, "Sucesso", "Alerta enviado para todos os usuários!")

    def clear_all_logs(self):
        reply = QMessageBox.question(self, 'Resetar Changelog', "Deseja apagar TODAS as atualizações do banco de dados? Isso não pode ser desfeito.", QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.No: return

        w_clear = FirebaseWorker("DELETE", "/changelog", token=self.id_token)
        w_clear.finished.connect(self.refresh_all)
        w_clear.error.connect(self.on_error)
        w_clear.start()
        self.workers.append(w_clear)
        QMessageBox.information(self, "Sucesso", "Banco de dados limpo!")


    def reset_popularity(self):
        msg = "Tem certeza que deseja remover TODOS os dados de popularidade da semana?\n\nIsso limpará a lista de ferramentas populares no site."
        if QMessageBox.question(self, "Confirmar Reset", msg) == QMessageBox.Yes:
            w_reset = FirebaseWorker("DELETE", "/popular_stats", token=self.id_token)
            w_reset.finished.connect(lambda _: QMessageBox.information(self, "Sucesso", "Dados de popularidade resetados!"))
            w_reset.error.connect(self.on_error)
            w_reset.start()
            self.workers.append(w_reset)

class LoginDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Luminous Auth")
        self.setFixedSize(450, 300)
        self.setStyleSheet(ULTRA_DARK_STYLESHEET)
        
        # Transparent background for true glassmorphism framing
        self.setWindowFlags(Qt.Dialog | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Glass card
        frame = QFrame()
        frame.setObjectName("card")
        frame.setGraphicsEffect(QGraphicsDropShadowEffect(blurRadius=40, xOffset=0, yOffset=15, color=QColor(0,0,0,150)))
        f_layout = QVBoxLayout(frame)
        f_layout.setContentsMargins(40, 40, 40, 40)
        
        lbl_title = QLabel("LUMINOUS SECURITY")
        lbl_title.setObjectName("title")
        lbl_title.setFont(QFont("Outfit", 20, QFont.Black))
        lbl_title.setAlignment(Qt.AlignCenter)
        f_layout.addWidget(lbl_title)
        
        lbl_sub = QLabel(f"Auth target: {EMAIL_ADMIN}")
        lbl_sub.setAlignment(Qt.AlignCenter)
        lbl_sub.setStyleSheet("color: #64748b; margin-bottom: 20px;")
        f_layout.addWidget(lbl_sub)
        
        self.pwd_input = QLineEdit()
        self.pwd_input.setEchoMode(QLineEdit.Password)
        self.pwd_input.setPlaceholderText("Password Token")
        self.pwd_input.setStyleSheet("""
            QLineEdit {
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 15px;
                color: white;
                font-size: 14px;
            }
            QLineEdit:focus { border: 1px solid #6366f1; }
        """)
        f_layout.addWidget(self.pwd_input)
        
        h_btn = QHBoxLayout()
        btn_cancel = QPushButton("Cancelar")
        btn_cancel.clicked.connect(self.reject)
        btn_login = QPushButton("Desbloquear")
        btn_login.setObjectName("primary")
        btn_login.clicked.connect(self.accept)
        
        h_btn.addWidget(btn_cancel)
        h_btn.addWidget(btn_login)
        f_layout.addLayout(h_btn)
        
        layout.addWidget(frame)

    def get_password(self):
        return self.pwd_input.text()

# Global Exception Handler to prevent silent crashes
def global_excepthook(exc_type, exc_value, exc_tb):
    tb_text = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
    print(f"CRITICAL ERROR:\n{tb_text}")
    QMessageBox.critical(None, "Luminous - Falha Crítica", f"O sistema interceptou um erro letal e evitou o fechamento abrupto.\n\nDetalhes:\n{exc_value}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    sys.excepthook = global_excepthook
    window = ControlCenter()
    window.show()
    sys.exit(app.exec_())
