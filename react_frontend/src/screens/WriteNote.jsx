// pages/WriteNote.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  DecoupledEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  RemoveFormat,
  FontFamily,
  FontSize,
  FontColor,
  FontBackgroundColor,
  Highlight,
  Alignment,
  List,
  Link,
  AutoLink,
  Image,
  ImageInsert,
  ImageInsertViaUrl,
  ImageToolbar,
  ImageStyle,
  ImageResize,
  ImageCaption,
  ImageTextAlternative,
  Table,
  TableToolbar,
  TableProperties,
  TableCellProperties,
  PasteFromOffice,
  GeneralHtmlSupport,
  WordCount,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import './WriteNote.css'; // dark-mode CSS variable overrides for CKEditor
import {
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNotesQuery,
  useTogglePublicMutation,
  useLazyExportNotePDFQuery,
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
  FaLock,
  FaUnlock,
  FaFilePdf,
  FaCopy,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────
const stripHtml = (html) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
};

const getWordCount = (html) => {
  const text = stripHtml(html);
  return text.trim() ? text.trim().split(/\s+/).length : 0;
};

const getCharCount = (html) => stripHtml(html).length;

// ─── CKEditor Config ──────────────────────────────────────────────────
const EDITOR_CONFIG = {
  licenseKey: 'GPL',
  plugins: [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Subscript,
    Superscript,
    RemoveFormat,
    FontFamily,
    FontSize,
    FontColor,
    FontBackgroundColor,
    Highlight,
    Alignment,
    List,
    Link,
    AutoLink,
    Image,
    ImageInsert,
    ImageInsertViaUrl,
    ImageToolbar,
    ImageStyle,
    ImageResize,
    ImageCaption,
    ImageTextAlternative,
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    PasteFromOffice,
    GeneralHtmlSupport,
    WordCount,
  ],
  toolbar: {
    items: [
      'undo', 'redo', '|',
      'heading', '|',
      'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
      'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', 'highlight', '|',
      'alignment', 'bulletedList', 'numberedList', '|',
      'link', 'insertImage', 'insertTable',
    ],
    shouldNotGroupWhenFull: false, // overflow items collapse into a "..." (show more) button when space runs out
  },
  heading: {
    options: [
      { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
      { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
      { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
      { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
    ],
  },
  fontFamily: {
    options: [
      'default',
      'Arial, sans-serif',
      'Georgia, serif',
      'Times New Roman, serif',
      'Courier New, monospace',
      'Verdana, sans-serif',
      'Tahoma, sans-serif',
    ],
  },
  fontSize: {
    options: [12, 14, 'default', 18, 24, 32, 48],
  },
  image: {
    toolbar: [
      'imageStyle:inline',
      'imageStyle:block',
      'imageStyle:side',
      '|',
      'toggleImageCaption',
      'imageTextAlternative',
      'resizeImage',
    ],
    insert: {
      integrations: ['insertImageViaUrl'],
    },
  },
  table: {
    contentToolbar: [
      'tableColumn',
      'tableRow',
      'mergeTableCells',
      'tableProperties',
      'tableCellProperties',
    ],
  },
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
  placeholder: 'Start writing your note...',
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

// ─── Sidebar Note Item ────────────────────────────────────────────────
const SidebarNoteItem = ({ note, isActive, onClick }) => {
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

// ─── Save Status ──────────────────────────────────────────────────────
const SaveStatus = ({ status, lastSaved }) => {
  if (status === 'idle' && !lastSaved) return null;
  const map = {
    saving: { text: 'Saving…', cls: 'text-amber-500' },
    saved: { text: 'Saved', cls: 'text-teal-600 dark:text-teal-400' },
    error: { text: 'Save failed', cls: 'text-red-500' },
  };
  const s = map[status];
  return (
    <span className={`flex items-center gap-1 text-[11px] sm:text-xs ${s?.cls || 'text-gray-400'} flex-shrink-0`}>
      {status === 'saving' ? <FaSpinner className="animate-spin" /> : <FaCloudUploadAlt />}
      <span className="hidden xs:inline">{s?.text || 'Saved'}</span>
      {status === 'saved' && lastSaved && (
        <span className="text-[10px] text-gray-400 hidden sm:inline">
          {formatDistanceToNow(lastSaved, { addSuffix: true })}
        </span>
      )}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────────
const AUTOSAVE_DELAY = 900;
const MOBILE_BREAKPOINT = 768;

const WriteNote = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── State ──
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  // A brand-new note (created via the "+" button, see handleCreateNote) lands
  // here already in edit mode, signalled via router state.
  const [isEditing, setIsEditing] = useState(Boolean(location.state?.justCreated));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [editorKey, setEditorKey] = useState(noteId || 'pending');
  const [isCreatingNote, setIsCreatingNote] = useState(false); // "+" button in flight
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  // ── API ──
  // noteId is always a real, already-created id now — the note is created
  // up front by handleCreateNote before we ever navigate here, so there's
  // no "/notes/new" placeholder route to special-case.
  const { data: noteData, isLoading: isFetching } = useGetNoteQuery(noteId, { skip: !noteId });
  const { data: notesData, isLoading: isNotesLoading } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [updateNote] = useUpdateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();
  const [exportPDF] = useLazyExportNotePDFQuery();

  const notes = notesData?.notes || [];

  // ── Refs ──
  const loadedNoteRef = useRef(null);
  const currentNoteIdRef = useRef(noteId || null);
  const suppressAutosaveRef = useRef(true);
  const debounceRef = useRef(null);
  const sidebarRef = useRef(null);
  const dragRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const desktopToolbarSlotRef = useRef(null);
  const mobileToolbarSlotRef = useRef(null);
  const isCreatingRef = useRef(false); // guards handleCreateNote against double-fires (e.g. fast double-click)

  // ── Mobile detection ──
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Move the CKEditor toolbar into the correct slot (top on desktop, bottom on mobile) ──
  const attachToolbar = useCallback((mobile) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    const toolbarEl = editor.ui.view.toolbar.element;
    const targetSlot = mobile ? mobileToolbarSlotRef.current : desktopToolbarSlotRef.current;
    if (toolbarEl && targetSlot && toolbarEl.parentElement !== targetSlot) {
      targetSlot.appendChild(toolbarEl);
    }
  }, []);

  useEffect(() => {
    attachToolbar(isMobile);
  }, [isMobile, isEditing, attachToolbar]);

  const handleEditorReady = (editor) => {
    editorInstanceRef.current = editor;
    setTimeout(() => attachToolbar(isMobile), 0);
  };

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

  // ── Create a new note directly, then navigate straight to /notes/:id ──
  // No intermediate "/notes/new" route is ever visited — the note exists in
  // the DB (titled "Untitled") before the URL changes at all.
  const handleCreateNote = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreatingNote(true);
    try {
      const result = await createNote({ title: 'Untitled', content: '' }).unwrap();
      navigate(`/notes/${result.note._id}`, { state: { justCreated: true } });
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create note');
    } finally {
      isCreatingRef.current = false;
      setIsCreatingNote(false);
    }
  }, [createNote, navigate]);

  // ── Route change: reset editing mode + current note id ──
  useEffect(() => {
    setIsEditing(Boolean(location.state?.justCreated));
    currentNoteIdRef.current = noteId || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // ── Load note data ──
  useEffect(() => {
    if (!noteId) return;

    if (noteData?.note && loadedNoteRef.current !== noteData.note._id) {
      suppressAutosaveRef.current = true;
      setTitle(noteData.note.title || '');
      const html = noteData.note.content || '';
      setContent(html);
      setIsPublic(noteData.note.isPublic || false);
      setSaveStatus('idle');
      setLastSaved(noteData.note.updatedAt ? new Date(noteData.note.updatedAt) : null);
      setWordCount(getWordCount(html));
      setCharCount(getCharCount(html));
      loadedNoteRef.current = noteData.note._id;
      currentNoteIdRef.current = noteData.note._id;
      setEditorKey(noteData.note._id); // remount CKEditor with fresh initial data
    }
  }, [noteData, noteId]);

  // ── Persist ──
  const persist = useCallback(async () => {
    if (!currentNoteIdRef.current) return; // shouldn't happen — note always exists before this page loads

    setSaveStatus('saving');
    try {
      const payload = { title: (title || 'Untitled').trim(), content: content || '', isPublic };
      await updateNote({ noteId: currentNoteIdRef.current, data: payload }).unwrap();
      setLastSaved(new Date());
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      toast.error(err?.data?.message || 'Failed to save note');
    }
  }, [title, content, isPublic, updateNote]);

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

  const handleTogglePublic = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      const newStatus = !isPublic;
      await togglePublic({ noteId: currentNoteIdRef.current, isPublic: newStatus }).unwrap();
      setIsPublic(newStatus);
      toast.success(newStatus ? 'Note is now public' : 'Note is now private');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update public status');
    }
  };

  const handleExportPDF = async () => {
    if (!currentNoteIdRef.current) return;
    try {
      const blob = await exportPDF(currentNoteIdRef.current).unwrap();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Note-${title || 'Untitled'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleCopyShareLink = () => {
    const shareLink = noteData?.note?.shareLink;
    if (shareLink) {
      const url = `${window.location.origin}/share/${shareLink}`;
      navigator.clipboard?.writeText(url).then(() => {
        toast.success('Share link copied to clipboard');
      }).catch(() => toast.error('Failed to copy link'));
    } else {
      toast.error('No share link available');
    }
  };

  const handleEditorChange = (_event, editor) => {
    suppressAutosaveRef.current = false;
    const html = editor.getData();
    setContent(html);
    setWordCount(getWordCount(html));
    setCharCount(getCharCount(html));
  };

  // ── Loading ──
  // Covers: fetching an existing note, and fetching the sidebar list.
  // Note creation (the "+" button) happens before navigation, so there is
  // no in-between "creating…" screen to show here.
  if (isFetching || isNotesLoading || !noteId) {
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
          onClick={handleCreateNote}
          disabled={isCreatingNote}
          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreatingNote ? (
            <FaSpinner className="text-sm animate-spin" />
          ) : (
            <FaPlus className="text-sm" />
          )}
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

  const renderHeader = () => (
    <div className="flex-shrink-0 w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12]">
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2">
        {/* Back (mobile) */}
        <button
          onClick={() => navigate('/notes')}
          className="md:hidden p-2 -ml-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
        >
          <FaArrowLeft className="text-sm" />
        </button>

        {/* Title */}
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-lg sm:text-xl font-semibold text-gray-800 dark:text-white placeholder-gray-400"
            autoFocus
          />
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
              {title || 'Untitled Note'}
            </h1>
            <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        )}

        {/* Word & char counts */}
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">
          {wordCount} words · {charCount} chars
        </span>

        <SaveStatus status={isEditing ? saveStatus : 'idle'} lastSaved={lastSaved} />

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
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
              className="px-3 py-1.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <FaEdit className="text-xs" />
              Edit
            </button>
          )}

          <button
            onClick={handleTogglePublic}
            className={`p-2 rounded-lg transition ${
              isPublic ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={isPublic ? 'Make private' : 'Make public'}
          >
            {isPublic ? <FaUnlock className="text-sm" /> : <FaLock className="text-sm" />}
          </button>
          {isPublic && noteData?.note?.shareLink && (
            <button
              onClick={handleCopyShareLink}
              className="p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Copy share link"
            >
              <FaCopy className="text-sm" />
            </button>
          )}
          <button
            onClick={handleExportPDF}
            className="p-2 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Export as PDF"
          >
            <FaFilePdf className="text-sm" />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
          >
            <FaTrashAlt className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Editor area ──
  const renderEditor = () => (
    <div className="flex-1 flex flex-col overflow-hidden w-full relative">
      {/* Desktop toolbar slot — sticky at the top, separate from the text area */}
      {isEditing && !isMobile && (
        <div
          ref={desktopToolbarSlotRef}
          className="ck-toolbar-slot flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#161619] sticky top-0 z-10"
        />
      )}

      <div className="flex-1 overflow-y-auto w-full">
        <div className={`w-full px-3 sm:px-6 py-6 ${isMobile && isEditing ? 'pb-24' : ''}`}>
          {!isEditing && (
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <div
                className="[&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_ul]:list-disc [&_ol]:list-decimal [&_a]:text-teal-600 [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_td]:border [&_td]:border-gray-300 [&_td]:p-2"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}
          {isEditing && (
            <div className="ck-note-editor-wrapper text-gray-800 dark:text-gray-100">
              <CKEditor
                key={editorKey}
                editor={DecoupledEditor}
                config={EDITOR_CONFIG}
                data={content}
                onReady={handleEditorReady}
                onChange={handleEditorChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile toolbar slot — pinned to the bottom, matches the old MobileToolbar position */}
      {isEditing && isMobile && (
        <div
          ref={mobileToolbarSlotRef}
          className="ck-toolbar-slot flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161619] sticky bottom-0 z-20"
        />
      )}
    </div>
  );

  return (
    <div className="h-screen w-full bg-white dark:bg-[#0f0f12] flex overflow-hidden">
      {/* ─── Desktop Sidebar ───────────────────────────────────────── */}
      <div className="hidden md:flex flex-shrink-0 h-full relative">
        {renderSidebar()}
        <div
          ref={dragRef}
          onMouseDown={startResize}
          className="w-1 cursor-col-resize hover:bg-teal-500/50 transition-colors absolute right-0 top-0 bottom-0 z-10"
        />
      </div>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {renderHeader()}
        {renderEditor()}
      </div>

      {/* ─── Modals ────────────────────────────────────────────────── */}
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