import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  TerminalSquare,
  Search,
  MessageSquare,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton, WalletStatusPill } from "@/components/wallet/connect-button";

export function Navbar() {
  const [location] = useLocation();

  const navItems = [
    { name: "Terminal", path: "/", icon: TerminalSquare },
    { name: "Analyze", path: "/analyze", icon: Search },
    { name: "History", path: "/history", icon: Clock },
    { name: "Agents", path: "/agents", icon: Cpu },
    { name: "Comm Link", path: "/chat", icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8 mx-auto">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20 glow-box">
            <Activity className="h-5 w-5 text-primary" />
            <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-md opacity-50" />
          </div>
          <span className="font-bold tracking-tight text-lg hidden sm:inline-block">
            AlphaScout{" "}
            <span className="text-primary font-mono glow-text">AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary glow-text" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right-side controls */}
        <div className="flex items-center gap-3">
          {/* System status pill — desktop */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-mono">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            SYS.ONLINE
          </div>

          {/* Wallet status pill — mobile (shown only when connected) */}
          <WalletStatusPill />

          {/* Connect / connected button — desktop */}
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
