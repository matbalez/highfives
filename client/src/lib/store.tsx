import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(1000000);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [nostrUser, setNostrUser] = useState<string | null>(null);

  // Load user npub from localStorage on initial render
  useEffect(() => {
    const savedNpub = localStorage.getItem('nostrUser');
    if (savedNpub) {
      setNostrUser(savedNpub);
    }
  }, []);

  // Save user npub to localStorage when it changes
  useEffect(() => {
    if (nostrUser) {
      localStorage.setItem('nostrUser', nostrUser);
    } else {
      localStorage.removeItem('nostrUser');
    }
  }, [nostrUser]);

  const showNotification = () => {
    setNotificationVisible(true);
  };

  const hideNotification = () => {
    setNotificationVisible(false);
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