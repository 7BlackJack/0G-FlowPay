import sys
import os
import json
import time
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from web3 import Web3
from eth_account.messages import encode_defunct
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add wrapper to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../0g-sdk-wrapper'))
from zg_client import ZGClient

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True) # Enable CORS for all domains
zg = ZGClient(rpc_url=os.getenv("ZG_RPC_URL"))

# In-memory store for sessions
sessions = {}

# Initialize Web3 for deployment
w3 = Web3(Web3.HTTPProvider(os.getenv("ZG_RPC_URL")))
account = w3.eth.account.from_key(os.getenv("ZG_PRIVATE_KEY"))

@app.route('/config', methods=['GET'])
def get_config():
    return jsonify({
        "receiver_address": account.address
    })

@app.route('/close_channel', methods=['POST', 'OPTIONS'])
def close_channel():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.json
    session_id = data.get('session_id')
    
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
        
    session = sessions[session_id]
    contract_address = session['contract_address']
    
    # Check if we have a signature to close with
    if not session.get('last_signature'):
        return jsonify({"error": "No payments to settle"}), 400
        
    try:
        # Load ABI
        artifact_path = os.path.join(os.path.dirname(__file__), '../frontend/src/contracts/PaymentChannel.json')
        with open(artifact_path, 'r') as f:
            artifact = json.load(f)
        
        abi = artifact['abi']
        contract = w3.eth.contract(address=contract_address, abi=abi)
        
        # Build transaction
        amount = int(session['balance'])
        nonce = int(session['nonce'])
        blob_hash = session['last_blob_hash']
        signature = session['last_signature']
        
        print(f"Closing channel {contract_address} with Amount: {amount}, Nonce: {nonce}")
        
        txn = contract.functions.close(amount, nonce, blob_hash, signature).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 300000,
            'gasPrice': w3.eth.gas_price
        })
        
        signed_txn = w3.eth.account.sign_transaction(txn, private_key=os.getenv("ZG_PRIVATE_KEY"))
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        print(f"Close TX sent: {tx_hash.hex()}")
        
        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return jsonify({
            "status": "closed",
            "tx_hash": tx_hash.hex(),
            "final_balance": amount
        })
        
    except Exception as e:
        print(f"Close failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/deploy', methods=['POST', 'OPTIONS'])
def deploy_contract():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    data = request.json
    client_address = data.get('client_address')
    
    if not client_address:
        return jsonify({"error": "Missing client_address"}), 400

    try:
        # Load contract artifact
        artifact_path = os.path.join(os.path.dirname(__file__), '../frontend/src/contracts/PaymentChannel.json')
        with open(artifact_path, 'r') as f:
            artifact = json.load(f)
        
        abi = artifact['abi']
        bytecode = artifact['bytecode']
        
        PaymentChannel = w3.eth.contract(abi=abi, bytecode=bytecode)
        
        # Constructor: (address _sender, address _receiver, uint256 _duration)
        receiver_address = account.address
        duration = 86400 # 1 day
        
        print(f"Deploying contract for Client: {client_address}, Receiver: {receiver_address}")
        
        construct_txn = PaymentChannel.constructor(client_address, receiver_address, duration).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 3000000,
            'gasPrice': w3.eth.gas_price
        })
        
        # Sign and send
        signed_txn = w3.eth.account.sign_transaction(construct_txn, private_key=os.getenv("ZG_PRIVATE_KEY"))
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        print(f"Deployment TX: {tx_hash.hex()}")
        
        # Wait for receipt
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        contract_address = tx_receipt.contractAddress
        
        print(f"Contract deployed at: {contract_address}")
        
        return jsonify({
            "status": "ok", 
            "contract_address": contract_address,
            "tx_hash": tx_hash.hex()
        })
        
    except Exception as e:
        print(f"Deployment failed: {e}")
        return jsonify({"error": str(e)}), 500

