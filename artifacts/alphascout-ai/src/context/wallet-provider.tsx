import { WagmiProvider } from "wagmi";
import { wagmiAdapter } from "@/lib/wallet-config";

// Side-effect import: runs createAppKit() once when the module is first loaded.
import "@/lib/wallet-config";

interface WalletProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app with the Wagmi / Reown AppKit provider.
 * Must sit INSIDE QueryClientProvider so wagmi can share the same React Query cache.
 */
export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>{children}</WagmiProvider>
  );
}
