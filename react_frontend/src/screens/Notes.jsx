// pages/Notes.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useTogglePublicMutation,
} from '../slices/personalNoteApiSlice';
import toast from 'react-hot-toast';
import {
  FaPlus,
  FaSpinner,
  FaFileAlt,
  FaTrashAlt,
  FaUnlock,
  FaLock,
  FaEllipsisV,
  FaUserPlus,
  FaFile,
  FaTimes,
  FaShareAlt,
  FaLink,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── Inline Confirm Modal ────────────────────────────────────────────
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

// ─── Note Card ──────────────────────────────────────────────────────
const NoteCard = ({ note, onClick, onDelete, onTogglePublic, onShareLink }) => {
  const [showMenu, setShowMenu] = useState(false);
  // menuPos is used when the menu is opened via right-click (desktop).
  // When null, the menu renders as a dropdown under the ⋯ trigger.
  const [menuPos, setMenuPos] = useState(null);

  // The wrapper contains BOTH the trigger button and the menu, so an
  // outside-click test can check the wrapper as a whole. Without this,
  // clicking the ⋯ button would count as "outside" the menu and close
  // it before the toggle fires — that was the bug.
  const wrapperRef = useRef(null);

  // Close menu: on outside click, Escape, or scroll.
  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMenu(false);
        setMenuPos(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setMenuPos(null);
      }
    };
    const handleScroll = () => {
      setShowMenu(false);
      setMenuPos(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showMenu]);

  const toggleMenu = (e) => {
    e.stopPropagation();
    // Clicking ⋯ always opens as a dropdown, clearing any right-click pos.
    setMenuPos(null);
    setShowMenu((v) => !v);
  };

  const handleContextMenu = (e) => {
    // Desktop only — enable right-click context menu.
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const closeMenu = () => {
    setShowMenu(false);
    setMenuPos(null);
  };

  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content || '').slice(0, 120);

  // Menu placement: if menuPos is set, clamp to viewport and use fixed.
  // Otherwise render as an absolute dropdown anchored to the trigger.
  const menuStyle = menuPos
    ? {
        position: 'fixed',
        left: Math.min(menuPos.x, Math.max(0, window.innerWidth - 220)),
        top: Math.min(menuPos.y, Math.max(0, window.innerHeight - 200)),
        width: 200,
        zIndex: 100,
      }
    : undefined;

  const menuClassName = menuPos
    ? 'bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1'
    : 'absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-20';

  return (
    <div
      className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer"
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-teal-500 text-sm flex-shrink-0" />
            <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">{note.title}</h3>
            {note.isPublic && (
              <span className="flex-shrink-0 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                Public
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {preview || 'Empty note'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>Updated {formatDate(note.updatedAt)}</span>
            {note.attachments?.length > 0 && (
              <span className="flex items-center gap-1">
                <FaFile className="text-[10px]" /> {note.attachments.length}
              </span>
            )}
            {note.collaborators?.length > 0 && (
              <span className="flex items-center gap-1">
                <FaUserPlus className="text-[10px]" /> {note.collaborators.length}
              </span>
            )}
          </div>
        </div>

        <div
          ref={wrapperRef}
          className="flex-shrink-0 flex items-center gap-1 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={toggleMenu}
            className={`p-1.5 rounded-lg transition ${
              showMenu
                ? 'text-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'text-gray-400 hover:text-teal-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            aria-label="Note options"
          >
            <FaEllipsisV className="text-sm" />
          </button>

          {showMenu && (
            <div
              style={menuStyle}
              className={menuClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Share — only for public notes with a share link */}
              {note.isPublic && note.shareLink && (
                <button
                  type="button"
                  onClick={() => { onShareLink(note); closeMenu(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
                >
                  <FaShareAlt className="text-xs text-teal-500" />
                  Share link
                </button>
              )}

              <button
                type="button"
                onClick={() => { onTogglePublic(note._id, !note.isPublic); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                {note.isPublic ? <FaLock className="text-xs" /> : <FaUnlock className="text-xs" />}
                {note.isPublic ? 'Make Private' : 'Make Public'}
              </button>

              <button
                type="button"
                onClick={() => { onDelete(note); closeMenu(); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                <FaTrashAlt className="text-xs" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const Notes = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const isCreatingRef = useRef(false);

  const { data: notesData, isLoading, refetch } = useGetNotesQuery();
  const [createNote] = useCreateNoteMutation();
  const [deleteNote] = useDeleteNoteMutation();
  const [togglePublic] = useTogglePublicMutation();

  const notes = notesData?.notes || [];

  const handleDelete = (note) => {
    setDeleteTarget(note);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNote(deleteTarget._id).unwrap();
      toast.success('Note deleted');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete note');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleTogglePublic = async (noteId, isPublic) => {
    try {
      await togglePublic({ noteId, isPublic }).unwrap();
      toast.success(isPublic ? 'Note is now public' : 'Note is now private');
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update public status');
    }
  };

  // Share / copy link. Uses the Web Share API when available (mobile),
  // otherwise falls back to clipboard (desktop). Both paths use the same
  // URL: `${origin}/share/${shareLink}`.
  const handleShareLink = useCallback(async (note) => {
    if (!note?.shareLink) {
      toast.error('No share link available');
      return;
    }
    const url = `${window.location.origin}/share/${note.shareLink}`;

    // Try native share first (mobile + some desktop browsers).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: note.title || 'Note', url });
        return;
      } catch (err) {
        // User cancelled — no need to fall through to copy.
        if (err?.name === 'AbortError') return;
        // Any other failure — fall through to clipboard.
      }
    }

    // Clipboard fallback.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Share link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  }, []);

  // Notes always open read-only first — the note's own "Enable Editing"
  // button (in WriteNote) is what flips it into edit mode.
  const openNote = (noteId) => navigate(`/notes/${noteId}`);

  // Creates the note in the DB first, then navigates straight to its real
  // id — /notes/new is never visited.
  const handleCreateNote = async () => {
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
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/*
        Mobile layout notes:
        - h-dvh keeps the wrapper pinned to the visible viewport so the
          browser's URL-bar collapse doesn't cause overshoot.
        - The scroll container gets generous bottom padding so the last
          note card can clear the fixed GeneralBottombar instead of
          hiding behind it.
      */}
      <div className="h-dvh bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row overflow-hidden">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 flex-shrink-0">
            <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <FaFileAlt className="text-teal-500 text-sm" /> Personal Notes
              </h1>
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
          </header>

          <main
            className="flex-1 min-h-0 overflow-y-auto"
            style={{
              paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                <FaFileAlt className="text-4xl mb-2 opacity-30" />
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs">Create your first note by tapping the + button.</p>
              </div>
            ) : (
              <div className="md:pb-6">
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    onClick={() => openNote(note._id)}
                    onDelete={handleDelete}
                    onTogglePublic={handleTogglePublic}
                    onShareLink={handleShareLink}
                  />
                ))}
              </div>
            )}
          </main>

          <GeneralBottombar />
        </div>
      </div>

      {/* Floating action button — lifted above the bottom bar on mobile. */}
      <button
        onClick={handleCreateNote}
        disabled={isCreatingNote}
        className="fixed right-4 sm:right-6 z-30 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {isCreatingNote ? (
          <FaSpinner className="text-xl animate-spin" />
        ) : (
          <FaPlus className="text-xl" />
        )}
      </button>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Note"
        message="This note will be permanently deleted. This action cannot be undone."
      />
    </>
  );
};

export default Notes;