# Configuration from .env
PRICE_PER_TOKEN = int(os.getenv("PRICE_PER_TOKEN", 1))
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/init', methods=['POST', 'OPTIONS'])
def init_session():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    session_id = data.get('session_id')
    contract_address = data.get('contract_address')
    client_address = data.get('client_address')
    
    if not session_id or not contract_address:
        return jsonify({"error": "Missing params"}), 400
        
    sessions[session_id] = {
        "contract_address": contract_address,
        "client_address": client_address,
        "balance": 0,
        "nonce": 0,
        "last_blob_hash": ""
    }
    
    print(f"Session {session_id} started with contract {contract_address}")
    return jsonify({"status": "ok", "message": "Session initialized"})

@app.route('/generate', methods=['POST', 'OPTIONS'])
def generate():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    session_id = data.get('session_id')
    prompt = data.get('prompt')
    
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
        
    session = sessions[session_id]
    
    # Call OpenRouter API
    if OPENROUTER_API_KEY and "sk-or-v1-xx" not in OPENROUTER_API_KEY:
        try:
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            }
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                ai_data = resp.json()
                response_text = ai_data['choices'][0]['message']['content']
                # Estimate tokens (rough calc)
                token_count = len(response_text.split()) 
            else:
                response_text = f"OpenRouter Error: {resp.text}"
                token_count = 0 # Do not charge for errors
        except Exception as e:
            response_text = f"Error calling AI: {str(e)}"
            token_count = 0 # Do not charge for errors
    else:
        # Mock mode if no key provided
        response_text = f"[Mock] AI Response to '{prompt}': This is a simulated response because OPENROUTER_API_KEY is not set."
        token_count = 10

    cost = token_count * PRICE_PER_TOKEN
    
    # Upload to 0G
    print(f"Submitting to 0G with size {len(response_text)}...")
    blob_content = json.dumps({
        "prompt": prompt,
        "response": response_text,
        "timestamp": time.time(),
        "nonce": session['nonce'] + 1
    }).encode('utf-8')
    
    blob_hash = zg.submit_blob(blob_content)
    print(f"0G Submission Result: {blob_hash}")

    # If storage failed, do not charge
    if blob_hash.startswith("Error"):
        cost = 0
    
    # Update local state tentatively
    new_nonce = session['nonce'] + 1
    new_balance = session['balance'] + cost
    
    return jsonify({
        "content": response_text,
        "token_count": token_count,
        "cost": cost,
        "new_balance": new_balance,
        "new_nonce": new_nonce,
        "blob_hash": blob_hash
    })

@app.route('/verify_payment', methods=['POST', 'OPTIONS'])
def verify_payment():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    session_id = data.get('session_id')
    signature = data.get('signature')
    amount = data.get('amount')
    nonce = data.get('nonce')
    blob_hash = data.get('blob_hash')
    
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
        
    session = sessions[session_id]
    contract_address = session['contract_address']
    
    # Reconstruct the hash
    msg_hash = Web3.solidity_keccak(
        ['address', 'uint256', 'uint256', 'string'],
        [contract_address, int(amount), int(nonce), blob_hash]
    )
    
    # Verify signature
    from eth_account import Account
    message = encode_defunct(primitive=msg_hash)
    try:
        recovered_address = Account.recover_message(message, signature=signature)
    except Exception as e:
         return jsonify({"error": f"Signature recovery failed: {str(e)}"}), 400

    if recovered_address.lower() != session['client_address'].lower():
        print(f"Sig verification failed. Recovered: {recovered_address}, Expected: {session['client_address']}")
        return jsonify({"error": "Invalid signature"}), 401
        
    # Update session
    session['balance'] = amount
    session['nonce'] = nonce
    session['last_blob_hash'] = blob_hash
    session['last_signature'] = signature
    
    print(f"Payment verified! New Balance: {amount}, Nonce: {nonce}")
    
    return jsonify({"status": "ok", "confirmed_nonce": nonce})

@app.route('/close_data', methods=['GET'])
def get_close_data():
    session_id = request.args.get('session_id')
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    s = sessions[session_id]
    return jsonify({
        "amount": s['balance'],
        "nonce": s['nonce'],
        "blob_hash": s['last_blob_hash'],
        "signature": s.get('last_signature')
    })

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    app.run(host='0.0.0.0', port=port, debug=debug)
