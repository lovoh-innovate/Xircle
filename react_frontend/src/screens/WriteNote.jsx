// pages/WriteNote.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import {
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNotesQuery,
} from '../slices/personalNoteApiSlice';
import toast from 'react-hot-toast';
import {
  FaArrowLeft,
  FaSpinner,
  FaTrashAlt,
  FaTimes,
  FaEdit,
  FaCheck,
  FaCloudUploadAlt,
  FaFileAlt,
  FaUserPlus,
  FaFile,
  FaPlus,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

// ─── Toolbar ──────────────────────────────────────────────────────────────
const ToolbarButton = ({ onClick, active, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    type="button"
    className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition ${
      active
        ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60'
    }`}
  >
    {children}
  </button>
);

const Toolbar = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 sm:px-6 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161619] sticky top-0 z-10 overflow-x-auto">
      <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
        <s>S</s>
      </ToolbarButton>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0" />

      <ToolbarButton title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
        H1
      </ToolbarButton>
      <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
        H2
      </ToolbarButton>
      <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
        H3
      </ToolbarButton>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0" />

      <ToolbarButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
        • List
      </ToolbarButton>
      <ToolbarButton title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
        1. List
      </ToolbarButton>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0" />

      <ToolbarButton title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
        ←
      </ToolbarButton>
      <ToolbarButton title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
        ↔
      </ToolbarButton>
      <ToolbarButton title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
        →
      </ToolbarButton>

      <span className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1 flex-shrink-0" />

      <ToolbarButton
        title="Insert link"
        onClick={() => {
          const url = window.prompt('Enter the link URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive('link')}
      >
        🔗
      </ToolbarButton>

      <ToolbarButton
        title="Insert image"
        onClick={() => {
          const url = window.prompt('Enter the image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
      >
        🖼️
      </ToolbarButton>

      {/* Clear formatting button removed */}
    </div>
  );
};

// ─── Toggle Switch ─────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4.5' : 'translate-x-1'
        }`}
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  </label>
);

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

// ─── Save status indicator ─────────────────────────────────────────────
const SaveStatus = ({ status }) => {
  if (status === 'idle') return null;
  const map = {
    saving: { text: 'Saving…', cls: 'text-amber-500' },
    saved: { text: 'Saved', cls: 'text-teal-600 dark:text-teal-400' },
    error: { text: 'Save failed', cls: 'text-red-500' },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`flex items-center gap-1 text-[11px] sm:text-xs ${s.cls} flex-shrink-0`}>
      {status === 'saving' ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
      <span className="hidden xs:inline">{s.text}</span>
    </span>
  );
};

// ─── Sidebar Note Item ────────────────────────────────────────────────
const SidebarNoteItem = ({ note, isActive, onClick }) => {
  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  const preview = stripHtml(note.content || '').slice(0, 60);
  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  return (
    <div
      onClick={() => onClick(note._id)}
      className={`px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition ${
        isActive
          ? 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-500'
          : 'hover:bg-gray-50 dark:hover:bg-[#1e1e1e]'
      }`}
    >
      <div className="flex items-center gap-2">
        <FaFileAlt className="text-teal-500 text-sm flex-shrink-0" />
        <span className="text-sm font-medium text-gray-800 dark:text-white truncate flex-1">
          {note.title || 'Untitled'}
        </span>
        {note.isPublic && (
          <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
            Public
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{preview || 'Empty note'}</p>
      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        <span>{formatDate(note.updatedAt)}</span>
        {note.attachments?.length > 0 && (
          <span className="flex items-center gap-1">
            <FaFile className="text-[9px]" /> {note.attachments.length}
          </span>
        )}
        {note.collaborators?.length > 0 && (
          <span className="flex items-center gap-1">
            <FaUserPlus className="text-[9px]" /> {note.collaborators.length}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────
const AUTOSAVE_DELAY = 900;

const WriteNote = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const isNew = noteId === 'new';

  // ── State ──
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // ── API ──
  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, { skip: isNew });
  const { data: notesData, isLoading: isNotesLoading } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();

  const notes = notesData?.notes || [];

  // ── Refs ──
  const loadedNoteRef = useRef(null);
  const currentNoteIdRef = useRef(isNew ? null : noteId);
  const suppressAutosaveRef = useRef(true);
  const debounceRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragRef = useRef(null);

  // ── Editor ──
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link,
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your note...' }),
    ],
    content: '<p></p>',
    editable: isEditing,
    onUpdate: ({ editor }) => {
      suppressAutosaveRef.current = false;
      setContent(editor.getHTML());
    },
  });

  // ── Sidebar resizing ──
  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth > 150 && newWidth < 500) {
        setSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // ── Load note data ──
  useEffect(() => {
    setIsEditing(isNew);
    currentNoteIdRef.current = isNew ? null : noteId;
  }, [noteId, isNew]);

  useEffect(() => {
    if (!editor) return;

    if (isNew) {
      if (loadedNoteRef.current !== 'new') {
        suppressAutosaveRef.current = true;
        setTitle('');
        setContent('');
        setIsPublic(false);
        setSaveStatus('idle');
        editor.commands.setContent('<p></p>');
        loadedNoteRef.current = 'new';
      }
      return;
    }

    if (noteData?.note && loadedNoteRef.current !== noteData.note._id) {
      suppressAutosaveRef.current = true;
      setTitle(noteData.note.title || '');
      setContent(noteData.note.content || '');
      setIsPublic(noteData.note.isPublic || false);
      setSaveStatus('idle');
      editor.commands.setContent(noteData.note.content || '<p></p>');
      loadedNoteRef.current = noteData.note._id;
      currentNoteIdRef.current = noteData.note._id;
    }
  }, [editor, noteData, isNew, noteId]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditing);
    if (isEditing) editor.commands.focus('end');
  }, [editor, isEditing]);

  // ── Persist ──
  const persist = useCallback(async () => {
    if (!title.trim()) return;

    setSaveStatus('saving');
    try {
      const payload = { title: title.trim(), content: content || '', isPublic };

      if (!currentNoteIdRef.current) {
        const result = await createNote(payload).unwrap();
        currentNoteIdRef.current = result.note._id;
        loadedNoteRef.current = result.note._id;
        navigate(`/notes/${result.note._id}`, { replace: true });
      } else {
        await updateNote({ noteId: currentNoteIdRef.current, data: payload }).unwrap();
      }
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      toast.error(err?.data?.message || 'Failed to save note');
    }
  }, [title, content, isPublic, createNote, updateNote, navigate]);

  // Autosave
  useEffect(() => {
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    if (!isEditing) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist();
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(debounceRef.current);
  }, [title, content, isPublic, isEditing, persist]);

  // ── Handlers ──
  const handleDoneEditing = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      await deleteNote(currentNoteIdRef.current).unwrap();
      toast.success('Note deleted');
      navigate('/notes');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete note');
    }
  };

  const handleNoteSelect = (id) => {
    if (id === noteId) return;
    navigate(`/notes/${id}`);
  };

  // ── Loading ──
  if (isFetching || isNotesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f0f12]">
        <FaSpinner className="animate-spin text-teal-500 text-3xl" />
      </div>
    );
  }

  // ── Render ──
  const renderSidebar = () => (
    <div
      ref={sidebarRef}
      className="h-full bg-white dark:bg-[#131316] border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FaFileAlt className="text-teal-500" /> Notes
        </h2>
        <button
          onClick={() => navigate('/notes/new')}
          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <FaPlus className="text-sm" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
            <FaFileAlt className="text-2xl mb-1 opacity-30" />
            <p className="text-xs">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <SidebarNoteItem
              key={note._id}
              note={note}
              isActive={note._id === currentNoteIdRef.current}
              onClick={handleNoteSelect}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderMain = () => (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-[#0f0f12] overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12]">
        {/* Top row: back (mobile), title, status */}
        <div className="flex items-center gap-2 px-3 sm:px-6 py-2.5">
          {/* Mobile back button */}
          <button
            onClick={() => navigate('/notes')}
            className="md:hidden p-2 -ml-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
          >
            <FaArrowLeft className="text-sm" />
          </button>

          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-lg sm:text-xl font-semibold text-gray-800 dark:text-white placeholder-gray-400"
              autoFocus={isNew}
            />
          ) : (
            <h1 className="flex-1 min-w-0 text-lg sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
              {title || 'Untitled Note'}
            </h1>
          )}

          <SaveStatus status={isEditing ? saveStatus : 'idle'} />
        </div>

        {/* Second row: public toggle + action buttons */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 pb-2.5">
          <div className="flex items-center gap-3">
            {isEditing && <Toggle checked={isPublic} onChange={setIsPublic} label="Public" />}
          </div>

          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <button
                onClick={handleDoneEditing}
                className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
              >
                <FaCheck className="text-xs" />
                Done
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
              >
                <FaEdit className="text-xs" />
                Edit
              </button>
            )}

            {!isNew && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <FaTrashAlt className="text-sm" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Editor / Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto w-full">
        {isEditing && <Toolbar editor={editor} />}

        <div className="w-full px-3 sm:px-6 py-6">
          {!isEditing && !isNew && (
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <div
                className="[&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_ul]:list-disc [&_ol]:list-decimal [&_a]:text-teal-600 [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}
          {isEditing && (
            <EditorContent
              editor={editor}
              className="
                max-w-none w-full
                text-[15px] sm:text-base leading-relaxed
                text-gray-800 dark:text-gray-100
                [&_.ProseMirror]:outline-none
                [&_.ProseMirror_p]:my-3
                [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:mb-3
                [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:mb-2
                [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:mb-2
                [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-3 [&_.ProseMirror_ul]:space-y-1
                [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-3 [&_.ProseMirror_ol]:space-y-1
                [&_.ProseMirror_li]:pl-1
                [&_.ProseMirror_li_p]:my-0
                [&_.ProseMirror_a]:text-teal-600 [&_.ProseMirror_a]:underline
                [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-3
                [&_.ProseMirror_strong]:font-bold
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
              "
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-white dark:bg-[#0f0f12] flex overflow-hidden">
      {/* ─── Desktop Sidebar (hidden on mobile) ───────────────────── */}
      <div className="hidden md:flex flex-shrink-0 h-full relative">
        {renderSidebar()}
        {/* Resize handle */}
        <div
          ref={dragRef}
          onMouseDown={startResize}
          className="w-1 cursor-col-resize hover:bg-teal-500/50 transition-colors absolute right-0 top-0 bottom-0 z-10"
        />
      </div>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {renderMain()}
      </div>

      {/* ─── Confirm Modal ──────────────────────────────────────────── */}
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