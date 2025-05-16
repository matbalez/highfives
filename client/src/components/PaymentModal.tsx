import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { HighFiveDetails } from "@/lib/types";

// Lightning invoice to encode in QR code
const LIGHTNING_INVOICE = "lno1zrxq8pjw7qjlm68mtp7e3yvxee4y5xrgjhhyf2fxhlphpckrvevh50u0qfj78rhhtjxpghmyqgtmtpntmh2f5fee4zs094je6vly080f7kgsyqsrxwawhx2pdpkm6zy5rsgvvs3w8mpucvudl7dmql4hxg6g8hhjfkkqqvakre23kt02d6nsc5cwrw9dwap3m73jdl7r6nv4nyufh89nc62e0eh9xh6x0a7uqna2g0cty6razaq2kxrrq2wdpfqplvjxdrfzrp4a7dsyhtlgmnrggklu90ck6j3j8wasaq7auqqs2gvv2zuwg446m8p6z5490hyusy";

interface PaymentModalProps {
  isOpen: boolean;
  highFiveDetails: HighFiveDetails;
  onClose: () => void;
  onConfirmPayment: (qrCodeDataUrl: string) => void;
}

export default function PaymentModal({
  isOpen,
  highFiveDetails,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const qrCodeRef = React.useRef<HTMLDivElement>(null);

  const handleConfirmPayment = () => {
    // Instead of trying to send the image data, just send the Lightning invoice
    // The server can create its own QR code or include the invoice directly
    onConfirmPayment(LIGHTNING_INVOICE);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogTitle className="text-center text-xl font-bold">
          Send your bitcoin now
        </DialogTitle>
        
        <div className="mt-4 flex flex-col items-center">
          <div ref={qrCodeRef} className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={LIGHTNING_INVOICE}
              size={250}
              level="L"
              includeMargin
              className="mx-auto"
            />
          </div>
          
          <div className="text-center mt-4 text-sm text-gray-500">
            Scan this QR code with your Lightning wallet to complete the payment
          </div>
          
          <Button 
            className="mt-6 w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            onClick={handleConfirmPayment}
          >
            I have sent the bitcoin
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}