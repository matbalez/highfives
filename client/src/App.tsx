import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { StoreProvider } from "./lib/store";
import { useEffect } from "react";
import { setupWebSocket, closeWebSocket } from "./lib/websocket";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize WebSocket connection when the app loads
  useEffect(() => {
    // Only setup WebSocket in browser environment and after a short delay to ensure DOM is ready
    if (typeof window !== 'undefined') {
      // Add a small delay before initializing the WebSocket
      const initTimer = setTimeout(() => {
        // Setup WebSocket connection with proper error handling
        const ws = setupWebSocket();
      }, 1000);
      
      // Clean up function
      return () => {
        // Clear the timer if component unmounts before initialization
        clearTimeout(initTimer);
        
        // Close any open WebSocket connections using the exported function
        closeWebSocket();
      };
    }
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <TooltipProvider>
          <Toaster />
          <div className="min-h-screen flex flex-col">
            <Header />
            <Router />
            <Footer />
          </div>
        </TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

export default App;
