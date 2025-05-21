import React from 'react';
import { Clipboard } from 'lucide-react';

// This is an ultra-simple copy button component that does not use React state
// to prevent any issues with re-rendering parent components

type StableButtonProps = {
  textToCopy: string;
  onCopy?: () => void;
};

const StableButton: React.FC<StableButtonProps> = ({ textToCopy, onCopy }) => {
  // Don't use any React state or hooks that could cause re-renders
  
  const handleCopyClick = (e: React.MouseEvent) => {
    // Prevent default button behavior
    e.preventDefault();
    e.stopPropagation();
    
    // Use the older execCommand API which works in more browsers
    const fallbackCopy = () => {
      try {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        
        // Make it invisible but still selectable
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        
        // Add to DOM, select text, copy, then remove
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful && onCopy) {
          onCopy();
        }
        
        return successful;
      } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
      }
    };
    
    // Try the modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          if (onCopy) onCopy();
        })
        .catch(() => {
          // If modern API fails, try the fallback
          fallbackCopy();
        });
    } else {
      // If clipboard API not available, use fallback
      fallbackCopy();
    }
  };
  
  return (
    <button
      type="button"
      className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
      onClick={handleCopyClick}
    >
      <Clipboard size={16} />
      <span>Copy payment instructions</span>
    </button>
  );
};

export default StableButton;