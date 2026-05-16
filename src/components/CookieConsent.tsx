import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'all');
    setIsVisible(false);
  };

  const handleEssential = () => {
    localStorage.setItem('cookie-consent', 'essential');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto z-50 sm:w-[360px]"
        >
          <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-zinc-100 font-semibold mb-1.5 text-base">We use cookies</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                We use cookies to save your login session and give you the best experience. Choose how you'd like us to use them.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <button
                onClick={handleEssential}
                className="flex-1 h-9 px-4 bg-transparent hover:bg-white/5 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/10"
              >
                Essential Only
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 h-9 px-4 bg-white hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-colors border border-transparent shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Accept All
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
