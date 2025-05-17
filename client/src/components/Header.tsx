import React, { useState } from "react";
import highFivesLogo from "../assets/hf square.png";
import { Button } from "@/components/ui/button";
import NostrConnectModal from "./NostrConnectModal";
import { useStore } from "@/lib/store";

export default function Header() {
  const { nostrUser, setNostrUser, isNostrConnected } = useStore();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Format npub for display (truncate middle for better UI)
  const formatNpub = (npub: string) => {
    if (!npub) return "";
    return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`;
  };

  // Handle disconnect from Nostr
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
            <span className="text-sm text-gray-600">
              Connected: {formatNpub(nostrUser || "")}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisconnect}
              className="font-futura text-red-600 border-red-200 hover:bg-red-50"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
            onClick={() => setIsConnectModalOpen(true)}
          >
            Connect to Nostr
          </Button>
        )}
      </div>

      <NostrConnectModal 
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={(npub) => {
          setNostrUser(npub);
          setIsConnectModalOpen(false);
        }}
      />
    </header>
  );
}
