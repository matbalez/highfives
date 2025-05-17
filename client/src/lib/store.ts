import { createContext, useContext, useState } from "react";

interface StoreContextType {
  bitcoinBalance: number;
  setBitcoinBalance: (balance: number) => void;
  notificationVisible: boolean;
  showNotification: () => void;
  hideNotification: () => void;
  nostrUser: string | null;
  setNostrUser: (npub: string | null) => void;
  isNostrConnected: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(1000000);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [nostrUser, setNostrUserState] = useState<string | null>(() => {
    // Load previously connected Nostr user from localStorage on init
    if (typeof window !== 'undefined') {
      return localStorage.getItem('connectedNpub');
    }
    return null;
  });

  const showNotification = () => {
    setNotificationVisible(true);
  };

  const hideNotification = () => {
    setNotificationVisible(false);
  };
  
  // Save Nostr user to localStorage whenever it changes
  const setNostrUser = (npub: string | null) => {
    setNostrUserState(npub);
    if (typeof window !== 'undefined') {
      if (npub) {
        localStorage.setItem('connectedNpub', npub);
      } else {
        localStorage.removeItem('connectedNpub');
      }
    }
  };

  return (
    <StoreContext.Provider
      value={{
        bitcoinBalance,
        setBitcoinBalance,
        notificationVisible,
        showNotification,
        hideNotification,
        nostrUser,
        setNostrUser,
        isNostrConnected: !!nostrUser
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
