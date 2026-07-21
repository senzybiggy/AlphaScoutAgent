import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { ShieldAlert, ChevronDown, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shortens 0x… addresses to 0x1234…abcd */
function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Replaces the static "Connect Wallet" button in the Navbar.
 * — Disconnected: shows the original button style.
 * — Connected: shows address + network + a green live indicator.
 * Clicking always opens the Reown AppKit modal.
 */
export function ConnectWalletButton({ className }: { className?: string }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  const networkName = caipNetwork?.name ?? null;

  if (isConnected && address) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => open({ view: "Account" })}
        className={cn(
          "hidden md:flex items-center gap-2 border-primary/20 hover:bg-primary/10 font-mono text-xs max-w-[260px]",
          className,
        )}
        title={address}
      >
        {/* Live indicator */}
        <span className="h-2 w-2 rounded-full bg-success animate-pulse flex-shrink-0" />

        {/* Address */}
        <span className="text-foreground truncate">{shortAddr(address)}</span>

        {/* Network */}
        {networkName && (
          <span className="text-muted-foreground opacity-60 hidden lg:inline truncate">
            · {networkName}
          </span>
        )}

        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => open()}
      className={cn(
        "hidden md:flex gap-2 border-primary/20 hover:bg-primary/10",
        className,
      )}
    >
      <ShieldAlert className="h-4 w-4 text-primary" />
      Connect Wallet
    </Button>
  );
}

/**
 * Compact status pill — shown on mobile where the full button doesn't fit.
 */
export function WalletStatusPill() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  if (!isConnected || !address) return null;

  return (
    <button
      onClick={() => open({ view: "Account" })}
      className="flex md:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-mono"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
      {shortAddr(address)}
    </button>
  );
}

/**
 * Disconnect shortcut — shown in any overflow / mobile menu if needed.
 */
export function DisconnectButton({ className }: { className?: string }) {
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();
  if (!isConnected) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => open({ view: "Account" })}
      className={cn("gap-2 text-muted-foreground hover:text-destructive", className)}
    >
      <Unplug className="h-4 w-4" />
      Wallet
    </Button>
  );
}
