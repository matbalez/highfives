import { useForm } from "react-hook-form";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "../lib/store.tsx";
import { useToast } from "@/hooks/use-toast";
import { HighFiveDetails } from "../lib/types";
import SuccessScreen from "./SuccessScreen";
import PaymentModal from "./PaymentModal";
import { apiRequest, queryClient } from "@/lib/queryClient";

const formSchema = z.object({
  recipient: z.string().min(1, {
    message: "Recipient is required",
  }),
  reason: z.string().min(1, {
    message: "Please explain what you're giving the High Five for",
  }),
  sender: z.string().optional(),
});

export default function HighFiveForm() {
  const { bitcoinBalance, setBitcoinBalance, nostrUser } = useStore();
  const { toast } = useToast();
  const [successDetails, setSuccessDetails] = useState<HighFiveDetails | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingHighFive, setPendingHighFive] = useState<HighFiveDetails | null>(null);
  // State to track input mode (false = easy address, true = npub)
  const [isNpubMode, setIsNpubMode] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      reason: "",
      sender: nostrUser || "",
    },
  });
  
  // Update sender field when nostrUser changes (either connected or disconnected)
  useEffect(() => {
    if (nostrUser) {
      // Set the sender field with the nostrUser value when connected
      form.setValue("sender", nostrUser);
    } else {
      // Clear the sender field when disconnected
      form.setValue("sender", "");
    }
  }, [nostrUser, form]);

  // Clear the recipient field when switching between modes
  useEffect(() => {
    form.setValue("recipient", "");
  }, [isNpubMode, form]);

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  async function handleFormSubmit(values: z.infer<typeof formSchema>) {
    // Append two line breaks and high five emojis to the reason
    const enhancedReason = `${values.reason}\n\n✋✋✋`;
    
    // Show loading state while we verify payment instructions
    setIsVerifyingPayment(true);
    
    try {
      // Verify payment instructions exist
      const btag = values.recipient;
      const response = await axios.get(`/api/payment-instructions?btag=${encodeURIComponent(btag)}`);
      
      if (response.data && response.data.paymentInstructions) {
        // Store the high five details and show payment modal
        setPendingHighFive({
          recipient: values.recipient,
          reason: enhancedReason,
          sender: values.sender || undefined,
        });
        
        // Open payment modal
        setPaymentModalOpen(true);
      } else {
        // This shouldn't happen based on API design but handling just in case
        throw new Error("Invalid payment instructions");
      }
    } catch (error: any) {
      console.error("Error fetching payment instructions:", error);
      
      // Check if it's a network error vs. no payment instructions
      const isServerError = error?.response && (error.response.status >= 500 || error.response.status === 0);
      const isNotFoundError = error?.response && error.response.status === 404;
      
      if (isServerError) {
        toast({
          title: "Service Temporarily Unavailable",
          description: "We're having trouble connecting to the payment network. Please try again in a few moments.",
          variant: "destructive",
        });
      } else if (isNotFoundError) {
        toast({
          title: "Payment Instructions Not Found",
          description: "No payment instructions found for this recipient. Please verify the recipient address is correct.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Lookup Error",
          description: "There was a problem verifying this recipient. Please check the address and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsVerifyingPayment(false);
    }
  }

  async function sendHighFive(lightningInvoice: string) {
    if (!pendingHighFive) return;
    
    try {
      // Use the original reason, we'll pass the lightning invoice separately
      const enhancedReason = pendingHighFive.reason;
      
      // Send to API with lightning invoice
      await apiRequest(
        'POST',
        '/api/high-fives', 
        {
          recipient: pendingHighFive.recipient,
          reason: enhancedReason,
          sender: pendingHighFive.sender,
          lightningInvoice: lightningInvoice // Pass lightning invoice separately
        }
      );

      // Invalidate the high fives query cache
      queryClient.invalidateQueries({ queryKey: ['/api/high-fives'] });

      // Close payment modal
      setPaymentModalOpen(false);
      
      // Show success screen with details
      setSuccessDetails(pendingHighFive);
      
      // Clear pending high five
      setPendingHighFive(null);
    } catch (error) {
      console.error("Error submitting high five:", error);
      toast({
        title: "Error",
        description: "Failed to send your High Five. Please try again.",
        variant: "destructive",
      });
      
      // Close payment modal
      setPaymentModalOpen(false);
    }
  }
  
  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPendingHighFive(null);
  };
  
  const closeSuccessScreen = () => {
    setSuccessDetails(null);
    
    // Preserve Nostr user if connected when resetting form
    form.reset({
      recipient: "",
      reason: "",
      sender: nostrUser || "",
    });
  };

  return (
    <>
      {successDetails ? (
        <SuccessScreen 
          highFive={successDetails} 
          onClose={closeSuccessScreen} 
        />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="recipient"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <div className="flex justify-between items-center">
                    <FormLabel className="font-futura font-bold text-lg">Who to High Five</FormLabel>
                    <button 
                      type="button"
                      onClick={() => setIsNpubMode(!isNpubMode)}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      {isNpubMode ? "Use easy address" : "Use npub"}
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative">
                      {!isNpubMode && (
                        <span className="absolute inset-y-0 left-3 flex items-center text-black">₿</span>
                      )}
                      <Input
                        placeholder={isNpubMode ? "Enter an npub" : "Enter an Easy Bitcoin Address"}
                        className={`p-3 ${isNpubMode ? 'pl-3' : 'pl-8'} focus:ring-primary placeholder:text-gray-400 placeholder:font-normal`}
                        {...field}
                      />
                    </div>
                  </FormControl>

                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-futura font-bold text-lg">For what?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell them (specifically!) what they did that made bitcoin better."
                      className="p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />



            <FormField
              control={form.control}
              name="sender"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="font-futura font-bold text-lg">From:</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={nostrUser ? "Connected with Nostr" : "Your name or handle (Optional)"}
                      className={`p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal ${nostrUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      readOnly={!!nostrUser}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isVerifyingPayment}
              className="w-full bg-primary hover:bg-primary/90 text-white font-futura font-bold py-3 px-6 rounded-lg transition duration-300"
            >
              {isVerifyingPayment ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white"></div>
                  Verifying Payment Details...
                </div>
              ) : (
                "Send High Five"
              )}
            </Button>
          </form>
        </Form>
      )}

      {pendingHighFive && (
        <PaymentModal
          isOpen={paymentModalOpen}
          highFiveDetails={pendingHighFive}
          onClose={closePaymentModal}
          onConfirmPayment={sendHighFive}
        />
      )}
    </>
  );
}