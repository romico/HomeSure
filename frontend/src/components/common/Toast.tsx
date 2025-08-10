import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  }, [onClose, id]);

  useEffect(() => {
    // 애니메이션을 위한 지연
    const showTimer = setTimeout(() => setIsVisible(true), 100);

    // 자동 닫기
    const hideTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [handleClose, duration]); // handleClose와 duration을 의존성으로 추가

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50/95 border-green-200/80 shadow-green-100/50';
      case 'error':
        return 'bg-red-50/95 border-red-200/80 shadow-red-100/50';
      case 'warning':
        return 'bg-yellow-50/95 border-yellow-200/80 shadow-yellow-100/50';
      case 'info':
        return 'bg-blue-50/95 border-blue-200/80 shadow-blue-100/50';
      default:
        return 'bg-gray-50/95 border-gray-200/80 shadow-gray-100/50';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div
      className={`w-full transform transition-all duration-300 ease-out ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95'
      }`}
    >
      <div className={`rounded-xl border-2 p-4 shadow-xl backdrop-blur-sm ${getBackgroundColor()}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold leading-5 ${getTextColor()}`}>
              {title}
            </h4>
            {message && (
              <p className={`mt-1.5 text-sm leading-5 ${getTextColor()} opacity-90`}>
                {message}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={handleClose}
              className={`inline-flex rounded-lg p-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-opacity-10 ${
                type === 'success'
                  ? 'text-green-500 hover:text-green-600 hover:bg-green-500 focus:ring-green-500'
                  : type === 'error'
                  ? 'text-red-500 hover:text-red-600 hover:bg-red-500 focus:ring-red-500'
                  : type === 'warning'
                  ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500'
                  : 'text-blue-500 hover:text-blue-600 hover:bg-blue-500 focus:ring-blue-500'
              }`}
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast; 