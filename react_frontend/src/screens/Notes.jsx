// pages/Notes.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetNotesQuery,
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
const NoteCard = ({ note, onClick, onDelete, onTogglePublic }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatDate = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

  const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const preview = stripHtml(note.content || '').slice(0, 120);

  return (
    <div
      className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer"
      onClick={onClick}
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{preview || 'Empty note'}</p>
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
        <div className="flex-shrink-0 flex items-center gap-1 relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((prev) => !prev); }}
            className="p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FaEllipsisV className="text-sm" />
          </button>
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-10"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePublic(note._id, !note.isPublic); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition"
              >
                {note.isPublic ? <FaLock className="text-xs" /> : <FaUnlock className="text-xs" />}
                {note.isPublic ? 'Make Private' : 'Make Public'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(note); setShowMenu(false); }}
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

  const { data: notesData, isLoading, refetch } = useGetNotesQuery();
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

  // Notes always open read-only first — the note's own "Enable Editing"
  // button (in WriteNote) is what flips it into edit mode. New notes go
  // straight to /notes/new, which WriteNote treats as edit mode by default.
  const openNote = (noteId) => navigate(`/notes/${noteId}`);

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
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
            <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
              <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <FaFileAlt className="text-teal-500 text-sm" /> Personal Notes
              </h1>
              <button
                onClick={() => navigate('/notes/new')}
                className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FaPlus className="text-sm" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                <FaFileAlt className="text-4xl mb-2 opacity-30" />
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs">Create your first note by tapping the + button.</p>
              </div>
            ) : (
              <div>
                {notes.map((note) => (
                  <NoteCard
                    key={note._id}
                    note={note}
                    onClick={() => openNote(note._id)}
                    onDelete={handleDelete}
                    onTogglePublic={handleTogglePublic}
                  />
                ))}
              </div>
            )}
          </main>

          <GeneralBottombar />
        </div>
      </div>

      {/* Floating action button */}
      <button
        onClick={() => navigate('/notes/new')}
        className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
      >
        <FaPlus className="text-xl" />
      </button>

      {/* ─── Inline Confirm Modal ───────────────────────────────────── */}
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