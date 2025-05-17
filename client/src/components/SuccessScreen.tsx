import { useEffect, useRef } from "react";
import highFivesLogo from "@/assets/hf square.png";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 relative">
        <div className="flex flex-col items-center">
          {/* Logo */}
          <img src={highFivesLogo} alt="High Fives Logo" className="h-20 mb-5" />
          
          {/* Card content */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 w-full border border-orange-200 shadow-sm">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-xl font-bold font-futura text-primary">
                  High Five sent to:
                </p>
                <p className="text-2xl font-bold mt-2 break-words">
                  <span className="text-black">₿</span>{highFive.recipient}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-inner">
                <p className="italic text-gray-700 whitespace-pre-line">{highFive.reason}</p>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                  <p className="text-xs text-gray-400 font-normal font-sans">
                    {new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                  </p>
                </div>
                {highFive.sender && (
                  <div className="w-full sm:text-right">
                    <p className="font-medium break-words">From: {highFive.sender}</p>
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