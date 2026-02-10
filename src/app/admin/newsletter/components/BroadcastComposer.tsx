'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';
import { adminCreateAndSendBroadcast } from '~/lib/ultaura/newsletter-admin-actions';
import ScheduleSendDialog from './ScheduleSendDialog';

const TOPIC_OPTIONS = [
  { value: 'blog_digest', label: 'Blog Digest' },
  { value: 'elder_care_tips', label: 'Elder Care Tips' },
  { value: 'product_updates', label: 'Product Updates' },
] as const;

export default function BroadcastComposer() {
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [topicKey, setTopicKey] = useState('blog_digest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: '',
  });

  async function handleSend(scheduleAt?: string) {
    if (!editor || !subject.trim()) {
      setError('Subject and content are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await adminCreateAndSendBroadcast({
        subject: subject.trim(),
        previewText: previewText.trim() || undefined,
        html: editor.getHTML(),
        topicKey: topicKey as 'blog_digest' | 'elder_care_tips' | 'product_updates',
        scheduleAt,
      });

      if (result.success) {
        setSuccess(
          result.action === 'scheduled'
            ? 'Broadcast scheduled successfully.'
            : 'Broadcast sent successfully.',
        );
        setSubject('');
        setPreviewText('');
        editor.commands.clearContent();
      } else {
        setError(result.error || 'Something went wrong.');
      }
    } catch {
      setError('Failed to send broadcast.');
    } finally {
      setLoading(false);
    }
  }

  function handleSendNow() {
    if (!window.confirm('Are you sure you want to send this broadcast now? This cannot be undone.')) {
      return;
    }
    handleSend();
  }

  function handleSchedule(isoString: string) {
    setScheduleOpen(false);
    handleSend(isoString);
  }

  function toggleLink() {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField>
        <TextField.Label>Subject</TextField.Label>
        <TextField.Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Broadcast subject line"
        />
      </TextField>

      <TextField>
        <TextField.Label>Preview Text</TextField.Label>
        <TextField.Input
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Shows in inbox before opening"
        />
        <TextField.Hint>Shows in inbox before opening</TextField.Hint>
      </TextField>

      <div className="flex flex-col space-y-1">
        <label className="text-sm font-medium">Target Topic</label>
        <Select value={topicKey} onValueChange={setTopicKey}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOPIC_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col space-y-1">
        <label className="text-sm font-medium">Content</label>
        <div className="border rounded-md p-3 min-h-[200px]">
          {editor && (
            <div className="flex gap-1 border-b pb-2 mb-2">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-muted font-bold' : 'hover:bg-muted'}`}
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 text-xs rounded ${editor.isActive('italic') ? 'bg-muted italic' : 'hover:bg-muted'}`}
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-muted font-bold' : 'hover:bg-muted'}`}
              >
                H2
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-muted font-bold' : 'hover:bg-muted'}`}
              >
                H3
              </button>
              <button
                type="button"
                onClick={toggleLink}
                className={`px-2 py-1 text-xs rounded ${editor.isActive('link') ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleBulletList().run()
                }
                className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                Bullet list
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleOrderedList().run()
                }
                className={`px-2 py-1 text-xs rounded ${editor.isActive('orderedList') ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                Ordered list
              </button>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSendNow} loading={loading} disabled={loading}>
          Send Now
        </Button>
        <Button
          variant="outline"
          onClick={() => setScheduleOpen(true)}
          disabled={loading}
        >
          Schedule
        </Button>
      </div>

      <ScheduleSendDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSchedule={handleSchedule}
      />
    </div>
  );
}
