import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface StoreContextType {
  bitcoinBalance: number;
  setBitcoinBalance: (balance: number) => void;
  notificationVisible: boolean;
  showNotification: () => void;
  hideNotification: () => void;
  userNpub: string | null;
  setUserNpub: (npub: string | null) => void;
  isUserConnected: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(1000000);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);
  const [userNpub, setUserNpub] = useState<string | null>(null);

  // Load user npub from localStorage on initial render
  useEffect(() => {
    const savedNpub = localStorage.getItem('userNpub');
    if (savedNpub) {
      setUserNpub(savedNpub);
    }
  }, []);

  // Save user npub to localStorage when it changes
  useEffect(() => {
    if (userNpub) {
      localStorage.setItem('userNpub', userNpub);
    } else {
      localStorage.removeItem('userNpub');
    }
  }, [userNpub]);

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
        userNpub,
        setUserNpub,
        isUserConnected: !!userNpub
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