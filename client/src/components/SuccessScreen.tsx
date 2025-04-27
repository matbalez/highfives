import { Button } from "@/components/ui/button";
import highFivesLogo from "../assets/hf-square.png";
import { HighFiveDetails } from "../lib/types";

interface SuccessScreenProps {
  highFive: HighFiveDetails;
  onClose: () => void;
}

export default function SuccessScreen({ highFive, onClose }: SuccessScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 relative">
        <div className="flex flex-col items-center">
          {/* Logo */}
          <img src={highFivesLogo} alt="High Fives Logo" className="h-16 mb-4" />
          
          <h1 className="text-2xl font-futura font-bold text-center mb-6">
            High Five Sent!
          </h1>
          
          {/* Card content */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 w-full mb-6 border border-orange-200 shadow-sm">
            <div className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-xl font-bold font-futura text-primary">
                  You sent a High Five to
                </p>
                <p className="text-2xl font-bold mt-2">
                  ₿{highFive.recipient}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 shadow-inner">
                <p className="italic text-gray-700">{highFive.reason}</p>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-xl font-bold">{highFive.amount.toLocaleString()} ₿</p>
                </div>
                {highFive.sender && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">From</p>
                    <p className="font-medium">{highFive.sender}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300 w-full"
          >
            Send Another High Five
          </Button>
        </div>
      </div>
    </div>
  );
}