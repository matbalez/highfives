import { useForm } from "react-hook-form";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      reason: "",
      sender: nostrUser || "",
    },
  });
  
  // Update sender field when nostrUser changes
  useEffect(() => {
    if (nostrUser) {
      form.setValue("sender", nostrUser);
    }
  }, [nostrUser, form]);

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
    } catch (error) {
      console.error("Error fetching payment instructions:", error);
      toast({
        title: "Payment Lookup Error",
        description: "No payment instructions found for this recipient. Please verify the recipient is a valid Bitcoin address.",
        variant: "destructive",
      });
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
    // Reset form after closing success screen
    form.reset();
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
                  <FormLabel className="font-futura font-bold text-lg">Who to High Five</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-black">₿</span>
                      <Input
                        placeholder="Enter an Easy Bitcoin Address"
                        className="p-3 pl-8 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
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
                      placeholder="Your name or handle (Optional)"
                      className="p-3 focus:ring-primary placeholder:text-gray-400 placeholder:font-normal"
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