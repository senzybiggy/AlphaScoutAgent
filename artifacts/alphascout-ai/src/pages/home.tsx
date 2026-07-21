import { Link } from "wouter";
import { ArrowRight, Terminal, Activity, Zap, Cpu, Search, Layers, ShieldAlert, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32 border-b border-border/50">
        <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03] z-0 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="container px-4 md:px-8 mx-auto relative z-10 flex flex-col items-center text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/5 px-4 py-1.5 font-mono text-sm tracking-wider">
            <Activity className="w-4 h-4 mr-2 inline-block animate-pulse" />
            OKX AI GENESIS HACKATHON
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl text-foreground">
            The Ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400 glow-text">Intelligence Edge</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            AlphaScout AI is a command center for serious crypto operators. Monitor on-chain activity, analyze smart contracts, and deploy autonomous agents to find alpha before the market does.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="h-12 px-8 font-mono tracking-wide glow-box">
              <Link href="/analyze">
                <Terminal className="w-5 h-5 mr-2" />
                LAUNCH TERMINAL
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 border-border hover:bg-muted/50">
              <Link href="/agents">
                <Cpu className="w-5 h-5 mr-2" />
                VIEW AGENTS
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-card/30">
        <div className="container px-4 md:px-8 mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Weaponized Intelligence</h2>
            <p className="text-muted-foreground max-w-2xl">Stop guessing. Start executing with institutional-grade data and AI analysis.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors scanline group">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-mono">Deep Analysis</h3>
                <p className="text-muted-foreground">Scan any wallet, token, or contract. Get instant risk scores, holder metrics, and vulnerability reports powered by AI.</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors scanline group">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-mono">Multi-Chain</h3>
                <p className="text-muted-foreground">Native support for Ethereum, Solana, Base, and OKX X Layer. One unified terminal for all your research needs.</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors scanline group">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2 font-mono">Autonomous Agents</h3>
                <p className="text-muted-foreground">Deploy specialized AI agents for continuous monitoring, pattern recognition, and automated trade execution.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats / Proof Section */}
      <section className="py-20 border-y border-border/50 bg-background relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="container px-4 md:px-8 mx-auto relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-border/50">
            <div>
              <div className="text-4xl font-bold text-primary mb-2 font-mono glow-text">14.2s</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono">Avg Analysis Time</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2 font-mono">99.9%</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono">Scam Detection</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2 font-mono">4+</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono">Chains Supported</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-foreground mb-2 font-mono">24/7</div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-mono">Agent Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Showcase Preview */}
      <section className="py-24">
        <div className="container px-4 md:px-8 mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Active Agents</h2>
              <p className="text-muted-foreground">The intelligence network powering AlphaScout.</p>
            </div>
            <Button variant="ghost" asChild className="hidden md:flex text-primary hover:text-primary/80">
              <Link href="/agents">
                View Registry <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-border/50 rounded-xl p-6 bg-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                    <h4 className="text-lg font-bold font-mono">RugSentinel</h4>
                  </div>
                  <Badge variant="outline" className="text-success border-success/30 bg-success/10">ACTIVE</Badge>
                </div>
                <p className="text-muted-foreground text-sm mb-6">Analyzes smart contracts for malicious patterns, hidden mint functions, and liquidity lock verifications.</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-secondary/50">Security</Badge>
                <Badge variant="secondary" className="bg-secondary/50">Solidity</Badge>
              </div>
            </div>

            <div className="border border-border/50 rounded-xl p-6 bg-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h4 className="text-lg font-bold font-mono">WhaleTracker</h4>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">BETA</Badge>
                </div>
                <p className="text-muted-foreground text-sm mb-6">Monitors large wallet movements and correlates them with DEX liquidity pools to predict price impact.</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-secondary/50">Monitoring</Badge>
                <Badge variant="secondary" className="bg-secondary/50">On-Chain</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Ecosystem */}
      <section className="py-24 bg-muted/20 border-y border-border/50">
        <div className="container px-4 md:px-8 mx-auto text-center">
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-10">Integrated directly with OKX Web3 Ecosystem</h2>
          <div className="flex flex-wrap justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Simple mock logos using text since we don't have images */}
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-8 h-8 bg-foreground rounded-full" /> OKX Wallet</div>
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-8 h-8 bg-foreground/80 rounded" /> X Layer</div>
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-8 h-8 border-[4px] border-foreground rounded-full" /> OKX DEX</div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 z-0" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        
        <div className="container px-4 md:px-8 mx-auto relative z-10 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Stop Reacting. Start Anticipating.</h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join the elite operators using AlphaScout AI to navigate the on-chain wilderness. The intelligence advantage is yours to claim.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-10 font-mono tracking-wide text-lg glow-box">
              <Link href="/analyze">
                INITIALIZE TERMINAL
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
