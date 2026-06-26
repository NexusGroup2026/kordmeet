import requests

FIREBASE_URL = "https://kakaxicenter-default-rtdb.firebaseio.com"

def clear_changelog():
    url = f"{FIREBASE_URL}/changelog.json"
    print(f"Limpando banco de dados em: {url}")
    response = requests.delete(url)
    if response.status_code == 200:
        print("Done: Database /changelog limpo com sucesso!")
    else:
        print(f"Error: falha ao limpar database: {response.status_code}")

if __name__ == "__main__":
    clear_changelog()
