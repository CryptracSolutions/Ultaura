'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';
import { TOPIC_KEYS, TOPIC_LABELS, type TopicKey } from '~/lib/resend/topic-metadata';
import { adminCreateAndSendBroadcast } from '~/lib/ultaura/newsletter-admin-actions';
import ScheduleSendDialog from './ScheduleSendDialog';

const TOPIC_OPTIONS = TOPIC_KEYS.map((value) => ({
  value,
  label: TOPIC_LABELS[value],
}));

export default function BroadcastComposer() {
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [topicKey, setTopicKey] = useState<TopicKey>(TOPIC_KEYS[0]);
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
        topicKey,
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

  const toolbarButtonClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded-md font-medium transition-colors ${
      active
        ? 'bg-primary/10 text-primary'
        : 'hover:bg-muted text-muted-foreground'
    }`;

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
        <Select
          value={topicKey}
          onValueChange={(value) => {
            if (TOPIC_KEYS.includes(value as TopicKey)) {
              setTopicKey(value as TopicKey);
            }
          }}
        >
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
        <div className="border border-border rounded-xl p-3 min-h-[200px]">
          {editor && (
            <div className="flex gap-1 border-b pb-2 mb-2">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={toolbarButtonClass(editor.isActive('bold'))}
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={toolbarButtonClass(editor.isActive('italic'))}
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={toolbarButtonClass(editor.isActive('heading', { level: 2 }))}
              >
                H2
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                className={toolbarButtonClass(editor.isActive('heading', { level: 3 }))}
              >
                H3
              </button>
              <button
                type="button"
                onClick={toggleLink}
                className={toolbarButtonClass(editor.isActive('link'))}
              >
                Link
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleBulletList().run()
                }
                className={toolbarButtonClass(editor.isActive('bulletList'))}
              >
                Bullet list
              </button>
              <button
                type="button"
                onClick={() =>
                  editor.chain().focus().toggleOrderedList().run()
                }
                className={toolbarButtonClass(editor.isActive('orderedList'))}
              >
                Ordered list
              </button>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

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
