from web3 import Web3
from eth_account import Account
import os

w3 = Web3()
account = Account.create()
txn = {
    'to': account.address,
    'value': 0,
    'gas': 2000000,
    'gasPrice': 1000000000,
    'nonce': 0,
    'chainId': 1
}
signed_txn = w3.eth.account.sign_transaction(txn, private_key=account.key)
print(f"Dir of signed_txn: {dir(signed_txn)}")
try:
    print(f"rawTransaction: {signed_txn.rawTransaction}")
except AttributeError as e:
    print(f"Error accessing rawTransaction: {e}")

try:
    print(f"raw_transaction: {signed_txn.raw_transaction}")
except AttributeError as e:
    print(f"Error accessing raw_transaction: {e}")
