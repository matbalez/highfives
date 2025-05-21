import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface CopyButtonProps {
  text: string;
}

/**
 * A standalone copy button component that doesn't trigger parent refreshes
 */
export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    // Prevent any default behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Use document.execCommand which doesn't cause as many side effects
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      
      if (success) {
        setCopied(true);
        toast({
          title: "Copied!",
          description: "Payment instructions copied to clipboard",
        });
        
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    } finally {
      document.body.removeChild(textarea);
    }
  };

  return (
    <span
      onClick={handleCopy}
      className="inline-flex items-center justify-center p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
      title="Copy to clipboard"
      role="button"
      tabIndex={0}
    >
      {copied ? 
        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
        <Copy className="h-4 w-4 text-gray-500" />
      }
    </span>
  );
}

export default CopyButton;