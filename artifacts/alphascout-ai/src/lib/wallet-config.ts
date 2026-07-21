import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  bsc,
  optimism,
} from "@reown/appkit/networks";

// Obtain a free Project ID at https://cloud.reown.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

if (!projectId) {
  console.warn(
    "[AlphaScout] VITE_WALLETCONNECT_PROJECT_ID is not set. " +
      "Wallet connection will not work. Get a free Project ID at https://cloud.reown.com",
  );
}

export const networks = [mainnet, base, arbitrum, polygon, bsc, optimism] as const;

export const wagmiAdapter = new WagmiAdapter({
  projectId: projectId ?? "",
  networks,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: projectId ?? "",
  metadata: {
    name: "AlphaScout AI",
    description:
      "Blockchain intelligence platform — deep-scan analysis for wallets, tokens, and contracts.",
    url: typeof window !== "undefined" ? window.location.origin : "https://alphascout.ai",
    icons: ["https://alphascout.ai/icon.png"],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-color-mix": "#1d4ed8",
    "--w3m-color-mix-strength": 20,
    "--w3m-accent": "#3b82f6",
    "--w3m-border-radius-master": "4px",
    "--w3m-font-family": "ui-monospace, monospace",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  // Prominently feature the requested wallets
  featuredWalletIds: [
    // MetaMask
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    // OKX Wallet
    "971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709",
    // Rabby Wallet
    "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4",
    // Coinbase Wallet
    "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
  ],
});
