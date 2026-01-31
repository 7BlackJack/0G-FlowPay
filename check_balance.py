from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

w3 = Web3(Web3.HTTPProvider(os.getenv("ZG_RPC_URL")))
account = w3.eth.account.from_key(os.getenv("ZG_PRIVATE_KEY"))

print(f"Address: {account.address}")
print(f"Balance: {w3.eth.get_balance(account.address)}")
