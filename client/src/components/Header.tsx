import { useState } from "react";
import highFivesLogo from "../assets/hf square.png";
import { Button } from "@/components/ui/button";
import NostrConnectModal from "./NostrConnectModal";
import { useStore } from "@/lib/store";

export default function Header() {
  const { nostrUser, setNostrUser, isNostrConnected } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConnectClick = () => {
    setIsModalOpen(true);
  };

  const handleDisconnect = () => {
    setNostrUser(null);
  };

  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo">
          <img src={highFivesLogo} alt="High Fives Logo" className="h-12" />
        </div>
        
        {isNostrConnected ? (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium truncate max-w-[150px]">
              {nostrUser?.substring(0, 8)}...
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
            onClick={handleConnectClick}
          >
            Connect to Nostr
          </Button>
        )}
      </div>

      <NostrConnectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </header>
  );
}
