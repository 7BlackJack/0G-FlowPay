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

![0g_flowpay](assets/0g_flowpay.png)

## Tech Stack

*   **Contracts**: Solidity
*   **Backend**: Python (Flask) for Provider Agent
*   **Client**: Python for Consumer Agent
*   **DA**: 0G DA (via 0g-storage-client)

## Features

- **Real-time Streaming Payment**: Pay per message with instant signature verification.
- **Secure State Channel**: Fundamentally secure escrow contract with deposit and settlement logic.
- **Verifiable Storage**: All AI interactions are permanently stored on 0G Storage Network with verifiable on-chain hashes.
- **Live Demo UI**: Interactive React frontend to visualize the entire payment and data flow.

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js & npm
- Go 1.21+ (for compiling 0g-storage-client)
- Metamask (configured with 0G Testnet)

### 1. Installation

```bash
# Clone the repo
git clone https://github.com/7BlackJack/0G-FlowPay.git
cd 0G-FlowPay

# Install Python dependencies
pip install -r requirements.txt

# Install Frontend dependencies
cd frontend
npm install
cd ..

# Compile 0G Storage Client (Required for DA)
# Follow instructions to build 0g-storage-client and place it in 0g-storage-client-1.2.2/bin/
```

### 2. Configuration

Copy `.env.example` to `.env` and fill in your details:
- `ZG_PRIVATE_KEY`: Your 0G Testnet private key for storage uploads.
- `OPENROUTER_API_KEY`: For AI responses.

### 3. Run Demo

```bash
# Start Backend (Provider Agent)
python3 provider-agent/app.py

# Start Frontend (In a new terminal)
cd frontend && npm run dev
```

Open `http://localhost:5173` to interact with the dApp.

