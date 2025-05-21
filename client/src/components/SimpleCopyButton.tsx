import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SimpleCopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

// A very simple copy button component that doesn't interact with React state
export default function SimpleCopyButton({ text, label = "Copy", className = "" }: SimpleCopyButtonProps) {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);
  
  // Just copy the text without using state that might trigger a re-render
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.value = text;
    document.body.appendChild(textArea);
    
    // Select and copy the text
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast({
          title: "Copied!",
          description: "Payment instructions copied to clipboard",
        });
        
        // Show copied status briefly
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
    
    // Clean up
    document.body.removeChild(textArea);
  };
  
  return (
    <button
      type="button"
      className={`px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition-colors ${className}`}
      onClick={handleCopy}
    >
      {isCopied ? 'Copied!' : label}
    </button>
  );
}