import os
import subprocess
import tempfile
from dotenv import load_dotenv

load_dotenv()

client_path = "./0g-storage-client-1.2.2/bin/0g-storage-client"
rpc_url = os.getenv("ZG_RPC_URL")
private_key = os.getenv("ZG_PRIVATE_KEY")
indexer_url = os.getenv("ZG_INDEXER_URL")

with tempfile.NamedTemporaryFile(delete=False, mode='wb') as tmp:
    tmp.write(b"Test Data for 0G Upload")
    tmp_path = tmp.name

cmd = [
    client_path,
    "upload",
    "--url", rpc_url, 
    "--key", private_key, 
    "--file", tmp_path,
    "--indexer", "https://indexer-storage-testnet-turbo.0g.ai" # Hardcode correct indexer
]

# Ensure no None types in cmd
cmd = [str(x) for x in cmd]

print(f"Executing: {' '.join(cmd)}")
result = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)

os.remove(tmp_path)
