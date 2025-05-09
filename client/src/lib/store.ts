import { createContext, useContext, useState, useEffect } from "react";
import { initializeNostr, nostrService } from "./nostr";

interface StoreContextType {
  bitcoinBalance: number;
  setBitcoinBalance: (balance: number) => void;
  notificationVisible: boolean;
  showNotification: () => void;
  hideNotification: () => void;
  nostrConfigured: boolean;
  configureNostr: (nsecKey: string) => boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(1000000);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [nostrConfigured, setNostrConfigured] = useState<boolean>(false);

  const showNotification = () => {
    setNotificationVisible(true);
  };

  const hideNotification = () => {
    setNotificationVisible(false);
  };

  const configureNostr = (nsecKey: string) => {
    const success = initializeNostr(nsecKey);
    if (success) {
      setNostrConfigured(true);
      // Store the configured state in localStorage for persistence across page refreshes
      localStorage.setItem("nostrConfigured", "true");
      // Note: We don't store the actual key for security reasons
    }
    return success;
  };

  // Check if Nostr was previously configured
  useEffect(() => {
    const wasConfigured = localStorage.getItem("nostrConfigured") === "true";
    setNostrConfigured(wasConfigured);
    
    // Connect to relays if configured
    if (wasConfigured) {
      nostrService.connectToAllRelays();
    }
    
    // Cleanup: disconnect from relays when component unmounts
    return () => {
      nostrService.disconnectFromAllRelays();
    };
  }, []);

  return (
    <StoreContext.Provider
      value={{
        bitcoinBalance,
        setBitcoinBalance,
        notificationVisible,
        showNotification,
        hideNotification,
        nostrConfigured,
        configureNostr
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};
