'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, FileImage, Download } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { HealthDocumentUploadForm } from './HealthDocumentUploadForm';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  editDocumentMetadataAction,
  deleteDocumentAction,
  type DocumentMetadataInput,
} from '~/lib/ultaura/health/actions';
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


function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500 shrink-0" aria-label="PDF" />;
  }
  return <FileImage className="h-5 w-5 text-blue-500 shrink-0" aria-label="Image" />;
}

// --- Edit metadata dialog ---

interface EditMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: HealthDocument;
  lineId: string;
  onSaved: (updated: HealthDocument) => void;
}

function EditMetadataDialog({
  open,
  onOpenChange,
  document,
  lineId,
  onSaved,
}: EditMetadataDialogProps) {
  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState<HealthDocumentCategory | ''>(document.category ?? '');
  const [documentDate, setDocumentDate] = useState(document.documentDate ?? '');
  const [notes, setNotes] = useState(document.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const input: DocumentMetadataInput = {
      title: title.trim(),
      category: (category as HealthDocumentCategory) || null,
      documentDate: documentDate || null,
      notes: notes || null,
    };
    const result = await editDocumentMetadataAction(document.id, lineId, input);
    setSaving(false);
    if (result.success) {
      toast.success('Document updated');
      onSaved(result.document);
      onOpenChange(false);
    } else {
      toast.error(result.error ?? 'Failed to update document');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <DialogTitle>Edit Document</DialogTitle>
        <form onSubmit={handleSave} className="space-y-4 mt-2">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-foreground mb-1.5">
              Title <span className="text-destructive">*</span>
            </label>
            <TextField.Input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              maxLength={120}
              required
              className="min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-foreground mb-1.5">
              Category
            </label>
            <Select
              value={category || '__none__'}
              onValueChange={(v) => setCategory(v === '__none__' ? '' : v as HealthDocumentCategory)}
            >
              <SelectTrigger id="edit-category" className="min-h-[44px]">
                <SelectValue placeholder="— Select category —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select category —</SelectItem>
                {(Object.entries(CATEGORY_LABELS) as [HealthDocumentCategory, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="edit-date" className="block text-sm font-medium text-foreground mb-1.5">
              Document Date
            </label>
            <TextField.Input
              id="edit-date"
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="edit-notes" className="block text-sm font-medium text-foreground mb-1.5">
              Notes
            </label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value.slice(0, 2000))}
              maxLength={2000}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="small"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="small"
              className="w-full"
              disabled={!title.trim() || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Document card ---

function DocumentCard({
  document,
  lineId,
  onDeleted,
  onUpdated,
}: {
  document: HealthDocument;
  lineId: string;
  onDeleted: (id: string) => void;
  onUpdated: (doc: HealthDocument) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    const result = await deleteDocumentAction(document.id, lineId);
    if (result.success) {
      toast.success('Document removed');
      onDeleted(document.id);
    } else {
      toast.error(result.error ?? 'Failed to remove document');
    }
  };

  const categoryLabel = document.category ? CATEGORY_LABELS[document.category] : null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <FileTypeIcon mimeType={document.mimeType} />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground truncate">{document.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {document.fileExtension.toUpperCase().replace('.', '')} &middot;{' '}
              {formatFileSize(document.fileSizeBytes)} &middot; Uploaded {formatDate(document.createdAt)}
            </p>
          </div>
          {categoryLabel && (
            <Badge color="normal" size="small">{categoryLabel}</Badge>
          )}
        </div>

        {/* Optional metadata */}
        {(document.documentDate || document.notes) && (
          <div className="space-y-1">
            {document.documentDate && (
              <p className="text-xs text-muted-foreground">Date: {formatDate(document.documentDate)}</p>
            )}
            {document.notes && (
              <p className="text-xs text-muted-foreground line-clamp-2">{document.notes}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <Button
            variant="outline"
            size="small"
            className="min-h-[44px] gap-1.5"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${document.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="small"
            className="min-h-[44px] gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete ${document.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <EditMetadataDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        document={document}
        lineId={lineId}
        onSaved={onUpdated}
      />

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove document"
        description={`Remove "${document.title}"? The file will be permanently deleted and cannot be recovered.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

// --- Main tab ---

interface HealthDocumentsTabProps {
  lineId: string;
  documents: HealthDocument[];
}

export function HealthDocumentsTab({ lineId, documents: initialDocuments }: HealthDocumentsTabProps) {
  const [documents, setDocuments] = useState<HealthDocument[]>(initialDocuments);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploaded = (doc: HealthDocument) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleDeleted = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdated = (updated: HealthDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-foreground">Documents</h3>
        <Button
          variant="default"
          size="small"
          className="min-h-[44px] gap-1.5"
          onClick={() => setUploadOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Upload document
        </Button>
      </div>

      {/* Content */}
      {documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground text-center py-6">
            No documents uploaded yet. Store lab results, discharge summaries, prescriptions, and
            other health documents securely.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              lineId={lineId}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))}
        </div>
      )}

      <HealthDocumentUploadForm
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        lineId={lineId}
        onUploaded={handleUploaded}
      />
    </div>
  );
}
