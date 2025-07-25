import { useState, useCallback } from 'react';
import { UseClipboardReturn } from '../types/hooks';

export const useClipboard = (): UseClipboardReturn => {
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim()) {
      setCopyStatus('error');
      return false;
    }

    try {
      setCopyStatus('copying');
      
      // Use the modern Clipboard API if available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback method for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback copy method failed');
        }
      }
      
      setLastCopied(text);
      setCopyStatus('success');
      
      // Reset status after a delay
      setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error);
      setCopyStatus('error');
      
      // Reset status after a delay
      setTimeout(() => {
        setCopyStatus('idle');
      }, 2000);
      
      return false;
    }
  }, []);

  return {
    copyToClipboard,
    lastCopied,
    copyStatus
  };
};