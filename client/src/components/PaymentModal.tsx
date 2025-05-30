import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { X, ChevronDown, ChevronUp } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  highFiveDetails: HighFiveDetails;
  onClose: () => void;
  onConfirmPayment: (paymentInstructions: string) => void;
}

interface PaymentData {
  paymentInstructions: string;
  paymentType?: string;
  lightningAddress?: string;
}

export default function PaymentModal({
  isOpen,
  highFiveDetails,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // Fetch payment instructions when the modal opens
  useEffect(() => {
    if (isOpen && highFiveDetails.recipient) {
      setIsLoading(true);
      setError(null);
      setPaymentData(null);
      setIsDetailsExpanded(false); // Reset expansion state
      
      // Recipient field can be either a btag or an npub
      const recipient = highFiveDetails.recipient;
      
      // Determine the type of recipient
      let endpoint;
      
      if (recipient.startsWith('npub')) {
        // Handle Nostr npub
        endpoint = `/api/payment-instructions?npub=${encodeURIComponent(recipient)}`;
      } else {
        // Handle btag/lightning with combined endpoint
        endpoint = `/api/combined-payment-instructions?address=${encodeURIComponent(recipient)}`;
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
      toast({
        title: "Error",
        description: "No valid payment instructions available.",
        variant: "destructive",
      });
      onClose();
    }
  };

  // Get the appropriate label for the QR code based on payment type and content
  const getQRCodeLabel = () => {
    if (!paymentData) return "";
    
    // Check if this is a BOLT12 offer based on the content (starts with bitcoin:?lno=)
    if (paymentData.paymentInstructions.startsWith('bitcoin:?lno=')) {
      return "Pay this BOLT12 offer";
    } else if (paymentData.paymentType === 'lnurl') {
      return "Pay this LNURL";
    } else if (paymentData.paymentType && paymentData.paymentType.includes('bolt11')) {
      return "Pay this Lightning invoice";
    } else {
      return "Scan with a Lightning wallet";
    }
  };

  // Get additional info to display (like Lightning Address)
  const getAdditionalInfo = () => {
    if (!paymentData) return null;
    
    // Only show Lightning Address for BOLT11/Lightning Address payments, not for BOLT12 offers
    // Detect BOLT12 offers by checking if the payment instruction starts with bitcoin:?lno=
    const isBolt12 = paymentData.paymentInstructions.startsWith('bitcoin:?lno=');
    
    if (paymentData.lightningAddress && !isBolt12) {
      return (
        <div className="text-center mt-2 text-xs text-gray-500">
          Lightning Address: {paymentData.lightningAddress}
        </div>
      );
    }
    return null;
  };

  // Check if payment is BOLT12 offer
  const isBolt12 = paymentData?.paymentInstructions.startsWith('bitcoin:?lno=');

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
              <div 
                ref={qrCodeRef} 
                className="bg-white p-5 rounded-lg border-2 border-gray-200"
              >
                <QRCodeSVG
                  value={paymentData.paymentInstructions}
                  size={250}
                  level="M"
                  includeMargin
                  className="mx-auto"
                />
              </div>
              
              <div className="text-center mt-4">
                <div className="text-sm text-gray-600 mb-2">{getQRCodeLabel()}</div>
                
                {/* Collapsible payment instructions */}
                <div className="mt-3">
                  {/* Collapsible header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200 text-left focus:outline-none"
                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {isBolt12 ? "See offer details" : "Payment instructions"}
                    </span>
                    {isDetailsExpanded ? 
                      <ChevronUp size={16} className="text-gray-500" /> : 
                      <ChevronDown size={16} className="text-gray-500" />
                    }
                  </button>
                  
                  {/* Collapsible content */}
                  {isDetailsExpanded && (
                    <div className="p-3 border-x border-b border-gray-200 rounded-b-md bg-white">
                      <div className="text-xs font-mono p-2 rounded border border-gray-200 overflow-auto break-all select-all cursor-pointer" style={{ fontSize: '9px', maxHeight: '120px' }}>
                        {isBolt12 
                          ? (paymentData.paymentInstructions.indexOf('lno=') !== -1 
                              ? paymentData.paymentInstructions.substring(paymentData.paymentInstructions.indexOf('lno=') + 4) // Remove lno= prefix
                              : paymentData.paymentInstructions) // Fallback if format is different
                          : paymentData.paymentInstructions // Show full invoice for other payment types
                        }
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Tap and hold on the text above to select and copy
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {getAdditionalInfo()}
            </>
          )}
          
          <div className="w-full flex flex-col gap-3 mt-4">
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
              onClick={handleConfirmPayment}
              disabled={isLoading || !paymentData || !paymentData.paymentInstructions}
            >
              {isLoading ? "Looking up payment details..." : "I have sent the bitcoin"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}