import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { X } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  highFiveDetails: HighFiveDetails;
  onClose: () => void;
  onConfirmPayment: (paymentInstructions: string) => void;
}

interface PaymentData {
  paymentInstructions: string;
  paymentType?: 'lnurl' | 'lno';
  lightningAddress?: string;
}

export default function PaymentModal({
  isOpen,
  highFiveDetails,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const qrCodeRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment instructions when the modal opens
  useEffect(() => {
    if (isOpen && highFiveDetails.recipient) {
      setIsLoading(true);
      setError(null);
      setPaymentData(null);
      
      // Recipient field can be either a btag or an npub
      const recipient = highFiveDetails.recipient;
      
      // Determine the type of recipient
      let endpoint;
      
      if (recipient.startsWith('npub')) {
        // Handle Nostr npub
        endpoint = `/api/payment-instructions?npub=${encodeURIComponent(recipient)}`;
      } else if (highFiveDetails.recipientType === 'lightning') {
        // Handle Lightning Address
        endpoint = `/api/lightning-invoice?address=${encodeURIComponent(recipient)}`;
      } else {
        // Handle btag (default)
        endpoint = `/api/payment-instructions?btag=${encodeURIComponent(recipient)}`;
      }
        
      axios.get(endpoint)
        .then(response => {
          if (response.data && response.data.paymentInstructions) {
            console.log("Payment instructions lookup successful", response.data);
            setPaymentData({
              paymentInstructions: response.data.paymentInstructions,
              paymentType: response.data.paymentType,
              lightningAddress: response.data.lightningAddress
            });
            setIsLoading(false);
          } else {
            // This shouldn't happen based on the API design but handling just in case
            throw new Error("Invalid payment instructions format");
          }
        })
        .catch(err => {
          console.error("Error fetching payment instructions:", err);
          
          // Get more specific error information if available
          let errorMessage = "Could not find payment instructions for this recipient.";
          if (err.response && err.response.data && err.response.data.details) {
            errorMessage = err.response.data.details;
          }
          
          setError(errorMessage);
          setIsLoading(false);
          
          // Close the modal after showing the error briefly
          setTimeout(() => {
            onClose();
            
            let description = "No payment instructions found for this recipient. Please verify the recipient address is correct.";
            
            // Check for specific error types
            if (recipient.startsWith('npub') && err.response && err.response.status === 404) {
              description = "This Nostr profile doesn't have a Lightning Address configured. Please try a different recipient.";
            }
            
            toast({
              title: "Payment Lookup Error",
              description,
              variant: "destructive",
            });
          }, 1500);
        });
    }
  }, [isOpen, highFiveDetails.recipient, toast, onClose]);

  const handleConfirmPayment = () => {
    // Only proceed if we have valid payment instructions
    if (paymentData && paymentData.paymentInstructions) {
      onConfirmPayment(paymentData.paymentInstructions);
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

  // Get the appropriate label for the QR code based on payment type
  const getQRCodeLabel = () => {
    if (!paymentData) return "";
    
    if (paymentData.paymentType === 'lnurl') {
      return "Pay this LNURL";
    } else if (paymentData.paymentType === 'lno') {
      return "Pay with your BOLT12 wallet";
    } else if (paymentData.paymentType === 'bolt11') {
      return "Pay this Lightning invoice";
    } else {
      return "Scan with a Lightning wallet";
    }
  };

  // Get additional info to display (like Lightning Address)
  const getAdditionalInfo = () => {
    if (!paymentData) return null;
    
    if (paymentData.paymentType === 'lnurl' && paymentData.lightningAddress) {
      return (
        <div className="text-center mt-2 text-xs text-gray-500">
          Lightning Address: {paymentData.lightningAddress}
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-6">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
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
          
          {paymentData && paymentData.paymentInstructions && (
            <>
              <div ref={qrCodeRef} className="bg-white p-5 rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={paymentData.paymentInstructions}
                  size={250}
                  level="M"
                  includeMargin
                  className="mx-auto"
                />
              </div>
              
              <div className="text-center mt-4 text-sm text-gray-600">
                {getQRCodeLabel()}
              </div>
              
              {getAdditionalInfo()}
            </>
          )}
          
          <Button 
            className="mt-6 w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            onClick={handleConfirmPayment}
            disabled={isLoading || !paymentData || !paymentData.paymentInstructions}
          >
            {isLoading ? "Looking up payment details..." : "I have sent the bitcoin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}