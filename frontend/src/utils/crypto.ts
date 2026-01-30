import { ethers } from "ethers";

// Replicates the Solidity/Python hashing logic:
// keccak256(abi.encodePacked(address, uint256, uint256, string))
export async function signPayment(
  signer: ethers.Signer,
  contractAddress: string,
  amount: bigint,
  nonce: number,
  blobHash: string
) {
  // Ethers v6 solidityPackedKeccak256
  // types: ["address", "uint256", "uint256", "string"]
  // values: [contractAddress, amount, nonce, blobHash]
  
  const hash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "string"],
    [contractAddress, amount, nonce, blobHash]
  );

  // Sign the binary hash (ethers handles the "\x19Ethereum Signed Message:\n32" prefix)
  const signature = await signer.signMessage(ethers.getBytes(hash));
  return signature;
}

export function generateWallet() {
  return ethers.Wallet.createRandom();
}
