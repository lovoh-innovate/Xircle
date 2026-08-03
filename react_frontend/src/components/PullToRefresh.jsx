// src/components/PullToRefresh.jsx
import React, { useRef, useState, useEffect } from 'react';
import { useRefresh } from '../contexts/RefreshContext';

const PullToRefresh = ({ children }) => {
  const { refreshAll } = useRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      // Only listen when page is at the very top
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pullDistance.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (startY.current === 0) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        pullDistance.current = delta;
        // Prevent page scroll when pulling down past threshold
        if (delta > 60) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance.current > 80) {
        setRefreshing(true);
        refreshAll(); // 🔄 triggers all registered refresh callbacks
        // Show spinner for a moment (refreshAll is async, but we show it anyway)
        setTimeout(() => setRefreshing(false), 1000);
      }
      startY.current = 0;
      pullDistance.current = 0;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshAll]);

  return (
    <div ref={containerRef} className="relative min-h-screen">
      {/* Refresh indicator */}
      {refreshing && (
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-4 z-50 pointer-events-none">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin bg-white/80 dark:bg-[#0f0f12]/80 backdrop-blur-sm shadow-lg p-1" />
        </div>
      )}
      {children}
    </div>
  );
};

export default PullToRefresh;