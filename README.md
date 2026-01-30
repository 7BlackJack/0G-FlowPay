# 0G FlowPay: Web3 + AI Agent Streaming Payment

## Architecture

1.  **Layer 1: Settlement Layer (0G Testnet)**
    *   `PaymentChannel.sol`: Handles deposit, close, and dispute resolution.
2.  **Layer 2: Off-chain State Channel**
    *   P2P communication between Agent A (Consumer) and Agent B (Provider).
    *   Micropayments via ECDSA signatures.
3.  **Layer 3: 0G Data Verification**
    *   Service evidence (AI logs/content) stored on 0G DA.
    *   Data pointers used in settlement/disputes.

## Workflow

1.  **Setup**: Agent A deposits funds into `PaymentChannel`.
2.  **Loop**:
    *   Agent B generates content -> Uploads to 0G DA -> Sends content + hash to Agent A.
    *   Agent A verifies -> Signs new balance -> Sends signature to Agent B.
3.  **Settlement**: Agent B submits final signature to contract to withdraw.

## Tech Stack

*   **Contracts**: Solidity
*   **Backend**: Python (Flask) for Provider Agent
*   **Client**: Python for Consumer Agent
*   **DA**: 0G DA (via SDK/Mock)
