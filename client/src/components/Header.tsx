import { useState } from "react";
import highFivesLogo from "../assets/hf square.png";
import { Button } from "@/components/ui/button";
import NostrConnectModal from "./NostrConnectModal";
import { useStore } from "@/lib/store";
import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";

export default function Header() {
  const { nostrUser, setNostrUser, nostrProfileName, setNostrProfileName, isNostrConnected } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [location, setLocation] = useLocation();
  
  const handleConnectClick = () => {
    setIsModalOpen(true);
  };

  const handleDisconnect = () => {
    setNostrUser(null);
    setNostrProfileName(null);
  };
  
  const handleLogoClick = () => {
    // Always go back to the send tab when logo is clicked
    setLocation("/");
    
    // Set in session storage so Home component can pick it up
    window.sessionStorage.setItem("activeTab", "send");
    
    // No need for a full page reload - the Home component will read from sessionStorage
  };

  return (
    <header className="sticky top-0 bg-white shadow-md z-10">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="logo">
          <div onClick={handleLogoClick} className="cursor-pointer">
            <img src={highFivesLogo} alt="High Fives Logo" className="h-12" />
          </div>
        </div>
        
        {isNostrConnected ? (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium truncate max-w-[150px]">
              {nostrProfileName ? (
                <>
                  Nostr profile: <a 
                    href={`https://njump.me/${nostrUser}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 underline"
                  >
                    {nostrProfileName}
                  </a>
                </>
              ) : (
                <a 
                  href={`https://njump.me/${nostrUser}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 underline"
                >
                  {nostrUser?.substring(0, 8)}...
                </a>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="font-futura font-bold text-black bg-white border-2 border-primary hover:bg-white/90"
              onClick={handleDisconnect}
              title="Disconnect Nostr account"
            >
              <LogOut className="h-4 w-4" />
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
