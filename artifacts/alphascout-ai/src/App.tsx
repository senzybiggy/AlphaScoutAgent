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
          <Route path="/analyze" component={Analyze} />
          <Route path="/chat" component={Chat} />
          <Route path="/agents" component={Agents} />
          <Route path="/history" component={History} />
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

  // Reown-recommended hierarchy: WagmiProvider → QueryClientProvider → rest of app
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
