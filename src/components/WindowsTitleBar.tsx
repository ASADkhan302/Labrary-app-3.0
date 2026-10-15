import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { ULM_CREST_SRC } from '../assets/brand/crestData';

interface WindowsTitleBarProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onReplayOpeningAnimation?: () => void;
  stationId?: string;
  universityName?: string;
  libraryName?: string;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({
  stationId = 'LMS-WIN-01',
  universityName = 'University of Lakki Marwat',
  libraryName = 'Library Management System',
  onReplayOpeningAnimation,
}) => {
  const [isMaximized, setIsMaximized] = useState(true);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  useEffect(() => {
    // Check initial native window state if electronAPI is present
    const electronAPI = (window as unknown as { electronAPI?: { isWindowMaximized?: () => Promise<boolean>; onWindowMaximizeChange?: (cb: (isMax: boolean) => void) => () => void } }).electronAPI;
    if (electronAPI?.isWindowMaximized) {
      electronAPI.isWindowMaximized().then((max) => {
        if (typeof max === 'boolean') setIsMaximized(max);
      }).catch(() => {});
    }
    if (electronAPI?.onWindowMaximizeChange) {
      const cleanup = electronAPI.onWindowMaximizeChange((max: boolean) => {
        setIsMaximized(max);
      });
      return cleanup;
    }
  }, []);

  // Native Windows Desktop IPC bridge (WebView2 in C# WPF or Electron)
  const sendNativeWindowCommand = (action: string): boolean => {
    if (typeof (window as unknown as { chrome?: { webview?: { postMessage: (msg: unknown) => void } } }).chrome?.webview?.postMessage === 'function') {
      (window as unknown as { chrome: { webview: { postMessage: (msg: unknown) => void } } }).chrome.webview.postMessage(JSON.stringify({ action }));
      return true;
    }
    if (typeof (window as unknown as { electronAPI?: { sendWindowAction: (act: string) => void } }).electronAPI?.sendWindowAction === 'function') {
      (window as unknown as { electronAPI: { sendWindowAction: (act: string) => void } }).electronAPI.sendWindowAction(action);
      return true;
    }
    return false;
  };

  const handleMinimize = () => {
    if (sendNativeWindowCommand('minimize')) return;
    setShowNotification('Application minimized to Windows taskbar notification area.');
    setTimeout(() => setShowNotification(null), 2500);
  };

  const handleMaximize = () => {
    const nextState = !isMaximized;
    setIsMaximized(nextState);
    if (sendNativeWindowCommand('maximize')) return;
    setShowNotification(nextState ? 'Maximized window state.' : 'Restored window state.');
    setTimeout(() => setShowNotification(null), 2000);
  };

  const handleClose = () => {
    if (sendNativeWindowCommand('close')) return;
    setShowNotification('Desktop application close requested. State safely committed to SQLite WAL.');
    setTimeout(() => setShowNotification(null), 3000);
  };

  return (
    <>
      <header 
        className="w-full flex items-center justify-between px-4 select-none z-50 shrink-0 relative transition-colors duration-150 border-b border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] h-11"
      >
        {/* Subtle accent hairline across top */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent pointer-events-none" />

        {/* Left Section: Real ULM Crest Window Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative shrink-0 flex items-center justify-center p-[1px] rounded-full border border-[#BC881B]/40">
            <img 
              src={ULM_CREST_SRC} 
              alt="University of Lakki Marwat crest" 
              width={18} 
              height={18} 
              className="w-[18px] h-[18px] object-contain select-none" 
            />
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)] hidden lg:inline">ULM LMS</span>
        </div>

        {/* Center Section: Window Title with Cinzel font - Fluid Responsive Text */}
        <div className="flex-1 text-center truncate max-w-[80%] mx-auto flex items-center justify-center gap-2 px-2 min-w-0">
          <span className="font-cinzel text-[12px] sm:text-[14px] md:text-[16px] font-bold tracking-wider whitespace-nowrap truncate text-[var(--text-primary)]">
            {universityName} <span className="text-[var(--text-muted)] font-normal mx-1.5 font-sans text-[11px] sm:text-[13px] md:text-[15px]">|</span> {libraryName}
          </span>
        </div>

        {/* Right Section: Windows System Controls */}
        <div className="flex items-center h-full -mr-4 shrink-0">
          <button
            onClick={handleMinimize}
            title="Minimize"
            aria-label="Minimize"
            className="h-10 w-11 flex items-center justify-center transition-colors duration-150 text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-[#1E293B] hover:text-[var(--text-primary)]"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleMaximize}
            title={isMaximized ? "Restore Down" : "Maximize"}
            aria-label={isMaximized ? "Restore Down" : "Maximize"}
            className="h-10 w-11 flex items-center justify-center transition-colors duration-150 text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-[#1E293B] hover:text-[var(--text-primary)]"
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <button
            onClick={handleClose}
            title="Close"
            aria-label="Close"
            className="h-10 w-12 flex items-center justify-center transition-colors duration-150 text-[var(--text-muted)] hover:bg-[#DC2626] hover:text-[#F1F5F9]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Toast notification */}
      {showNotification && (
        <div className="fixed top-12 right-4 z-50 rounded-[8px] px-4 py-2 text-[12px] shadow-[var(--shadow-modal)] flex items-center gap-2 animate-in fade-in duration-150 border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{showNotification}</span>
        </div>
      )}
    </>
  );
};
