'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

interface AlertContextType {
  showAlert: (title: string, description: string, type?: 'warning' | 'error' | 'success' | 'info') => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<{
    title: string;
    description: string;
    type: 'warning' | 'error' | 'success' | 'info';
  }>({ title: '', description: '', type: 'warning' });

  const showAlert = useCallback((title: string, description: string, type: 'warning' | 'error' | 'success' | 'info' = 'warning') => {
    setContent({ title, description, type });
    setOpen(true);
  }, []);

  const hideAlert = useCallback(() => {
    setOpen(false);
  }, []);

  const getStyles = (type: string) => {
    switch (type) {
      case 'error': return { color: '#ef4444', icon: <FaExclamationTriangle /> };
      case 'success': return { color: '#22c55e', icon: <FaCheckCircle /> };
      case 'info': return { color: '#3b82f6', icon: <FaInfoCircle /> };
      default: return { color: '#f59e0b', icon: <FaExclamationTriangle /> };
    }
  };

  const { color, icon } = getStyles(content.type);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={hideAlert}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Accent Bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${color}15`, color: color }}
                >
                  {icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight mb-1">
                    {content.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {content.description}
                  </p>
                </div>
                
                <button 
                  onClick={hideAlert}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
              
              <div className="mt-8 flex justify-end">
                <button
                  onClick={hideAlert}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                  style={{ backgroundColor: color, boxShadow: `0 4px 12px ${color}40` }}
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
