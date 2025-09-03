import React, { useRef } from 'react';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  isOpen,
  onClose,
  onFileSelected
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-text-bright mb-4">Import World</h2>

        <p className="text-text-dim mb-6">
          Select a JSONL file containing a previously exported world.
        </p>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jsonl"
            onChange={handleFileChange}
            className="block w-full text-sm text-text-dim
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-accent file:text-background
              hover:file:bg-accent/90
              cursor-pointer"
          />

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="btn btn-secondary px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
