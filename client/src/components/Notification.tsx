import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../lib/store.tsx";

export default function Notification() {
  const { notificationVisible, hideNotification } = useStore();
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (notificationVisible) {
      const timer = setTimeout(() => {
        setAnimateIn(true);
      }, 10);
      
      const hideTimer = setTimeout(() => {
        setAnimateIn(false);
        setTimeout(() => {
          hideNotification();
        }, 500);
      }, 3000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    } else {
      setAnimateIn(false);
    }
  }, [notificationVisible, hideNotification]);

  if (!notificationVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg transform transition-all duration-500 ${
        animateIn ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      <div className="flex items-center">
        <CheckIcon className="h-6 w-6 mr-2" />
        <p>High Five sent successfully!</p>
      </div>
    </div>
  );
}
