import React from "react";

export interface ErrorMessageProps {
  message: string | null;
  onClose: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md flex justify-between items-center">
      <span className="truncate">
        ⚠️ <strong>Error:</strong> {message}
      </span>
      <button
        onClick={onClose}
        className="text-red-400 hover:text-red-700 font-bold text-xs ml-2 shrink-0 cursor-pointer"
        aria-label="Close error"
      >
        ✕
      </button>
    </div>
  );
};
