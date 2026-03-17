'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import type { HealthDocument, HealthDocumentCategory } from '@ultaura/types';

const CATEGORY_LABELS: Record<HealthDocumentCategory, string> = {
  lab_results: 'Lab Results',
  discharge_summary: 'Discharge Summary',
  prescription: 'Prescription',
  insurance: 'Insurance',
  imaging_scans: 'Imaging / Scans',
  doctors_notes: "Doctor's Notes",
  other: 'Other',
};

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.heic';
const MAX_SIZE_MB = 25;

interface HealthDocumentUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineId: string;
  onUploaded: (doc: HealthDocument) => void;
}

export function HealthDocumentUploadForm({
  open,
  onOpenChange,
  lineId,
  onUploaded,
}: HealthDocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HealthDocumentCategory | ''>('');
  const [documentDate, setDocumentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [fileError, setFileError] = useState<string | null>(null);

  function resetForm() {
    setFile(null);
    setTitle('');
    setCategory('');
    setDocumentDate('');
    setNotes('');
    setProgress('idle');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    if (uploading) return;
    resetForm();
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_SIZE_MB} MB limit.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
    // Pre-fill title from filename (strip extension)
    if (!title) {
      const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt.slice(0, 120));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setUploading(true);
    setProgress('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lineId', lineId);
    formData.append('title', title.trim());
    if (category) formData.append('category', category);
    if (documentDate) formData.append('documentDate', documentDate);
    if (notes) formData.append('notes', notes);

    try {
      const res = await fetch('/api/health/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const body = await res.json() as HealthDocument & { error?: string };

      if (!res.ok) {
        throw new Error(body.error ?? 'Upload failed');
      }

      setProgress('done');
      toast.success('Document uploaded');
      onUploaded(body);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setProgress('error');
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = !!file && title.trim().length > 0 && !uploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              File <span className="text-destructive">*</span>
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-foreground">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" />
                Click to select a file (PDF, JPEG, PNG, HEIC · max {MAX_SIZE_MB} MB)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              className="sr-only"
              aria-label="File input"
            />
            {fileError && (
              <p className="mt-1 text-xs text-destructive">{fileError}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="doc-title" className="block text-sm font-medium text-foreground mb-1.5">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="e.g. Blood work — March 2026"
              maxLength={120}
              required
              className="block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-0.5 text-xs text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="doc-category" className="block text-sm font-medium text-foreground mb-1.5">
              Category
            </label>
            <select
              id="doc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as HealthDocumentCategory | '')}
              className="block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Select category —</option>
              {(Object.entries(CATEGORY_LABELS) as [HealthDocumentCategory, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Document date */}
          <div>
            <label htmlFor="doc-date" className="block text-sm font-medium text-foreground mb-1.5">
              Document Date
            </label>
            <input
              id="doc-date"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="doc-notes" className="block text-sm font-medium text-foreground mb-1.5">
              Notes
            </label>
            <textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Optional notes about this document…"
              maxLength={2000}
              rows={3}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <p className="mt-0.5 text-xs text-muted-foreground text-right">{notes.length}/2000</p>
          </div>

          {/* Upload progress */}
          {progress === 'uploading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Uploading and encrypting…
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="small"
              className="min-h-[44px]"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="small"
              className="min-h-[44px] gap-1.5"
              disabled={!canSubmit}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
