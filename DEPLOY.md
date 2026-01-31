# 0G FlowPay Deployment Guide

This guide explains how to deploy the 0G FlowPay application to the web so others can access it.

The deployment consists of two parts:
1.  **Backend (Provider Agent)**: A Python Flask application (Dockerized).
2.  **Frontend (Consumer Client)**: A React application (Vercel).

---

## Part 1: Backend Deployment (Render.com)

We will use **Render** (or any platform supporting Docker) to deploy the backend.

### Prerequisites
1.  Push your code to a GitHub repository.
2.  Sign up for [Render.com](https://render.com/).

### Steps
1.  **New Web Service**:
    *   Go to Render Dashboard -> "New +" -> "Web Service".
    *   Connect your GitHub repository.

2.  **Configuration**:
    *   **Runtime**: Select **Docker**.
    *   **Region**: Choose one close to your users (e.g., Singapore or Oregon).
    *   **Branch**: `main` (or your working branch).
    *   **Plan**: Free (or Starter if you need more reliability).

3.  **Environment Variables**:
    *   Add the following Environment Variables in the Render dashboard:
        *   `ZG_RPC_URL`: `https://evmrpc-testnet.0g.ai` (or your RPC URL)
        *   `ZG_PRIVATE_KEY`: **YOUR_PRIVATE_KEY** (The private key for the Provider Agent wallet)
        *   `ZG_INDEXER_URL`: `https://indexer-storage-testnet-turbo.0g.ai`
        *   `ZG_FLOW_CONTRACT`: `0x0460aA47b41a66694c0a73f66d5dbc435e006613` (Check if this is current)
        *   `OPENROUTER_API_KEY`: (If you use AI features)
        *   `PYTHONUNBUFFERED`: `1`

4.  **Deploy**:
    *   Click "Create Web Service".
    *   Render will build the Docker image (this may take a few minutes as it compiles the 0G Storage Client).
    *   Once finished, you will get a URL like `https://zero-g-flowpay-backend.onrender.com`. **Copy this URL.**

---

## Part 2: Frontend Deployment (Vercel)

We will use **Vercel** to deploy the React frontend.

### Steps
1.  **Import Project**:
    *   Go to [Vercel Dashboard](https://vercel.com/dashboard).
    *   Click "Add New..." -> "Project".
    *   Import your GitHub repository.

2.  **Configure Project**:
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Root Directory**: Click "Edit" and select `frontend`. **Important!**

3.  **Environment Variables**:
    *   Expand the "Environment Variables" section.
    *   Add:
        *   `VITE_PROVIDER_URL`: Paste your **Backend URL** from Part 1 (e.g., `https://zero-g-flowpay-backend.onrender.com`).
        *   *Note: Do not add a trailing slash `/`.*

4.  **Deploy**:
    *   Click "Deploy".
    *   Vercel will build and deploy your site.
    *   You will get a URL like `https://0g-flowpay.vercel.app`.

---

## Verification

1.  Open your Vercel URL.
2.  Connect your Wallet (MetaMask).
3.  The frontend should now communicate with your cloud-hosted backend.
4.  Try the "Start Session" and "Generate" flows.

### Troubleshooting

*   **Backend Logs**: Check Render logs if the backend fails to start. Look for "Binary not found" or "Port" issues.
*   **CORS Errors**: If the frontend says "Network Error" or "CORS", ensure the Backend URL in Vercel is correct (no trailing slash) and `https` is used.
*   **0G Storage Errors**: If uploads fail, check if the `ZG_PRIVATE_KEY` has enough 0G Testnet tokens.
