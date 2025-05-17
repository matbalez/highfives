import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface PaymentModalProps {
  isOpen: boolean;
  highFiveDetails: HighFiveDetails;
  onClose: () => void;
  onConfirmPayment: (paymentInstructions: string) => void;
}

export default function PaymentModal({
  isOpen,
  highFiveDetails,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const qrCodeRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment instructions when the modal opens
  useEffect(() => {
    if (isOpen && highFiveDetails.recipient) {
      setIsLoading(true);
      setError(null);
      setPaymentInstructions(null);
      
      // Assume the recipient field contains the btag
      const btag = highFiveDetails.recipient;
      
      // Call our API to look up payment instructions
      axios.get(`/api/payment-instructions?btag=${encodeURIComponent(btag)}`)
        .then(response => {
          console.log("Payment instructions lookup successful", response.data);
          setPaymentInstructions(response.data.paymentInstructions);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Error fetching payment instructions:", err);
          setError("Could not find payment instructions for this recipient. Please check the btag format.");
          setIsLoading(false);
          // Close the modal after a short delay
          setTimeout(() => {
            onClose();
            
            toast({
              title: "Payment Lookup Error",
              description: "No payment instructions found for this recipient. Please verify the btag format.",
              variant: "destructive",
            });
          }, 2000);
        });
    }
  }, [isOpen, highFiveDetails.recipient, toast, onClose]);

  const handleConfirmPayment = () => {
    // Only proceed if we have valid payment instructions
    if (paymentInstructions) {
      onConfirmPayment(paymentInstructions);
    } else {
      // Should never happen now, but just in case
      toast({
        title: "Error",
        description: "No valid payment instructions available.",
        variant: "destructive",
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogTitle className="text-center text-xl font-bold">
          Send your bitcoin now
        </DialogTitle>
        <DialogDescription className="text-center mt-2">
          Scan the QR code below with your Bitcoin Lightning wallet
        </DialogDescription>
        
        <div className="mt-4 flex flex-col items-center">
          {isLoading ? (
            <div className="text-center p-8 flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4"></div>
              <p>Looking up payment information...</p>
            </div>
          ) : error ? (
            <div className="text-center text-amber-600 mb-4 p-2 bg-amber-50 rounded-md">
              <p>{error}</p>
            </div>
          ) : null}
          
          {paymentInstructions && (
            <>
              <div ref={qrCodeRef} className="bg-white p-5 rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={paymentInstructions}
                  size={250}
                  level="M"
                  includeMargin
                  className="mx-auto"
                />
              </div>
              
              <div className="text-center mt-4 text-sm text-gray-600">
                Scan with a BOLT12 wallet
              </div>
            </>
          )}
          
          <Button 
            className="mt-6 w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            onClick={handleConfirmPayment}
            disabled={isLoading || !paymentInstructions}
          >
            {isLoading ? "Looking up payment details..." : "I have sent the bitcoin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}