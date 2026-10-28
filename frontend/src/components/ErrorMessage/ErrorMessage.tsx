import React from "react";

export interface ErrorMessageProps {
  message: string | null;
  onClose: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="mb-2 px-3.5 py-2.5 bg-rose-950/60 backdrop-blur-xl border border-rose-800/60 text-rose-300 text-xs rounded-xl shadow-lg flex justify-between items-center transition-all">
      <span className="truncate font-medium flex items-center gap-1.5">
        <span className="text-rose-400">⚠️</span>
        <strong className="text-rose-200">Error:</strong> {message}
      </span>
      <button
        onClick={onClose}
        className="text-rose-400 hover:text-rose-200 bg-rose-900/40 hover:bg-rose-900/80 rounded-lg p-1 transition-colors text-xs ml-2 shrink-0 cursor-pointer"
        aria-label="Close error"
      >
        ✕
      </button>
    </div>
  );
};
