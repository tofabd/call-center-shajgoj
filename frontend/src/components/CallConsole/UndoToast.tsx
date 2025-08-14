import React from 'react';
import { CheckCircle, RotateCcw } from 'lucide-react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
}

const UndoToast: React.FC<UndoToastProps> = ({ message, onUndo }) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-2">
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        onClick={onUndo}
        className="ml-4 px-3 py-1 bg-white/20 text-white text-sm rounded hover:bg-white/30 transition-colors flex items-center space-x-1"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Undo</span>
      </button>
    </div>
  );
};

export default UndoToast; 