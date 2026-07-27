// contexts/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system'); // 'light', 'dark', or 'system'
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Get system preference
  const getSystemTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('📱 System theme detected:', isDark ? 'dark' : 'light');
    return isDark ? 'dark' : 'light';
  };

  // Apply theme to document (with explicit class add/remove)
  const applyTheme = (currentTheme) => {
    const root = document.documentElement;
    const isDark = currentTheme === 'dark' || (currentTheme === 'system' && getSystemTheme());
    
    console.log('🎨 applyTheme called with:', {
      currentTheme,
      resolved: isDark ? 'dark' : 'light',
      hasClass: root.classList.contains('dark'),
    });
    
    setIsDarkMode(isDark);
    
    // Explicitly add/remove the class for reliability
    if (isDark) {
      root.classList.add('dark');
      console.log('🌙 Added "dark" class');
    } else {
      root.classList.remove('dark');
      console.log('☀️ Removed "dark" class');
    }
    
    // Also expose the current state globally for debugging
    window.__themeState = { currentTheme, isDarkMode: isDark };
  };

  // Toggle theme in cycle: light → dark → system → light
  const toggleTheme = () => {
    const current = theme;
    let newTheme;
    if (current === 'light') newTheme = 'dark';
    else if (current === 'dark') newTheme = 'system';
    else newTheme = 'light';
    
    console.log(`🔄 Toggling theme: ${current} → ${newTheme}`);
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  // Set a specific theme
  const setThemeMode = (mode) => {
    console.log(`🔧 Setting theme mode to: ${mode}`);
    setTheme(mode);
    localStorage.setItem('theme', mode);
    applyTheme(mode);
  };

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        console.log('🔄 System preference changed – re‑applying system theme');
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    console.log('👂 Listening for system theme changes');
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      console.log('🔇 Stopped listening for system theme changes');
    };
  }, [theme]);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'system';
    console.log('💾 Loaded saved theme from localStorage:', savedTheme);
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // For debugging: log state whenever it changes
  useEffect(() => {
    console.log('📌 Theme state updated:', { theme, isDarkMode });
  }, [theme, isDarkMode]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      isDarkMode, 
      toggleTheme, 
      setThemeMode,
      getSystemTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};