import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { useEffect } from "react";
import { WagmiProvider } from "wagmi";

// Pages
import { Home } from "./pages/home";
import { Analyze } from "./pages/analyze";
import { Chat } from "./pages/chat";
import { Agents } from "./pages/agents";
import { History } from "./pages/history";
import { Portfolio } from "./pages/portfolio";
import { Watchlist } from "./pages/watchlist";
import { Alerts } from "./pages/alerts";
import { ShareView } from "./pages/share";
import { Dashboard } from "./pages/dashboard";
import { SmartMoney } from "./pages/smart-money";
import { WhaleTracker } from "./pages/whale-tracker";
import { RugPullDetector } from "./pages/rug-pull";

// Components
import { Navbar } from "./components/layout/navbar";

// Wallet — imports wallet-config as a side effect, which calls createAppKit()
import { wagmiAdapter } from "./lib/wallet-config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/analyze" component={Analyze} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/watchlist" component={Watchlist} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/chat" component={Chat} />
          <Route path="/agents" component={Agents} />
          <Route path="/history" component={History} />
          <Route path="/smart-money" component={SmartMoney} />
          <Route path="/whale-tracker" component={WhaleTracker} />
          <Route path="/rug-pull" component={RugPullDetector} />
          <Route path="/share/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
