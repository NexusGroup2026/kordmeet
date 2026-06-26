import os
import sys
import time
import requests
import json
import subprocess
import argparse
import urllib3
from datetime import datetime
from threading import Thread
from concurrent.futures import ThreadPoolExecutor

# Suprimir warnings de SSL (verify=False)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configurações do Firebase
FIREBASE_URL = "https://kakaxicenter-default-rtdb.firebaseio.com"
DB_JSON_PATH = os.path.join(os.getcwd(), 'ai_database.json')

BANNER = r"""
  ___  _____  ___ _   _ ____      _  _____ ___  ____  
 / _ \|_   _|_ _| | | |  _ \    / \|_   _/ _ \|  _ \ 
| | | | | |  | || | | | |_) |  / _ \ | || | | | |_) |
| |_| | | |  | || |_| |  _ <  / ___ \| || |_| |  _ < 
 \___/  |_| |___|\___/|_| \_\/_/   \_\_| \___/|_| \_\
                                                      
   >>> ROBOT DE CURADORIA INTELIGENTE V3.0 <<<
"""

class AIManager:
    def __init__(self):
        self.health_check_running = False
        self.discovery_running = False

    def load_local_db(self):
        if os.path.exists(DB_JSON_PATH):
            try:
                with open(DB_JSON_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return {"tools": data}
                    return data
            except:
                return {"tools": []}
        return {"tools": []}

    def save_local_db(self, data):
        # Sempre salva como lista para manter compatibilidade com o arquivo original
        tools_list = data.get('tools', []) if isinstance(data, dict) else data
        with open(DB_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(tools_list, f, indent=4, ensure_ascii=False)

    def run_migration(self):
        """Migra dados do JSON local para o Firebase com validação profunda (Health + AI Score)."""
        print(BANNER)
        print("[MIGRAÇÃO LIMPA] Iniciando validação e envio de dados...")
        
        data = self.load_local_db()
        tools = data.get('tools', [])
        
        print(f"[SISTEMA] Analisando {len(tools)} ferramentas locais...")
        
        migrated_count = 0
        skipped_count = 0
        
        def process_and_upload(tool):
            nonlocal migrated_count, skipped_count
            url = tool.get('url')
            name = tool.get('name', 'Unknown')
            
            # 1. Health & AI Score Check
            try:
                res = requests.get(url, timeout=7, allow_redirects=True)
                if res.status_code == 200 and len(res.text) > 800:
                    if self.verify_if_ai(res.text):
                        # Tool é válida e é IA!
                        tool_id = tool.get('id')
                        # Atualiza metadados de migração
                        tool['meta']['migration_status'] = "Verified & Migrated"
                        tool['meta']['last_verify'] = datetime.now().strftime("%Y-%m-%d")
                        
                        requests.patch(f"{FIREBASE_URL}/tools/{tool_id}.json", json=tool)
                        print(f"[🎯 MIGRADA] {name} - Site online e IA confirmada.")
                        migrated_count += 1
                        return
                
                print(f"[🚫 PULADA] {name} - Falhou na validação de IA ou Offline.")
                skipped_count += 1
            except:
                print(f"[🚫 PULADA] {name} - Inatingível.")
                skipped_count += 1

        with ThreadPoolExecutor(max_workers=30) as executor:
            executor.map(process_and_upload, tools)
            
        print(f"\n[MIGRAÇÃO] ✅ Concluída!")
        print(f"[STATUS] Migradas: {migrated_count} | Puladas: {skipped_count}")
        input("\nPressione ENTER para fechar...")

    def run_health_check(self):
        """Remove links offline (com validação dupla)."""
        print(BANNER)
        print("[LIMPEZA] Removendo links offline (validação dupla)...")
        
        # Headers para simular navegador real
        HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
        
        def is_online(url):
            """Verifica se um URL está online."""
            try:
                res = requests.get(url, timeout=15, allow_redirects=True, headers=HEADERS, verify=False)
                return res.status_code < 400
            except:
                return False
        
        # Buscar ferramentas do Firebase
        try:
            res = requests.get(f"{FIREBASE_URL}/tools.json", timeout=30)
            firebase_tools = res.json() or {}
        except Exception as e:
            print(f"[ERRO] Não foi possível conectar ao Firebase: {e}")
            input("\nPressione ENTER para fechar...")
            return
        
        print(f"[SISTEMA] Analisando {len(firebase_tools)} ferramentas...")
        print("[INFO] Usando validação dupla (2 verificações com intervalo)\n")
        
        removed_count = 0
        checked_count = 0
        online_count = 0
        pending_removal = []  # Lista de IDs para verificação dupla
        
        # PRIMEIRA PASSADA: Identificar potenciais offline
        print("=" * 50)
        print("[FASE 1] Primeira verificação...")
        print("=" * 50)
        
        def first_check(tool_id, tool_data):
            nonlocal checked_count, online_count
            if not isinstance(tool_data, dict):
                return None
                
            url = tool_data.get('url')
            name = tool_data.get('name', 'Unknown')
            
            if not url:
                return None
            
            checked_count += 1
            
            if is_online(url):
                online_count += 1
                print(f"[✅ ONLINE] {name}")
                return None
            else:
                print(f"[⚠️ SUSPEITO] {name} - Aguardando confirmação...")
                return (tool_id, tool_data)
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(first_check, tid, tdata) for tid, tdata in firebase_tools.items()]
            for f in futures:
                result = f.result()
                if result:
                    pending_removal.append(result)
        
        if not pending_removal:
            print(f"\n[LIMPEZA] ✅ Nenhum link offline encontrado!")
            print(f"[STATUS] Verificados: {checked_count} | Online: {online_count}")
            input("\nPressione ENTER para fechar...")
            return
        
        # Aguardar antes da segunda verificação
        print(f"\n[INFO] {len(pending_removal)} links suspeitos. Aguardando 5s para segunda verificação...")
        time.sleep(5)
        
        # SEGUNDA PASSADA: Confirmar e remover
        print("\n" + "=" * 50)
        print("[FASE 2] Confirmando e removendo...")
        print("=" * 50)
        
        def second_check(tool_id, tool_data):
            nonlocal removed_count
            url = tool_data.get('url')
            name = tool_data.get('name', 'Unknown')
            
            # Segunda verificação
            if is_online(url):
                print(f"[🔄 RECUPERADO] {name} - Voltou online, mantendo!")
                return
            
            # Confirmado offline - REMOVER
            print(f"[🗑️ REMOVIDO] {name} - Confirmado offline")
            requests.delete(f"{FIREBASE_URL}/tools/{tool_id}.json")
            removed_count += 1
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(second_check, tid, tdata) for tid, tdata in pending_removal]
            for f in futures:
                f.result()
        
        print(f"\n[LIMPEZA] ✅ Concluído!")
        print(f"[STATUS] Verificados: {checked_count} | Online: {online_count} | Removidos: {removed_count}")
        input("\nPressione ENTER para fechar...")

    def verify_if_ai(self, html):
        """Analise intensiva se o conteúdo do site é de fato IA."""
        # Palavras-chave de ALTA confiança (deve ter várias)
        high_conf = ["openai", "gpt-4", "llm", "diffusion", "neural network", "transformer model", "stable diffusion", "midjourney", "anthropic", "huggingface", "cohere", "artificial intelligence", "deep learning"]
        # Palavras-chave técnicas
        tech_terms = ["api", "training", "tokens", "inference", "prompt", "nlp", "chatbot", "machine learning", "vector database", "embeddings", "fine-tune"]
        
        html_low = html.lower()
        score = 0
        
        # 1. Bônus por palavras de alta confiança
        for kw in high_conf:
            if kw in html_low: score += 5
            
        # 2. Bônus por termos técnicos
        for kw in tech_terms:
            if kw in html_low: score += 2
            
        # 3. Verificação de Meta Descrição (Geralmente onde dizem que são IA)
        if 'description' in html_low and (' ai ' in html_low or 'artificial intelligence' in html_low or 'inteligência artificial' in html_low):
            score += 10

        # 4. Verificação de Título
        if '<title>' in html_low and ('ai' in html_low or 'ia' in html_low or 'gpt' in html_low):
            score += 5

        print(f"[Análise] Score de IA: {score}")
        return score >= 15 # Aumentado para 15 para ser mais crítico ainda

    def handle_discovery_with_niches(self):
        """Processa a fila de descobertas vinda de pesquisas reais dos usuários."""
        print(BANNER)
        print("[USER-DRIVEN DISCOVERY] Iniciando busca baseada em pesquisas dos usuários...")
        
        # 1. Carregar Banco do Firebase (para verificar IAs existentes)
        try:
            r_tools = requests.get(f"{FIREBASE_URL}/tools.json", timeout=30)
            firebase_tools = r_tools.json() or {}
            existing_names = {t.get('name', '').lower() for t in firebase_tools.values() if isinstance(t, dict)}
            existing_urls = {t.get('url', '').lower() for t in firebase_tools.values() if isinstance(t, dict)}
        except:
            existing_names = set()
            existing_urls = set()
        
        # 2. Carregar Banco Local para Dual-Sync
        local_db = self.load_local_db()
        for t in local_db.get('tools', []):
            if t.get('name'): existing_names.add(t['name'].lower())
            if t.get('url'): existing_urls.add(t['url'].lower())
        
        print(f"[SISTEMA] {len(existing_names)} IAs já cadastradas no sistema.")
        
        # 3. Obter a Fila de Descoberta (discovery_queue)
        try:
            r_queue = requests.get(f"{FIREBASE_URL}/discovery_queue.json")
            queue = r_queue.json() if r_queue.status_code == 200 and r_queue.json() else {}
        except: queue = {}

        items_to_process = []
        if queue:
            for k, v in queue.items(): items_to_process.append((k, v))
        
        # 4. TAMBÉM buscar de /search_activity (pesquisas do painel)
        try:
            r_activity = requests.get(f"{FIREBASE_URL}/search_activity.json")
            activity = r_activity.json() if r_activity.status_code == 200 and r_activity.json() else {}
        except: activity = {}
        
        # Extrair termos únicos de search_activity
        processed_terms = set()
        if activity:
            for k, v in activity.items():
                if isinstance(v, dict) and v.get('query'):
                    term = v['query'].strip()
                    if term and term.lower() not in processed_terms:
                        processed_terms.add(term.lower())
                        items_to_process.append((f"search_{k}", term))
        
        # Remover duplicatas (mesmo termo)
        seen_terms = set()
        unique_items = []
        for key, term in items_to_process:
            term_lower = term.lower() if isinstance(term, str) else str(term).lower()
            if term_lower not in seen_terms:
                seen_terms.add(term_lower)
                unique_items.append((key, term))
        items_to_process = unique_items
            
        if not items_to_process:
            print("\n[INFO] Nenhuma pesquisa pendente na fila de usuários no momento.")
            print("[INFO] O robô só trabalha quando há demanda real dos seus usuários! 🤖")
            input("\nPressione ENTER para fechar...")
            return

        print(f"[SISTEMA] Total de {len(items_to_process)} buscas de usuários para investigar.")

        for query_key, query_text in items_to_process:
            query_lower = query_text.lower().strip() if isinstance(query_text, str) else str(query_text).lower()
            
            # VERIFICAR SE JÁ EXISTE NO SISTEMA (por nome similar)
            if any(query_lower in name or name in query_lower for name in existing_names):
                print(f"[✅ JÁ EXISTE] '{query_text}' - Removendo da fila (já processado).")
                requests.delete(f"{FIREBASE_URL}/discovery_queue/{query_key}.json")
                continue
                
            print(f"\n[🔍] Investigando: {query_text}...")
            
            patterns = [
                f"https://{query_text.lower().replace(' ', '')}.com",
                f"https://{query_text.lower().replace(' ', '')}.ai",
                f"https://{query_text.lower().replace(' ', '')}.io",
                f"https://{query_text.lower().replace(' ', '')}.com.br",
                f"https://{query_text.lower().replace(' ', '')}.adult",
                f"https://{query_text.lower().replace(' ', '')}.me",
                f"https://{query_text.lower().replace(' ', '')}.app",
            ]

            success = False
            found_url = ""
            pricing = "Free/Trial"

            for url in patterns:
                if url in existing_urls: continue # Pula se já existe localmente
                
                try:
                    res = requests.get(url, timeout=7, allow_redirects=True)
                    if res.status_code == 200 and len(res.text) > 500: # Verifica se o site retornou conteúdo real
                        # VERIFICAÇÃO ROBUSTA: É realmente IA?
                        if not self.verify_if_ai(res.text):
                            print(f"[!] {url} parece não ser relacionado a IA. Rejeitado.")
                            continue

                        success = True
                        found_url = res.url
                        
                        # DETECÇÃO DE PRECIFICAÇÃO
                        page_text = res.text.lower()
                        if any(x in page_text for x in ["pricing", "plans", "subscription", "buy now", "usd", "$"]):
                            pricing = "Pago / Subs"
                        if any(x in page_text for x in ["credits", "get credits", "10 credits", "tokens"]):
                            pricing = "Por Créditos"
                        if "free forever" in page_text or "open source" in page_text:
                            pricing = "Totalmente Grátis"
                        break
                except: continue
            
            # Categorização Inteligente
            q_low = query_text.lower()
            
            # FILTRO DE SEGURANÇA: Se o termo for HOT, pula totalmente
            if any(x in q_low for x in ["porn", "sex", "nude", "adult", "hot", "onlyfans"]):
                print(f"[🛡️ SEGURANÇA] Termo '{query_text}' bloqueado (HOT).")
                if not query_key.startswith("proactive_"):
                    requests.delete(f"{FIREBASE_URL}/discovery_queue/{query_key}.json")
                continue

            category = "Geral"
            if any(x in q_low for x in ["trade", "crypto", "analize", "mercado", "bitcoin", "forex"]): category = "Finanças / Trading"
            elif any(x in q_low for x in ["video", "clip", "movie", "ediçao", "text to video"]): category = "Vídeo / Edição"
            elif any(x in q_low for x in ["musica", "audio", "sound", "spotify", "music", "voice"]): category = "Música / Áudio"
            elif any(x in q_low for x in ["medico", "medicina", "vet", "veterinari", "saude"]): category = "Saúde / Medicina"
            elif any(x in q_low for x in ["advogado", "advocacia", "legal", "juridigo"]): category = "Jurídico / Advocacia"
            elif any(x in q_low for x in ["imobiliaria", "casa", "apartamento", "imo"]): category = "Imobiliário"
            elif any(x in q_low for x in ["estudos", "escola", "curso", "aprender"]): category = "Educação"
            elif any(x in q_low for x in ["game", "jogo", "play", "diversao"]): category = "Games / Diversão"
            elif any(x in q_low for x in ["code", "coding", "dev", "programaç", "agent"]): category = "Desenvolvimento"

            if success:
                new_id = int(time.time())
                new_tool = {
                    "id": new_id,
                    "name": query_text.title(),
                    "url": found_url,
                    "description": f"IA especializada em {category}. Detectamos modelo de preço: {pricing}.",
                    "category": category,
                    "pricing_tag": pricing,
                    "logo": f"https://www.google.com/s2/favicons?domain={found_url}&sz=128",
                    "meta": {
                        "added_date": datetime.now().strftime("%Y-%m-%d"),
                        "source": "Processamento Robusto"
                    }
                }
                
                # DUAL SYNC: Firebase + JSON
                requests.patch(f"{FIREBASE_URL}/tools/{new_id}.json", json=new_tool)
                if 'tools' not in local_db: local_db['tools'] = []
                local_db['tools'].append(new_tool)
                self.save_local_db(local_db)
                
                print(f"[🎯] ADICIONADA: {query_text} -> {found_url} [{category}] [{pricing}]")
            else:
                if not query_key.startswith("proactive_"):
                    print(f"[X] Não foi possível validar '{query_text}' ou ela já existe.")
            
            # Adicionar ao histórico
            history_entry = {
                "query": query_text,
                "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "status": "Validada e Adicionada" if success else "Rejeitada/Não Encontrada",
                "pricing": pricing if success else "-"
            }
            requests.post(f"{FIREBASE_URL}/discovery_history.json", json=history_entry)
            
            if not query_key.startswith("proactive_"):
                requests.delete(f"{FIREBASE_URL}/discovery_queue/{query_key}.json")

        print("\n[DESCOBERTA] ✅ Processamento dual-sync finalizado.")
        
        # LIMPEZA AUTOMÁTICA: Limpar atividade de pesquisa após processar
        print("[🧹 LIMPEZA] Limpando atividade de pesquisa e ranking...")
        try:
            # Usar PUT com null (geralmente funciona sem auth)
            r1 = requests.put(f"{FIREBASE_URL}/search_activity.json", json=None)
            if r1.status_code in [200, 204]:
                print("[✅] search_activity limpo!")
            else:
                # Tentar deletar item por item
                r_act = requests.get(f"{FIREBASE_URL}/search_activity.json")
                if r_act.status_code == 200 and r_act.json():
                    for key in r_act.json().keys():
                        requests.delete(f"{FIREBASE_URL}/search_activity/{key}.json")
                    print("[✅] search_activity limpo (item por item)!")
                else:
                    print(f"[⚠️] search_activity: não foi possível limpar")
            
        except Exception as e:
            print(f"[⚠️] Erro na limpeza: {e}")
        
        input("\nPressione ENTER para fechar...")

def main():
    manager = AIManager()
    parser = argparse.ArgumentParser(description="AI Manager Core")
    parser.add_argument("action", choices=["migrate", "health", "discovery"])
    args = parser.parse_args()
    
    if args.action == "migrate": manager.run_migration()
    elif args.action == "health": manager.run_health_check()
    elif args.action == "discovery": manager.handle_discovery_with_niches()

if __name__ == "__main__":
    main()
