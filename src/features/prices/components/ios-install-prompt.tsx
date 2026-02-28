'use client';

import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia(
      '(display-mode: standalone)'
    ).matches;
    const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');

    if (isIOS && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  function handleDismiss() {
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className='bg-background/95 fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3 backdrop-blur-sm sm:hidden'>
      <button
        onClick={handleDismiss}
        className='text-muted-foreground absolute top-3 right-3'
        aria-label='關閉'
      >
        <X className='h-4 w-4' />
      </button>
      <p className='pr-6 text-sm font-medium'>安裝價格情報 App</p>
      <p className='text-muted-foreground mt-1 flex items-center gap-1 text-xs'>
        點選
        <Share className='inline h-3.5 w-3.5' />
        分享按鈕，選擇「加入主畫面」
      </p>
    </div>
  );
}
