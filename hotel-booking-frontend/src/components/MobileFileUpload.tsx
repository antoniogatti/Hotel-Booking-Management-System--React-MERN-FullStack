import { useState, useRef } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  uploadedAt: Date;
}

interface MobileFileUploadProps {
  label?: string;
  description?: string;
  onFilesChange?: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
}

export const MobileFileUpload = ({
  label = "Upload Files",
  description = "Tap to upload or take a photo",
  onFilesChange,
  accept = "image/*",
  multiple = true,
  maxSize = 10,
}: MobileFileUploadProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    setError("");
    const filesArray = Array.from(files);
    const acceptedFiles = filesArray.filter((file) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        setError(`File "${file.name}" is larger than ${maxSize}MB`);
        return false;
      }
      return true;
    });

    if (!multiple && filesArray.length > 0 && uploadedFiles.length > 0) {
      setError("Only one file allowed");
      return;
    }

    Promise.all(
      acceptedFiles.map(
        (file) =>
          new Promise<UploadedFile>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                id: `${Date.now()}-${Math.random()}`,
                file,
                preview: String(e.target?.result || ""),
                uploadedAt: new Date(),
              });
            };
            reader.readAsDataURL(file);
          })
      )
    ).then((newFiles) => {
      const updated = multiple ? [...uploadedFiles, ...newFiles] : newFiles.slice(0, 1);
      setUploadedFiles(updated);
      onFilesChange?.(updated.map((f) => f.file));
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => {
    const updated = uploadedFiles.filter((f) => f.id !== id);
    setUploadedFiles(updated);
    onFilesChange?.(updated.map((f) => f.file));
  };

  return (
    <div className="space-y-4">
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-full px-4 py-8 border-2 border-dashed border-primary-300 rounded-lg bg-primary-50 cursor-pointer hover:bg-primary-100 transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Upload className="h-8 w-8 text-primary-600" />
        <p className="text-sm font-medium text-gray-900">{description}</p>
        <p className="text-xs text-gray-600">Max {maxSize}MB per file</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        capture="environment" // Enable camera on mobile
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {uploadedFiles.map((fileObj) => (
              <div key={fileObj.id} className="relative group">
                <img
                  src={fileObj.preview}
                  alt="Preview"
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(fileObj.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <p className="text-xs text-gray-600 mt-1 truncate">
                  {fileObj.file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
