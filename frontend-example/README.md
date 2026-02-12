# Noah-Mina Frontend Example 🎨

**A Reference Implementation for ZK-KYC on Mina.**

This is a React + Vite application that demonstrates the full end-to-end flow of the Noah-Mina system. It provides a UI for users to scan passports, generate proofs, and submit them to the blockchain.

## ✨ Features

-   **Passport Scanning**: Uses `Tesseract.js` to read MRZ data from passport images in the browser.
-   **Wallet Connection**: Integrates with **Auro Wallet** for signing transactions.
-   **ZK Proof Generation**: Generates zero-knowledge proofs locally using `o1js` and `noah-mina-sdk`.
-   **Real-time Status**: Tracks the user's KYC status on the Mina Devnet.

## 🚀 Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure you have the following variables (defaults provided for Devnet):

```env
VITE_MINA_NETWORK_URL=https://api.minascan.io/node/devnet/v1/graphql
VITE_CONTRACT_ADDRESS=B62qo2o6fkyLRTgDpVWiyQGtQQvSVGSCAALVvkq1QnxwJH2SWXEwLaT
```

### 2. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) in your browser.

## 🛠️ Key Components

### `useNoahSDK` Hook
This custom hook (`src/hooks/useNoahSDK.ts`) manages the complex state machine of the KYC process.

```typescript
const { 
  connectWallet, 
  scanMRZ, 
  generateProof, 
  registerOnChain, 
  step 
} = useNoahSDK();
```

It handles:
1.  **Initialization**: Loading the heavy ZK libraries (`o1js`) lazily.
2.  **Wallet Logic**: Switching accounts and detecting changes.
3.  **Flow Control**: Managing the `Scan -> Verify -> Proof -> Submit` pipeline.

### `MRZScanner` Component
A wrapper around the camera and OCR logic. It parses the raw text from the physical document into structured JSON (`Name`, `DOB`, `Expiry`) that the SDK can consume.

---

*Powered by Noah-Mina SDK*
