import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditScanNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onSave: (newName: string) => void;
}

const EditScanNameModal: React.FC<EditScanNameModalProps> = ({
  isOpen,
  onClose,
  initialName,
  onSave,
}) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Scan Name</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Scan Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white"
              placeholder="Enter scan name..."
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditScanNameModal;
