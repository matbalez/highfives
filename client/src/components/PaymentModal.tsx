import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { HighFiveDetails } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

// Fallback Lightning invoice to use if lookup fails
const FALLBACK_INVOICE = "lno1zrxq8pjw7qjlm68mtp7e3yvxee4y5xrgjhhyf2fxhlphpckrvevh50u0qfj78rhhtjxpghmyqgtmtpntmh2f5fee4zs094je6vly080f7kgsyqsrxwawhx2pdpkm6zy5rsgvvs3w8mpucvudl7dmql4hxg6g8hhjfkkqqvakre23kt02d6nsc5cwrw9dwap3m73jdl7r6nv4nyufh89nc62e0eh9xh6x0a7uqna2g0cty6razaq2kxrrq2wdpfqplvjxdrfzrp4a7dsyhtlgmnrggklu90ck6j3j8wasaq7auqqs2gvv2zuwg446m8p6z5490hyusy";

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
          setError("Could not find payment instructions for this recipient. Using fallback payment method.");
          setPaymentInstructions(FALLBACK_INVOICE); // Use fallback for now
          setIsLoading(false);
          
          toast({
            title: "Payment Lookup Error",
            description: "Using fallback payment method. Please check the recipient's btag.",
            variant: "destructive",
          });
        });
    }
  }, [isOpen, highFiveDetails.recipient, toast]);

  const handleConfirmPayment = () => {
    // Use the fetched payment instructions or fallback
    onConfirmPayment(paymentInstructions || FALLBACK_INVOICE);
  };

  // For debugging purposes, show raw payment instructions for now
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogTitle className="text-center text-xl font-bold">
          Payment Information
        </DialogTitle>
        
        <div className="mt-4 flex flex-col items-center">
          {isLoading ? (
            <div className="text-center">
              <p>Looking up payment information...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 mb-4">
              <p>{error}</p>
            </div>
          ) : null}
          
          {/* Display the raw payment instructions for now */}
          <div className="w-full bg-gray-100 p-4 rounded-lg overflow-auto max-h-[200px] text-xs font-mono">
            <pre>{paymentInstructions || "No payment instructions found"}</pre>
          </div>
          
          {/* Also show QR code for convenience */}
          {paymentInstructions && (
            <div ref={qrCodeRef} className="bg-white p-4 rounded-lg mt-4">
              <QRCodeSVG
                value={paymentInstructions}
                size={200}
                level="L"
                includeMargin
                className="mx-auto"
              />
            </div>
          )}
          
          <Button 
            className="mt-6 w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            onClick={handleConfirmPayment}
            disabled={isLoading || !paymentInstructions}
          >
            {isLoading ? "Loading..." : "I have sent the bitcoin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}