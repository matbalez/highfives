import { useEffect, useRef } from "react";
import highFivesLogo from "@/assets/hf square.png";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface SuccessScreenProps {
  highFive: HighFiveDetails;
  onClose: () => void;
}

export default function SuccessScreen({ highFive, onClose }: SuccessScreenProps) {
  const { toast } = useToast();
  const toastShownRef = useRef(false);

  useEffect(() => {
    // Show toast notification only once
    if (!toastShownRef.current) {
      toast({
        title: "Your High Five was sent",
        duration: 3000,
      });
      toastShownRef.current = true;
    }

    // Handle click outside to close dialog
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('backdrop')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, toast]);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop"
      aria-modal="true"
      role="dialog"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] p-6 m-4 relative flex flex-col">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center flex-shrink-0">
          {/* Logo */}
          <img src={highFivesLogo} alt="High Fives Logo" className="h-20 mb-5" />
        </div>
        
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Card content */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 w-full border border-orange-200 shadow-sm">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-xl font-bold font-futura text-primary">
                  High Five sent to:
                </p>
                <p className="text-2xl font-bold mt-2 break-words">
                  {highFive.recipient.startsWith('npub') 
                    ? (highFive.profileName || highFive.recipient)
                    : <><span className="text-black">₿</span>{highFive.recipient}</>}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-inner max-h-48 overflow-y-auto">
                <p className="italic text-gray-700 whitespace-pre-line">{highFive.reason}</p>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <p className="text-xs text-gray-400 font-normal font-sans">
                    {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </p>
                </div>
                {highFive.sender && highFive.sender !== '<send anonymously>' && (
                  <div className="w-full sm:text-right">
                    <p className="font-medium break-words">
                      From: {highFive.sender?.startsWith('npub')
                        ? (highFive.senderProfileName || highFive.sender)
                        : highFive.sender}
                    </p>
                  </div>
                )}
                
                {/* Nostr link if available */}
                {highFive.nostrEventId && (
                  <div className="pt-3 text-center w-full">
                    <a 
                      href={`https://nostr.watch/e/${highFive.nostrEventId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 text-sm font-medium underline"
                    >
                      See on Nostr
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}