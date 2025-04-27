import { createContext, useContext, useState, type ReactNode } from "react";

interface StoreContextType {
  bitcoinBalance: number;
  setBitcoinBalance: (balance: number) => void;
  notificationVisible: boolean;
  showNotification: () => void;
  hideNotification: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [bitcoinBalance, setBitcoinBalance] = useState<number>(1000000);
  const [notificationVisible, setNotificationVisible] = useState<boolean>(false);

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
        hideNotification
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