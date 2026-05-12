import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass =
    size === 'sm'
      ? 'max-w-md'
      : size === 'lg'
      ? 'max-w-4xl'
      : size === 'xl'
      ? 'max-w-6xl'
      : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (closeOnOverlay) onClose?.();
        }}
      />

      <div className={`relative z-10 w-full ${sizeClass} rounded-xl bg-white shadow-2xl`}>
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-[#111827]">{title || ''}</h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close modal"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        )}

        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
