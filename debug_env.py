import os
import sys
from dotenv import load_dotenv

load_dotenv()

rpc_url = os.getenv("ZG_RPC_URL")
private_key = os.getenv("ZG_PRIVATE_KEY")
client_path = os.getenv("ZG_STORAGE_CLIENT_PATH", "./0g-storage-client-1.2.2/bin/0g-storage-client")

print(f"ZG_RPC_URL: {rpc_url}")
print(f"ZG_PRIVATE_KEY: {'*' * 10 if private_key else 'None'}")
print(f"ZG_STORAGE_CLIENT_PATH: {client_path}")
print(f"Client Path Exists: {os.path.exists(client_path)}")

if os.path.exists(client_path):
    print("Trying to execute client version...")
    import subprocess
    try:
        result = subprocess.run([client_path, "help"], capture_output=True, text=True)
        print(f"Return Code: {result.returncode}")
        print(f"Stdout start: {result.stdout[:50]}")
        print(f"Stderr start: {result.stderr[:50]}")
    except Exception as e:
        print(f"Execution failed: {e}")
