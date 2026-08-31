// pages/WriteNote.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '../slices/personalNoteApiSlice';
import toast from 'react-hot-toast';
import {
  FaArrowLeft,
  FaSave,
  FaSpinner,
  FaTrashAlt,
  FaTimes,
  FaEdit,
  FaCheck,
} from 'react-icons/fa';

// ─── Toolbar ──────────────────────────────────────────────────────────────
const Toolbar = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-[#1e1e26] sticky top-0 z-10">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('bold')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('italic')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('strike')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        <s>S</s>
      </button>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700" />

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('heading', { level: 1 })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        H2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        H3
      </button>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('bulletList')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        • List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('orderedList')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        1. List
      </button>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700" />

      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive({ textAlign: 'left' })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        ←
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive({ textAlign: 'center' })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        ↔
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive({ textAlign: 'right' })
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        →
      </button>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700" />

      <button
        onClick={() => {
          const url = window.prompt('Enter the link URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={`p-1.5 rounded-lg text-sm transition ${
          editor.isActive('link')
            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
        }`}
        type="button"
      >
        🔗
      </button>

      <button
        onClick={() => {
          const url = window.prompt('Enter the image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        className="p-1.5 rounded-lg text-sm transition text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        type="button"
      >
        🖼️
      </button>

      <button
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        className="p-1.5 rounded-lg text-sm transition text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50"
        type="button"
      >
        ✕ Clear
      </button>
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────
const WriteNote = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const isNew = noteId === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // New notes open straight into edit mode. Existing notes open read-only
  // until the user explicitly taps "Enable Editing".
  const [isEditing, setIsEditing] = useState(isNew);

  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, {
    skip: isNew,
  });

  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();

  // Tracks which note's content is currently loaded into the editor, so we
  // only ever push content into Tiptap once per note — never on every
  // keystroke. (That was the bug: re-running setContent on every onUpdate
  // reset the cursor position on every character, which is why typing —
  // especially space — looked broken.)
  const loadedNoteRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link,
      Image,
      Placeholder.configure({
        placeholder: 'Start writing your note...',
      }),
    ],
    content: '<p></p>',
    editable: isEditing,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  });

  // Reset edit/view mode whenever the note being viewed changes (e.g.
  // navigating from note A to note B without unmounting the component).
  useEffect(() => {
    setIsEditing(isNew);
  }, [noteId, isNew]);

  // Load note data into local state + editor exactly once per note.
  useEffect(() => {
    if (!editor) return;

    if (isNew) {
      if (loadedNoteRef.current !== 'new') {
        setTitle('');
        setContent('');
        setIsPublic(false);
        editor.commands.setContent('<p></p>');
        loadedNoteRef.current = 'new';
      }
      return;
    }

    if (noteData?.note && loadedNoteRef.current !== noteData.note._id) {
      setTitle(noteData.note.title || '');
      setContent(noteData.note.content || '');
      setIsPublic(noteData.note.isPublic || false);
      editor.commands.setContent(noteData.note.content || '<p></p>');
      loadedNoteRef.current = noteData.note._id;
    }
  }, [editor, noteData, isNew, noteId]);

  // Keep the editor's editable state in sync with the read/edit toggle.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) {
      editor.commands.focus('end');
    }
  }, [editor, isEditing]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content || '',
        isPublic,
      };

      if (isNew) {
        const result = await createNote(payload).unwrap();
        toast.success('Note created');
        navigate(`/notes/${result.note._id}`);
      } else {
        await updateNote({ noteId, data: payload }).unwrap();
        toast.success('Note updated');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    try {
      await deleteNote(noteId).unwrap();
      toast.success('Note deleted');
      navigate('/notes');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete note');
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <FaSpinner className="animate-spin text-teal-500 text-3xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f0f12] overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12] flex-shrink-0">
        <button
          onClick={() => navigate('/notes')}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
        >
          <FaArrowLeft className="text-base" />
        </button>

        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="flex-1 bg-transparent border-none outline-none text-lg font-semibold text-gray-800 dark:text-white placeholder-gray-400 min-w-0"
            autoFocus={isNew}
          />
        ) : (
          <h1 className="flex-1 min-w-0 text-lg font-semibold text-gray-800 dark:text-white truncate">
            {title || 'Untitled Note'}
          </h1>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing && (
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="accent-teal-600"
              />
              Public
            </label>
          )}

          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-2 text-sm"
              >
                {isSaving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save
              </button>
              {!isNew && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                  title="Done editing"
                >
                  <FaCheck className="text-sm" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center gap-2 text-sm"
            >
              <FaEdit className="text-xs" />
              Enable Editing
            </button>
          )}

          {!isNew && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <FaTrashAlt className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Editor ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEditing && <Toolbar editor={editor} />}
        <div
          className={`mt-4 rounded-xl p-4 bg-white dark:bg-[#1a1a1a] min-h-[300px] ${
            isEditing ? 'border border-gray-200 dark:border-gray-700' : ''
          }`}
        >
          <EditorContent editor={editor} className="prose dark:prose-invert max-w-none" />
        </div>
      </div>

      {/* ─── Confirm Modal ───────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Note"
        message="This note will be permanently deleted. This action cannot be undone."
      />
    </div>
  );
};

export default WriteNote;