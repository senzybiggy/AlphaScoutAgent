import { Link, useLocation } from "wouter";
import {
  Activity,
  Cpu,
  Search,
  MessageSquare,
  Clock,
  BarChart3,
  Star,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  TrendingUp,
  Fish,
  Shield,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton, WalletStatusPill } from "@/components/wallet/connect-button";
import { useState, useEffect, useRef } from "react";

const NAV_PRIMARY = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Analyze", path: "/analyze", icon: Search },
  { name: "Portfolio", path: "/portfolio", icon: BarChart3 },
  { name: "History", path: "/history", icon: Clock },
];

const NAV_INTELLIGENCE = [
  { name: "Smart Money", path: "/smart-money", icon: TrendingUp, desc: "Follow high-signal wallets" },
  { name: "Whale Tracker", path: "/whale-tracker", icon: Fish, desc: "Holder concentration analysis" },
  { name: "Rug Pull Detector", path: "/rug-pull", icon: Shield, desc: "GoPlus security checklist" },
];

const NAV_SECONDARY = [
  { name: "Watchlist", path: "/watchlist", icon: Star },
  { name: "Alerts", path: "/alerts", icon: Bell },
  { name: "Agents", path: "/agents", icon: Cpu },
  { name: "Comm Link", path: "/chat", icon: MessageSquare },
];

const ALL_NAV = [...NAV_PRIMARY, ...NAV_INTELLIGENCE, ...NAV_SECONDARY];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const intelligenceRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setIntelligenceOpen(false); }, [location]);

  // Close on Escape or outside click
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileOpen(false); setIntelligenceOpen(false); }
    };
    const clickHandler = (e: MouseEvent) => {
      if (intelligenceRef.current && !intelligenceRef.current.contains(e.target as Node)) {
        setIntelligenceOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    document.addEventListener("mousedown", clickHandler);
    return () => { window.removeEventListener("keydown", handler); document.removeEventListener("mousedown", clickHandler); };
  }, []);

  const isActive = (path: string) =>
    location === path || (path !== "/" && location.startsWith(path));

  const isIntelligenceActive = NAV_INTELLIGENCE.some((item) => isActive(item.path));

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

          {/* Desktop nav */}
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
            {/* Intelligence dropdown */}
            <div ref={intelligenceRef} className="relative">
              <button
                onClick={() => setIntelligenceOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md transition-colors hover:text-primary hover:bg-primary/5",
                  isIntelligenceActive ? "text-primary bg-primary/5" : "text-muted-foreground",
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Intelligence</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", intelligenceOpen && "rotate-180")} />
              </button>
              {intelligenceOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {NAV_INTELLIGENCE.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-primary/5 hover:text-primary mx-1 rounded-lg",
                        isActive(item.path) ? "text-primary bg-primary/5" : "text-muted-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-xs">{item.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
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
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 left-0 right-0 bg-background border-b border-border/50 shadow-lg animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="container px-4 py-4 mx-auto space-y-4">
              {/* Primary nav */}
              <div className="grid grid-cols-2 gap-1">
                {NAV_PRIMARY.map((item) => (
                  <Link key={item.path} href={item.path}
                    className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.path) ? "text-primary bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/10")}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />{item.name}
                  </Link>
                ))}
              </div>
              {/* Intelligence section */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest px-1 mb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />Intelligence
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {NAV_INTELLIGENCE.map((item) => (
                    <Link key={item.path} href={item.path}
                      className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        isActive(item.path) ? "text-primary bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/10")}>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <p>{item.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/50">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              {/* Secondary nav */}
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/20">
                {NAV_SECONDARY.map((item) => (
                  <Link key={item.path} href={item.path}
                    className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.path) ? "text-primary bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/10")}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />{item.name}
                  </Link>
                ))}
              </div>
              <div className="pt-2 border-t border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />SYS.ONLINE
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
