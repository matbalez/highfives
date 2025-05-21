import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Clipboard } from 'lucide-react';

type InlineButtonProps = {
  text: string;
};

// A specialized button that copies text without using React states/effects
export default function InlineButton({ text }: InlineButtonProps) {
  const { toast } = useToast();
  
  // Direct DOM manipulation to copy without affecting parent components
  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(text).then(() => {
        toast({
          title: "Copied!",
          description: "Payment instructions copied to clipboard",
        });
      })
      .catch(err => {
        console.error('Failed to copy using clipboard API:', err);
        
        // Fallback to execCommand if Clipboard API fails
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const success = document.execCommand('copy');
        document.body.removeChild(el);
        
        if (success) {
          toast({
            title: "Copied!",
            description: "Payment instructions copied to clipboard",
          });
        } else {
          throw new Error('execCommand failed');
        }
      });
    } catch (err) {
      console.error('Copy failed completely:', err);
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  return (
    <button
      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
      onClick={handleCopy}
      type="button"
    >
      <Clipboard size={16} />
      <span>Copy payment instructions</span>
    </button>
  );
}