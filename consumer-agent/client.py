import requests
import time
import uuid
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

# Configuration
PROVIDER_URL = "http://127.0.0.1:5000"
CONTRACT_ADDRESS = "0x" + "1"*40  # Dummy address
PRIVATE_KEY = "0x" + "a"*64       # Dummy private key (DO NOT USE IN PRODUCTION)
# Let's generate a real random account for validity
account = Account.create()
CLIENT_ADDRESS = account.address
PRIVATE_KEY = account.key.hex()

print(f"Client Address: {CLIENT_ADDRESS}")

def main():
    session_id = str(uuid.uuid4())
    
    # 1. Init Session
    print(f"\n[1] Initializing Session {session_id}...")
    resp = requests.post(f"{PROVIDER_URL}/init", json={
        "session_id": session_id,
        "contract_address": CONTRACT_ADDRESS,
        "client_address": CLIENT_ADDRESS
    })
    if resp.status_code != 200:
        print(f"Init failed: {resp.status_code} {resp.text}")
        return

    print("Session initialized.")
    
    # 2. Service Loop
    for i in range(1, 4): # Do 3 iterations
        print(f"\n[2.{i}] Requesting generation...")
        prompt = f"Write function {i}"
        
        # Request Generation
        resp = requests.post(f"{PROVIDER_URL}/generate", json={
            "session_id": session_id,
            "prompt": prompt
        })
        data = resp.json()
        
        content = data['content']
        new_balance = data['new_balance']
        new_nonce = data['new_nonce']
        blob_hash = data['blob_hash']
        
        print(f"Received Content: {content[:30]}...")
        print(f"0G Blob Hash: {blob_hash}")
        print(f"New Balance to sign: {new_balance}")
        
        # Verify & Sign
        # Recreate the hash to sign: keccak256(abi.encodePacked(contract_address, amount, nonce, blob_hash))
        msg_hash = Web3.solidity_keccak(
            ['address', 'uint256', 'uint256', 'string'],
            [CONTRACT_ADDRESS, int(new_balance), int(new_nonce), blob_hash]
        )
        
        message = encode_defunct(primitive=msg_hash)
        signature = Account.sign_message(message, private_key=PRIVATE_KEY).signature.hex()
        
        print(f"Signed payment. Signature: {signature[:10]}...")
        
        # Send Payment
        pay_resp = requests.post(f"{PROVIDER_URL}/verify_payment", json={
            "session_id": session_id,
            "signature": signature,
            "amount": new_balance,
            "nonce": new_nonce,
            "blob_hash": blob_hash
        })
        
        if pay_resp.status_code == 200:
            print("Payment accepted by Provider.")
        else:
            print("Payment rejected!", pay_resp.text)
            break
            
        time.sleep(1)

    print("\n[3] Session Complete. Channel can be closed with final signature.")

if __name__ == "__main__":
    main()
