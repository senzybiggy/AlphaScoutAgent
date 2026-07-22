import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  TerminalSquare,
  Search,
  MessageSquare,
  Clock,
  BarChart3,
  Star,
  Bell,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton, WalletStatusPill } from "@/components/wallet/connect-button";
import { useState, useEffect } from "react";

const NAV_PRIMARY = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Analyze", path: "/analyze", icon: Search },
  { name: "Portfolio", path: "/portfolio", icon: BarChart3 },
  { name: "History", path: "/history", icon: Clock },
];

const NAV_SECONDARY = [
  { name: "Watchlist", path: "/watchlist", icon: Star },
  { name: "Alerts", path: "/alerts", icon: Bell },
  { name: "Agents", path: "/agents", icon: Cpu },
  { name: "Comm Link", path: "/chat", icon: MessageSquare },
];

const ALL_NAV = [...NAV_PRIMARY, ...NAV_SECONDARY];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (path: string) =>
    location === path || (path !== "/" && location.startsWith(path));

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 mx-auto">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80 flex-shrink-0"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20 glow-box">
              <Activity className="h-5 w-5 text-primary" />
              <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-md opacity-50" />
            </div>
            <span className="font-bold tracking-tight text-base hidden sm:inline-block">
              AlphaScout{" "}
              <span className="text-primary font-mono glow-text">AI</span>
            </span>
          </Link>

          {/* Desktop nav — primary items */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_PRIMARY.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md transition-colors hover:text-primary hover:bg-primary/5",
                  isActive(item.path) ? "text-primary bg-primary/5" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
            {/* Separator */}
            <div className="w-px h-5 bg-border/40 mx-1" />
            {NAV_SECONDARY.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium px-2 xl:px-3 py-2 rounded-md transition-colors hover:text-primary hover:bg-primary/5",
                  isActive(item.path) ? "text-primary bg-primary/5" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden xl:inline">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* System status — desktop */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="hidden md:inline">SYS.</span>ONLINE
            </div>

            {/* Wallet status pill — mobile (shown when connected) */}
            <WalletStatusPill />

            {/* Connect wallet button */}
            <ConnectWalletButton />

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 top-16">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Menu panel */}
          <div className="absolute top-0 left-0 right-0 bg-background border-b border-border/50 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <nav className="container px-4 py-4 mx-auto">
              <div className="grid grid-cols-2 gap-1">
                {ALL_NAV.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.path)
                        ? "text-primary bg-primary/10 border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  SYS.ONLINE
                </div>
                <ConnectWalletButton />
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
