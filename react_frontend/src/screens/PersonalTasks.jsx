// pages/PersonalTasks.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetPersonalTasksQuery,
  useGetPersonalFoldersQuery,
  useCreatePersonalTaskMutation,
  useUpdatePersonalTaskMutation,
  useArchivePersonalTaskMutation,
  useRestorePersonalTaskMutation,
  useDeletePersonalTaskMutation,
  usePermanentlyDeletePersonalTaskMutation,
  useReorderPersonalTasksMutation,
  useCreatePersonalFolderMutation,
  useUpdatePersonalFolderMutation,
  useDeletePersonalFolderMutation,
  useAddPersonalSubTaskMutation,
  useTogglePersonalSubTaskMutation,
  useDeletePersonalSubTaskMutation,
  useUpdatePersonalSubTaskMutation,
  useReorderPersonalSubTasksMutation,
} from '../slices/personalTaskApiSlice';
import toast from 'react-hot-toast';
import {
  FaPlus,
  FaSpinner,
  FaTasks,
  FaFolder,
  FaFolderOpen,
  FaTrashAlt,
  FaTrashRestore,
  FaArchive,
  FaUndo,
  FaEdit,
  FaTimes,
  FaCheck,
  FaExclamationCircle,
  FaRedo,
  FaBell,
  FaCalendarAlt,
  FaChevronDown,
  FaSortAmountDown,
  FaSortAmountUp,
  FaAngleDown,
  FaGripVertical,
  FaArrowLeft,
  FaClock,
  FaRegClock,
  FaEllipsisV,
  FaHandPointer,
  FaCheckCircle,
  FaCheckDouble,
  FaMousePointer,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FOLDER_DROP_PREFIX = 'folder-drop-';

const isReminderTask = (task) => !!(task?.recurrenceType && task.recurrenceType !== 'none');

const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return isTouch;
};

// ─── Custom Select ────────────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, className = '', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(opt => opt.value === value);
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed hover:bg-gray-100 dark:hover:bg-[#2a2a2a]' : ''
        }`}
      >
        {Icon && <Icon className="text-xs text-gray-400" />}
        <span className="flex-1 text-left truncate">{selected ? selected.label : placeholder}</span>
        <FaAngleDown className={`text-xs text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                opt.value === value
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
              }`}
            >
              {opt.icon && <span className="text-xs">{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.value === value && <FaCheck className="ml-auto text-teal-500 text-xs" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Bottom Sheet (centered modal) ──────────────────────────────
const BottomSheet = ({ isOpen, onClose, children }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, visible]);
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: animating ? 1 : 0.9, opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── Confirm Modal ──────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, danger = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 break-words">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 break-words">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium transition hover:opacity-80 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Permanent Delete Modal (updated for bulk) ──────────────────
const PermanentDeleteModal = ({ isOpen, onClose, onConfirm, itemName, isBulk = false }) => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) setValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  let target = '';
  let placeholder = '';
  let title = 'Delete Forever';
  let description = '';

  if (isBulk) {
    target = 'I want to Permanently delete All tasks';
    placeholder = target;
    title = `Permanently Delete ${itemName || 'All Tasks'}`;
    description = `This permanently deletes ${itemName || 'the selected tasks'} — it can't be recovered. Type the confirmation phrase below.`;
  } else {
    target = 'DELETE';
    placeholder = 'DELETE';
    title = `Permanently Delete "${itemName}"`;
    description = `This permanently deletes "${itemName}" — it can't be recovered. Type "DELETE" to confirm.`;
  }

  const matches = value.trim() === target;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (matches) {
      onConfirm();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-[#0b0b10]/80 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl max-w-md w-full p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
          <FaTrashAlt className="text-red-500 text-sm flex-shrink-0" /> {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-words">{description}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full px-4 py-2 mb-4 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none text-gray-800 dark:text-white"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!matches}
            className="flex-1 py-2 text-white rounded-xl text-sm font-medium transition bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600"
          >
            Delete Forever
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Task Action Modal (includes Select in trash) ──────────────
const TaskActionModal = ({ isOpen, onClose, task, onEdit, onArchive, onRestore, onDelete, onStatusToggle, onMove, onPermanentDelete, onSelect }) => {
  if (!isOpen || !task) return null;
  const isTrash = task.isTrash;
  const isArchived = task.isArchived;
  const isCompleted = task.status === 'completed';
  const isReminder = isReminderTask(task);

  if (isTrash) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div className="p-6 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white break-words">{task.title}</h3>
            <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 mt-1">
              <FaTrashAlt className="text-[10px]" /> In Trash
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onRestore(task._id); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
            >
              <FaUndo /> Restore
            </button>
            <button
              onClick={() => { onPermanentDelete(task); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition"
            >
              <FaTrashAlt /> Delete Forever
            </button>
            <button
              onClick={() => { onSelect(task._id); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition col-span-2"
            >
              <FaMousePointer className="text-xs" /> Select
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white break-words">{task.title}</h3>
          {isReminder && (
            <span className="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 mt-1">
              <FaBell className="text-[10px]" /> Reminder · {task.recurrenceType === 'daily' ? 'Everyday' : 'Weekly'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"
          >
            <FaEdit /> Edit
          </button>
          {!isArchived && !isCompleted && !isReminder && (
            <button
              onClick={() => { onStatusToggle(task._id, 'completed'); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition"
            >
              <FaCheck /> Complete
            </button>
          )}
          <button
            onClick={() => { onMove(task); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
          >
            <FaFolderOpen /> Move
          </button>
          <button
            onClick={() => { onSelect(task._id); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition"
          >
            <FaMousePointer className="text-xs" /> Select
          </button>
          {isArchived ? (
            <button
              onClick={() => { onRestore(task._id); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
            >
              <FaUndo /> Restore
            </button>
          ) : (
            <button
              onClick={() => { onArchive(task._id); onClose(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
            >
              <FaArchive /> Archive
            </button>
          )}
          <button
            onClick={() => { onDelete(task); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition"
          >
            <FaTrashAlt /> Delete
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
};

// ─── Move Task Modal (unchanged) ──────────────────────────────
const MoveTaskModal = ({ isOpen, onClose, task, folders, onMoveTask }) => {
  if (!isOpen || !task) return null;

  const currentFolderId = task.folder?._id || task.folder || null;

  const handleSelect = (folderId) => {
    if (folderId === currentFolderId) {
      onClose();
      return;
    }
    onMoveTask(task._id, folderId);
    onClose();
  };

  const folderOptions = [
    { _id: null, name: 'Uncategorized', color: '#9ca3af' },
    ...folders,
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <FaFolderOpen className="text-purple-500" /> Move to Folder
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <FaTimes />
          </button>
        </div>
        <div className="space-y-1">
          {folderOptions.map((folder) => {
            const isCurrent = folder._id === currentFolderId;
            return (
              <button
                key={folder._id === null ? 'null' : folder._id}
                onClick={() => handleSelect(folder._id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isCurrent
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    : 'hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color || '#4f46e5' }}
                />
                <span className="flex-1 text-left text-sm font-medium break-words">{folder.name}</span>
                {isCurrent && <FaCheck className="text-purple-500 text-xs flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};

// ─── Subtask Action Modal (with Select) ──────────────────────
const SubtaskActionModal = ({ isOpen, onClose, subtask, index, onEdit, onDelete, onSelect }) => {
  if (!isOpen || !subtask) return null;
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white break-words">{subtask.title}</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { onEdit(index); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"
          >
            <FaEdit /> Edit
          </button>
          <button
            onClick={() => { onDelete(index); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition"
          >
            <FaTrashAlt /> Delete
          </button>
          <button
            onClick={() => { onSelect(index); onClose(); }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition col-span-2"
          >
            <FaMousePointer className="text-xs" /> Select
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
};

// ─── Subtask Edit Modal (unchanged) ──────────────────────────
const SubtaskEditModal = ({ isOpen, onClose, subtask, index, onSave }) => {
  const [title, setTitle] = useState(subtask?.title || '');
  const [dueDate, setDueDate] = useState(subtask?.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 16) : '');
  const [recurrenceType, setRecurrenceType] = useState(subtask?.recurrenceType || 'none');
  const [recurrenceDays, setRecurrenceDays] = useState(subtask?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    subtask?.recurrenceEndDate ? new Date(subtask.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const recurrenceOptions = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
  ];

  useEffect(() => {
    if (subtask) {
      setTitle(subtask.title || '');
      setDueDate(subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 16) : '');
      setRecurrenceType(subtask.recurrenceType || 'none');
      setRecurrenceDays(subtask.recurrenceDays || []);
      setRecurrenceEndDate(subtask.recurrenceEndDate ? new Date(subtask.recurrenceEndDate).toISOString().slice(0, 16) : '');
    }
  }, [subtask]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title required');
      return;
    }
    onSave(index, {
      title: title.trim(),
      dueDate: dueDate || null,
      recurrenceType,
      recurrenceDays: recurrenceType === 'weekly' ? recurrenceDays : [],
      recurrenceEndDate: recurrenceEndDate || null,
    });
    onClose();
  };

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  if (!isOpen) return null;
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Edit Subtask</h3>
          <button type="button" onClick={onClose}><FaTimes className="text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurrence</label>
          <CustomSelect
            value={recurrenceType}
            onChange={(val) => {
              setRecurrenceType(val);
              if (val !== 'weekly') setRecurrenceDays([]);
            }}
            options={recurrenceOptions}
            placeholder="Recurrence"
          />
        </div>
        {recurrenceType === 'weekly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repeat on</label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    recurrenceDays.includes(i)
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        {(recurrenceType === 'daily' || recurrenceType === 'weekly') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
            <input
              type="datetime-local"
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 outline-none"
            />
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 transition"
          >
            Save
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};

// ─── Subtask Item (with selection support) ─────────────────────
const SubtaskItem = ({
  subtask,
  index,
  onToggle,
  onOpenModal,
  isOverdue,
  formatDate,
  weekDays,
  listeners,
  attributes,
  isSelected = false,
  onLongPress,
  isTouch,
  selectionMode,
  onTap, // called on single tap (to toggle selection if in selection mode)
}) => {
  const lastTap = useRef(0);

  const handleRowClick = (e) => {
    if (e.target.closest('.subtask-toggle-btn') || e.target.closest('.subtask-more-btn')) return;

    if (isTouch) {
      const now = Date.now();
      const diff = now - lastTap.current;
      if (diff < 300 && diff > 0) {
        // Double tap: open modal
        onOpenModal(index);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) {
          // Single tap: call onTap (parent handles selection mode)
          if (onTap) onTap(index);
          lastTap.current = 0;
        }
      }, 300);
    } else {
      // Desktop: single click -> if selection mode active, toggle selection; else open modal on double click? Actually desktop users have the three-dot menu, but we can still allow single click to toggle selection if selection mode is active.
      if (selectionMode) {
        if (onTap) onTap(index);
      } else {
        // Single click on desktop: maybe open modal? But we have the three-dot. We'll keep it as is.
        // We'll do nothing on single click desktop to avoid confusion.
        // Actually we can still open modal on single click for desktop? But then double tap wouldn't work.
        // We'll keep it consistent: double tap for modal, single tap toggles selection if selection mode.
        // On desktop we don't have double tap, but we have the more button.
        // So we'll just call onTap if selectionMode, else nothing.
        // We'll also allow double click? but not needed.
        // We'll just keep it as is: onClick just calls onTap (which parent handles).
        // But we also need to open modal on double click. Not needed.
        // So we'll just use the same logic as touch: double tap for modal, single tap for selection (if mode active).
        // Since desktop users have the more button, they can also use that.
        // We'll implement the same logic for both.
      }
    }
  };

  // Long press for selection start (touch only)
  const longPressTimer = useRef(null);
  const handleTouchStart = (e) => {
    if (e.target.closest('.subtask-toggle-btn') || e.target.closest('.subtask-more-btn')) return;
    longPressTimer.current = setTimeout(() => {
      if (onLongPress) onLongPress(index);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const gripProps = { ...listeners, ...attributes };

  return (
    <div
      className={`border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 cursor-pointer touch-none ${
        isSelected ? 'bg-teal-50/70 dark:bg-teal-900/30' : ''
      }`}
      onClick={handleRowClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 text-gray-400 cursor-grab touch-none p-1 -ml-1 touch-action-none"
          {...gripProps}
        >
          <FaGripVertical className="text-sm" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(index, !subtask.done); }}
          className={`subtask-toggle-btn w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
            subtask.done
              ? 'bg-teal-500 border-teal-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
          }`}
        >
          {subtask.done && <FaCheck className="text-[10px]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm text-gray-800 dark:text-white break-words ${subtask.done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
              {subtask.title}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenModal(index); }}
              className="subtask-more-btn hidden md:flex p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition flex-shrink-0"
              aria-label="More actions"
            >
              <FaEllipsisV className="text-sm" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {subtask.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue(subtask.dueDate) ? 'text-red-500' : ''}`}>
                <FaRegClock className="text-[10px]" /> {formatDate(subtask.dueDate)}
              </span>
            )}
            {subtask.recurrenceType && subtask.recurrenceType !== 'none' && (
              <span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400">
                <FaRedo className="text-[10px]" /> {subtask.recurrenceType === 'daily' ? 'Daily' : 'Weekly'}
                {subtask.recurrenceDays?.length > 0 && ` (${subtask.recurrenceDays.map(d => weekDays[d]).join(', ')})`}
              </span>
            )}
            {subtask.recurrenceEndDate && (
              <span className="text-gray-400 dark:text-gray-500">until {formatDate(subtask.recurrenceEndDate)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sortable Subtask Item ─────────────────────────────────────
const SortableSubtaskItem = ({
  id,
  subtask,
  index,
  onToggle,
  onOpenModal,
  isOverdue,
  formatDate,
  weekDays,
  isSelected,
  onLongPress,
  isTouch,
  selectionMode,
  onTap,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <SubtaskItem
        subtask={subtask}
        index={index}
        onToggle={onToggle}
        onOpenModal={onOpenModal}
        isOverdue={isOverdue}
        formatDate={formatDate}
        weekDays={weekDays}
        listeners={listeners}
        attributes={attributes}
        isSelected={isSelected}
        onLongPress={onLongPress}
        isTouch={isTouch}
        selectionMode={selectionMode}
        onTap={onTap}
      />
    </div>
  );
};

// ─── Subtask Bulk Toolbar (inside TaskDetailView) ──────────────
const SubtaskBulkToolbar = ({ selectedCount, onCancel, onDelete, onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="bg-gray-100 dark:bg-[#2a2a2a] px-4 py-2 flex items-center justify-between gap-2 rounded-xl mb-3"
    >
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-semibold">{selectedCount}</span> selected
      </div>
      <div className="flex gap-2">
        <button
          onClick={onComplete}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition flex items-center gap-1"
        >
          <FaCheckDouble className="text-xs" /> Done
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition flex items-center gap-1"
        >
          <FaTrashAlt className="text-xs" /> Delete
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

// ─── Task Detail View (updated with subtask selection) ────────
const TaskDetailView = ({
  task,
  onBack,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onArchive,
  onRestore,
  onDelete,
  onReorderSubtasks,
  onEditSubtask,
}) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [subtaskToEdit, setSubtaskToEdit] = useState(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const [showSubtaskAction, setShowSubtaskAction] = useState(false);
  const [actionSubtaskIndex, setActionSubtaskIndex] = useState(null);

  // ─── Subtask selection state ──────────────────────────────────
  const [selectedSubtaskIndices, setSelectedSubtaskIndices] = useState(new Set());
  const [subtaskSelectionMode, setSubtaskSelectionMode] = useState(false);
  const [subtaskBulkLoading, setSubtaskBulkLoading] = useState(false);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isReminder = isReminderTask(task);
  const isTouch = useIsTouchDevice();

  // ─── Subtask selection handlers ──────────────────────────────
  const toggleSubtaskSelection = (index) => {
    setSelectedSubtaskIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      if (newSet.size === 0) setSubtaskSelectionMode(false);
      else setSubtaskSelectionMode(true);
      return newSet;
    });
  };

  const startSubtaskSelection = (index) => {
    setSelectedSubtaskIndices(new Set([index]));
    setSubtaskSelectionMode(true);
  };

  const clearSubtaskSelection = () => {
    setSelectedSubtaskIndices(new Set());
    setSubtaskSelectionMode(false);
  };

  // ─── Bulk subtask actions ──────────────────────────────────────
  const bulkSubtaskAction = async (actionFn, successMsg, errorMsg) => {
    const indices = Array.from(selectedSubtaskIndices);
    if (indices.length === 0) return;
    setSubtaskBulkLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const idx of indices) {
      try {
        await actionFn(idx);
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed on subtask ${idx}:`, err);
      }
    }
    setSubtaskBulkLoading(false);
    clearSubtaskSelection();
    if (failCount === 0) {
      toast.success(`${successMsg} (${successCount} subtasks)`);
    } else {
      toast.error(`Partial success: ${successCount} done, ${failCount} failed.`);
    }
  };

  const bulkSubtaskDelete = () => {
    bulkSubtaskAction(
      (idx) => onDeleteSubtask(task._id, idx),
      'Deleted subtasks',
      'Failed to delete some subtasks'
    );
  };

  const bulkSubtaskComplete = () => {
    bulkSubtaskAction(
      (idx) => onToggleSubtask(task._id, idx, true),
      'Completed subtasks',
      'Failed to complete some subtasks'
    );
  };

  // ─── Subtask long press (touch) ──────────────────────────────
  const handleSubtaskLongPress = (index) => {
    const isSelected = selectedSubtaskIndices.has(index);
    if (!isSelected) {
      startSubtaskSelection(index);
    } else {
      toggleSubtaskSelection(index);
    }
  };

  // ─── Handlers for modals ──────────────────────────────────────
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return toast.error('Title required');
    setIsAdding(true);
    try {
      await onAddSubtask(task._id, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
    } catch (err) {
      // toast already handled in parent
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = (idx, done) => {
    onToggleSubtask(task._id, idx, done);
  };

  const handleOpenSubtaskModal = (idx) => {
    setActionSubtaskIndex(idx);
    setShowSubtaskAction(true);
  };

  const handleEditSubtask = (idx) => {
    const st = task.subtasks[idx];
    setSubtaskToEdit({ ...st, index: idx });
    setShowEditModal(true);
  };

  const handleDeleteSubtask = (idx) => {
    setConfirmDeleteIndex(idx);
  };

  const confirmDelete = () => {
    if (confirmDeleteIndex !== null) {
      onDeleteSubtask(task._id, confirmDeleteIndex);
      setConfirmDeleteIndex(null);
    }
  };

  const handleSaveEdit = (idx, data) => {
    onEditSubtask(task._id, idx, data);
  };

  const handleSelectFromSubtaskModal = (idx) => {
    startSubtaskSelection(idx);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = (due) => due && new Date(due) < new Date();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id);
      const newIndex = parseInt(over.id);
      const originalIndices = task.subtasks.map((_, i) => i);
      const indices = arrayMove(originalIndices, oldIndex, newIndex);
      onReorderSubtasks(task._id, indices);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f0f12] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition flex-shrink-0"
        >
          <FaArrowLeft className="text-base" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white break-words">{task.title}</h2>
          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            {!isReminder && <span className="capitalize">{task.status}</span>}
            {!isReminder && task.priority && <span className="capitalize">· {task.priority}</span>}
            {!isReminder && task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue(task.dueDate) ? 'text-red-500' : ''}`}>
                <FaCalendarAlt className="text-[9px]" /> {formatDate(task.dueDate)}
              </span>
            )}
            {task.folder && (
              <span className="flex items-center gap-1">
                <FaFolder className="text-[9px]" /> {task.folder.name}
              </span>
            )}
            {isReminder && (
              <span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400">
                <FaBell className="text-[9px]" /> Reminder · {task.recurrenceType === 'daily' ? 'Everyday' : 'Weekly'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 hidden md:flex flex-shrink-0">
          {task.isArchived ? (
            <button
              onClick={() => onRestore(task._id)}
              className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Restore"
            >
              <FaUndo className="text-sm" />
            </button>
          ) : (
            <button
              onClick={() => onArchive(task._id)}
              className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Archive"
            >
              <FaArchive className="text-sm" />
            </button>
          )}
          <button
            onClick={() => onDelete(task)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Delete"
          >
            <FaTrashAlt className="text-sm" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Subtasks</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">{task.subtasks?.length || 0}</span>
        </div>

        {/* ─── Subtask Bulk Toolbar ────────────────────────────── */}
        {subtaskSelectionMode && (
          <SubtaskBulkToolbar
            selectedCount={selectedSubtaskIndices.size}
            onCancel={clearSubtaskSelection}
            onDelete={bulkSubtaskDelete}
            onComplete={bulkSubtaskComplete}
          />
        )}

        {(!task.subtasks || task.subtasks.length === 0) && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No subtasks yet.</div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={task.subtasks.map((_, i) => String(i))}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {task.subtasks?.map((st, idx) => (
                <SortableSubtaskItem
                  key={idx}
                  id={String(idx)}
                  subtask={st}
                  index={idx}
                  onToggle={handleToggle}
                  onOpenModal={handleOpenSubtaskModal}
                  isOverdue={isOverdue}
                  formatDate={formatDate}
                  weekDays={weekDays}
                  isSelected={selectedSubtaskIndices.has(idx)}
                  onLongPress={handleSubtaskLongPress}
                  isTouch={isTouch}
                  selectionMode={subtaskSelectionMode}
                  onTap={toggleSubtaskSelection}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <form onSubmit={handleAddSubtask} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Add subtask..."
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"
          />
          <button
            type="submit"
            disabled={isAdding}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            {isAdding ? <FaSpinner className="animate-spin" /> : <FaPlus className="text-xs" />}
          </button>
        </form>
      </div>

      {/* ─── Subtask Modals ────────────────────────────────────── */}
      <SubtaskActionModal
        isOpen={showSubtaskAction}
        onClose={() => { setShowSubtaskAction(false); setActionSubtaskIndex(null); }}
        subtask={actionSubtaskIndex !== null ? task.subtasks[actionSubtaskIndex] : null}
        index={actionSubtaskIndex}
        onEdit={handleEditSubtask}
        onDelete={handleDeleteSubtask}
        onSelect={handleSelectFromSubtaskModal}
      />

      <SubtaskEditModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSubtaskToEdit(null); }}
        subtask={subtaskToEdit}
        index={subtaskToEdit?.index}
        onSave={handleSaveEdit}
      />

      <ConfirmModal
        isOpen={confirmDeleteIndex !== null}
        onClose={() => setConfirmDeleteIndex(null)}
        onConfirm={confirmDelete}
        title="Delete Subtask"
        message="This subtask will be permanently deleted."
        danger
      />

      {/* ─── Bulk subtask loading overlay ──────────────────────── */}
      {subtaskBulkLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 shadow-xl flex flex-col items-center">
            <FaSpinner className="animate-spin text-teal-500 text-4xl mb-3" />
            <p className="text-sm text-gray-700 dark:text-gray-300">Processing bulk action...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Task Card (updated selection logic) ──────────────────────
const TaskCard = React.memo(({
  task,
  onClick,
  onOpenModal,
  onToggleStatus,
  listeners,
  attributes,
  isSelected = false,
  onLongPress,
  isTouch,
  selectionMode,
}) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  };
  const isTrash = !!task.isTrash;
  const isReminder = isReminderTask(task);
  const isOverdue = !isTrash && !isReminder && task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';
  const subtaskCount = task.subtasks?.length || 0;
  const doneCount = task.subtasks?.filter(st => st.done).length || 0;

  // Long press detection only on touch devices
  const longPressTimer = useRef(null);
  const handleTouchStart = (e) => {
    if (e.target.closest('.task-status-btn') || e.target.closest('.task-more-btn')) return;
    longPressTimer.current = setTimeout(() => {
      if (onLongPress) onLongPress(task._id);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Double tap detection for options (touch only)
  const lastTap = useRef(0);
  const handleCardClick = (e) => {
    if (e.target.closest('.task-more-btn') || e.target.closest('.task-status-btn')) return;

    // If selection mode is active, toggle selection (even on trash)
    if (selectionMode) {
      onClick(task); // parent will handle toggle
      return;
    }

    if (isTouch) {
      const now = Date.now();
      const diff = now - lastTap.current;
      if (diff < 300 && diff > 0) {
        // Double tap: open modal
        onOpenModal(task);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) {
          // Single tap -> navigate (only if not selection mode)
          if (!selectionMode) {
            onClick(task);
          }
          lastTap.current = 0;
        }
      }, 300);
    } else {
      // Desktop: single click navigates (or toggles selection if selectionMode)
      onClick(task);
    }
  };

  const gripProps = isTrash ? {} : { ...listeners, ...attributes };

  return (
    <div
      className={`bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer ${
        isSelected ? 'bg-teal-50/70 dark:bg-teal-900/30' : ''
      }`}
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 text-gray-400 p-1 -ml-1 mt-0.5 touch-none touch-action-none ${isTrash ? 'opacity-30' : 'cursor-grab'}`}
          {...gripProps}
        >
          <FaGripVertical className="text-sm" />
        </div>

        {isTrash ? (
          <div
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-red-400 mt-0.5"
            title="In Trash"
          >
            <FaTrashAlt className="text-xs" />
          </div>
        ) : isReminder ? (
          <div
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-teal-500 dark:text-teal-400 mt-0.5"
            title="Reminder — repeats automatically"
          >
            <FaBell className="text-xs" />
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}
            className={`task-status-btn w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
              isCompleted
                ? 'bg-teal-500 border-teal-500 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
            }`}
            aria-label={isCompleted ? 'Mark as not done' : 'Mark as done'}
          >
            {isCompleted && <FaCheck className="text-[10px]" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className={`text-sm font-medium break-words ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>
              {task.title}
            </span>
            {isOverdue && <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0 mt-0.5" />}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isTrash ? (
              <span className="text-red-500 dark:text-red-400">In Trash</span>
            ) : isReminder ? (
              <span className="capitalize text-teal-600 dark:text-teal-400">
                {task.recurrenceType === 'daily' ? 'Everyday' : 'Weekly'}
              </span>
            ) : (
              <span className="capitalize">{task.status}</span>
            )}
            {!isTrash && !isReminder && task.dueDate && <span>{formatDate(task.dueDate)}</span>}
            {subtaskCount > 0 && <span>{doneCount}/{subtaskCount}</span>}
            {!isTrash && task.folder?.name && (
              <span className="flex items-center gap-1">
                <FaFolder className="text-[9px]" style={{ color: task.folder.color || undefined }} /> {task.folder.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenModal(task); }}
            className="task-more-btn hidden md:flex p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="More actions"
          >
            <FaEllipsisV className="text-sm" />
          </button>
          <div className="text-gray-300 dark:text-gray-600">
            <FaChevronDown className="text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Sortable Task Item ──────────────────────────────────────────
const SortableTaskItem = ({ id, task, onClick, onOpenModal, onToggleStatus, isSelected, onLongPress, isTouch, selectionMode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !!task.isTrash || isSelected });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <TaskCard
        task={task}
        onClick={onClick}
        onOpenModal={onOpenModal}
        onToggleStatus={onToggleStatus}
        listeners={listeners}
        attributes={attributes}
        isSelected={isSelected}
        onLongPress={onLongPress}
        isTouch={isTouch}
        selectionMode={selectionMode}
      />
    </div>
  );
};

// ─── Droppable Folder Tab (unchanged) ──────────────────────────
const DroppableFolderTab = ({ folder, isActive, onClick, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `${FOLDER_DROP_PREFIX}${folder._id}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
        isOver
          ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-2 ring-teal-400 scale-105'
          : isActive
          ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
      }`}
    >
      {children}
    </div>
  );
};

// ─── Folder Modal (unchanged) ──────────────────────────────────
const FolderModal = ({ isOpen, onClose, folders, onSave, onDelete, isLoading }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reset = () => {
    setName('');
    setColor('#4f46e5');
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Folder name required');
      return;
    }
    onSave({ name: name.trim(), color }, editingId);
    reset();
  };

  const handleEdit = (folder) => {
    setName(folder.name);
    setColor(folder.color || '#4f46e5');
    setEditingId(folder._id);
  };

  const handleDelete = (folder) => {
    setDeleteTarget(folder);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget._id);
    setDeleteTarget(null);
    reset();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { onClose(); reset(); }}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FaFolder className="text-teal-500" /> Folders
          </h2>
          <button
            onClick={() => { onClose(); reset(); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Folder name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border border-gray-200 dark:border-gray-700"
          />
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : (editingId ? 'Update' : 'Add')}
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {folders.map((folder) => (
            <div key={folder._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                <span className="text-gray-800 dark:text-white font-medium break-words">{folder.name}</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(folder)} className="text-gray-400 hover:text-teal-500 transition">
                  <FaEdit />
                </button>
                <button onClick={() => handleDelete(folder)} className="text-gray-400 hover:text-red-500 transition">
                  <FaTrashAlt />
                </button>
              </div>
            </div>
          ))}
          {folders.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No folders yet</p>
          )}
        </div>
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Delete Folder"
          message="All tasks in this folder will be unlinked, not deleted. Are you sure?"
          danger
        />
      </div>
    </BottomSheet>
  );
};

// ─── Task Form (unchanged) ─────────────────────────────────────
const TaskForm = ({ task, folders, onSave, onCancel, isEditing, isLoading, presetReminder = false }) => {
  const taskIsReminder = isReminderTask(task);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [dailyReminderTime, setDailyReminderTime] = useState(task?.dailyReminderTime || '');
  const [folderId, setFolderId] = useState(task?.folder?._id || task?.folder || '');

  const [isReminder, setIsReminder] = useState(task ? taskIsReminder : presetReminder);
  const [frequency, setFrequency] = useState(taskIsReminder ? task.recurrenceType : 'daily');
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );

  const [showDetails, setShowDetails] = useState(isEditing);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const folderOptions = [
    { value: '', label: 'No Folder' },
    ...folders.map((f) => ({ value: f._id, label: f.name })),
  ];

  const toggleDay = (day) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (isReminder && frequency === 'weekly' && recurrenceDays.length === 0) {
      toast.error('Pick at least one day for a weekly reminder');
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
      dailyReminderTime: dailyReminderTime || null,
      folderId: folderId || null,
      recurrenceType: isReminder ? frequency : 'none',
      recurrenceDays: isReminder && frequency === 'weekly' ? recurrenceDays : [],
      recurrenceEndDate: isReminder ? (recurrenceEndDate || null) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {isEditing
            ? (isReminder ? 'Edit Reminder' : 'Edit Task')
            : (isReminder ? 'New Reminder' : 'New Personal Task')}
        </h2>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
          <FaTimes />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
        />
      </div>

      <div className={`border rounded-xl p-3 transition ${isReminder ? 'border-teal-400 dark:border-teal-600 bg-teal-50/40 dark:bg-teal-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isReminder}
            onChange={(e) => setIsReminder(e.target.checked)}
            className="w-4 h-4 rounded accent-teal-600 cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
            <FaBell className="text-teal-500 text-xs" /> Set as Reminder
          </span>
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-6">
          Reminders repeat automatically and don't have a "Complete" state.
        </p>

        {isReminder && (
          <div className="mt-3 space-y-3 pl-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFrequency('daily')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    frequency === 'daily'
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Everyday
                </button>
                <button
                  type="button"
                  onClick={() => setFrequency('weekly')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    frequency === 'weekly'
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {frequency === 'weekly' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">On these days</label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        recurrenceDays.includes(idx)
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date (optional)</label>
              <input
                type="datetime-local"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 outline-none text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition"
      >
        <FaAngleDown className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        {showDetails ? 'Hide details' : 'Add more details'}
      </button>

      {showDetails && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <CustomSelect
                value={priority}
                onChange={setPriority}
                options={priorityOptions}
                placeholder="Priority"
                disabled={isReminder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
              <CustomSelect
                value={folderId}
                onChange={setFolderId}
                options={folderOptions}
                placeholder="No Folder"
                icon={FaFolder}
                disabled={isReminder}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isReminder}
              className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none ${isReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Notify Time (HH:MM)</label>
            <input
              type="time"
              value={dailyReminderTime}
              onChange={(e) => setDailyReminderTime(e.target.value)}
              disabled={isReminder}
              className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none ${isReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-2 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 transition"
        >
          {isLoading ? <FaSpinner className="animate-spin mx-auto" /> : (isEditing ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  );
};

// ─── Gesture Instruction Modal (unchanged) ────────────────────
const GestureInstructionModal = ({ show, onDismiss }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
      >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 dark:text-teal-400">
            <FaHandPointer className="text-3xl" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Quick Actions</h3>
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
          <p className="flex items-start gap-2">
            <span className="text-teal-500 font-bold">↯</span>
            <span><strong>Double‑tap</strong> a task (or click the three dots) to see all options: edit, archive, delete, etc.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-teal-500 font-bold">☰</span>
            <span><strong>Long‑press</strong> (mobile) or use the <strong>"Select"</strong> button from the three‑dot menu to enter selection mode. Then tap other tasks to select/deselect them. Perform bulk actions from the top bar.</span>
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="mt-6 w-full py-2.5 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:hover:bg-teal-600 transition"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
};

// ─── Bulk Action Toolbar (top bar) ─────────────────────────────
const BulkActionToolbar = ({ selectedCount, onCancel, onDelete, onPermanentDelete, onArchive, onComplete, onRestore, isTrashView }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 px-3 sm:px-6 h-12 flex items-center justify-between gap-2"
    >
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="font-semibold">{selectedCount}</span> selected
      </div>
      <div className="flex items-center gap-2">
        {isTrashView ? (
          <>
            <button
              onClick={onRestore}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition flex items-center gap-1"
            >
              <FaUndo className="text-xs" /> Restore
            </button>
            <button
              onClick={onPermanentDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition flex items-center gap-1"
            >
              <FaTrashAlt className="text-xs" /> Delete Forever
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onComplete}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition flex items-center gap-1"
            >
              <FaCheckDouble className="text-xs" /> Done
            </button>
            <button
              onClick={onArchive}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition flex items-center gap-1"
            >
              <FaArchive className="text-xs" /> Archive
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition flex items-center gap-1"
            >
              <FaTrashAlt className="text-xs" /> Delete
            </button>
          </>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────
const PersonalTasks = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ folderId: '', status: '', priority: '', archived: false, trash: false });
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionTask, setActionTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const [viewMode, setViewMode] = useState('tasks');

  // ─── Selection state ──────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // ─── Move to folder state ────────────────────────────────────
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTask, setMoveTask] = useState(null);

  // ─── Gesture instruction state ──────────────────────────────
  const [showGesture, setShowGesture] = useState(false);

  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetPersonalTasksQuery({
    folderId: filters.trash ? undefined : (filters.folderId || undefined),
    status: filters.trash ? undefined : (filters.status || undefined),
    priority: filters.trash ? undefined : (filters.priority || undefined),
    archived: filters.trash ? undefined : (filters.archived ? 'true' : undefined),
    trash: filters.trash ? 'true' : undefined,
  });
  const {
    data: foldersData,
    isLoading: foldersLoading,
    refetch: refetchFolders,
  } = useGetPersonalFoldersQuery();

  const folders = foldersData?.folders || [];

  const [createTask, { isLoading: isCreating }] = useCreatePersonalTaskMutation();
  const [updateTask, { isLoading: isUpdating }] = useUpdatePersonalTaskMutation();
  const [archiveTask] = useArchivePersonalTaskMutation();
  const [restoreTask] = useRestorePersonalTaskMutation();
  const [deleteTask] = useDeletePersonalTaskMutation();
  const [permanentlyDeleteTask] = usePermanentlyDeletePersonalTaskMutation();
  const [reorderTasks] = useReorderPersonalTasksMutation();
  const [createFolder, { isLoading: isCreatingFolder }] = useCreatePersonalFolderMutation();
  const [updateFolder, { isLoading: isUpdatingFolder }] = useUpdatePersonalFolderMutation();
  const [deleteFolder, { isLoading: isDeletingFolder }] = useDeletePersonalFolderMutation();

  const [addSubtask] = useAddPersonalSubTaskMutation();
  const [toggleSubtask] = useTogglePersonalSubTaskMutation();
  const [deleteSubtaskMutation] = useDeletePersonalSubTaskMutation();
  const [updateSubtask] = useUpdatePersonalSubTaskMutation();
  const [reorderSubtasks] = useReorderPersonalSubTasksMutation();

  const [localTasks, setLocalTasks] = useState([]);
  const orderMap = useRef({});

  useEffect(() => {
    if (tasksData?.tasks) {
      const fetched = tasksData.tasks;
      const sorted = [...fetched].sort((a, b) => {
        const orderA = orderMap.current[a._id] ?? a.order ?? 0;
        const orderB = orderMap.current[b._id] ?? b.order ?? 0;
        return orderA - orderB;
      });
      setLocalTasks(sorted);
    }
  }, [tasksData]);

  const updateOrderMap = (tasks) => {
    tasks.forEach((t, i) => {
      orderMap.current[t._id] = i;
    });
  };

  // ─── Selection handlers ──────────────────────────────────────
  const toggleSelection = (taskId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      if (newSet.size === 0) setSelectionMode(false);
      else setSelectionMode(true);
      return newSet;
    });
  };

  const startSelection = (taskId) => {
    setSelectedIds(new Set([taskId]));
    setSelectionMode(true);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // ─── Bulk action helpers ─────────────────────────────────────
  const bulkAction = async (actionFn, successMsg, errorMsg) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await actionFn(id);
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed on task ${id}:`, err);
      }
    }
    setBulkLoading(false);
    clearSelection();
    if (failCount === 0) {
      toast.success(`${successMsg} (${successCount} tasks)`);
    } else {
      toast.error(`Partial success: ${successCount} done, ${failCount} failed.`);
    }
    refetchTasks();
  };

  const bulkDelete = () => {
    if (filters.trash) {
      // In trash view, delete means permanent delete
      setPermanentDeleteTarget({ _id: 'bulk', title: `${selectedIds.size} tasks` });
    } else {
      bulkAction(
        (id) => deleteTask(id).unwrap(),
        'Moved to trash',
        'Failed to delete some tasks'
      );
    }
  };

  const bulkPermanentDelete = () => {
    setPermanentDeleteTarget({ _id: 'bulk', title: `${selectedIds.size} tasks` });
  };

  const bulkArchive = () => bulkAction(
    (id) => archiveTask(id).unwrap(),
    'Archived',
    'Failed to archive some tasks'
  );

  const bulkComplete = () => bulkAction(
    (id) => updateTask({ taskId: id, data: { status: 'completed' } }).unwrap(),
    'Completed',
    'Failed to complete some tasks'
  );

  const bulkRestore = () => bulkAction(
    (id) => restoreTask(id).unwrap(),
    'Restored',
    'Failed to restore some tasks'
  );

  // ─── Confirm permanent delete for bulk ──────────────────────
  const confirmBulkPermanentDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        await permanentlyDeleteTask(id).unwrap();
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed to permanently delete task ${id}:`, err);
      }
    }
    setBulkLoading(false);
    clearSelection();
    setPermanentDeleteTarget(null);
    if (failCount === 0) {
      toast.success(`Permanently deleted (${successCount} tasks)`);
    } else {
      toast.error(`Partial success: ${successCount} deleted, ${failCount} failed.`);
    }
    refetchTasks();
  };

  // ─── Show gesture instruction on first task creation ────────
  const showGestureInstruction = () => {
    if (!sessionStorage.getItem('gestureShown')) {
      setShowGesture(true);
      sessionStorage.setItem('gestureShown', 'true');
      setTimeout(() => setShowGesture(false), 5000);
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────

  const handleCreateTask = async (payload) => {
    const tempId = `temp-${Date.now()}`;
    const newTask = {
      _id: tempId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      dueDate: payload.dueDate,
      dailyReminderTime: payload.dailyReminderTime,
      folder: payload.folderId ? { _id: payload.folderId, name: folders.find(f => f._id === payload.folderId)?.name || '' } : null,
      recurrenceType: payload.recurrenceType,
      recurrenceDays: payload.recurrenceDays,
      recurrenceEndDate: payload.recurrenceEndDate,
      status: 'pending',
      isArchived: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    setLocalTasks(prev => [newTask, ...prev]);
    updateOrderMap([newTask, ...localTasks]);
    try {
      const result = await createTask(payload).unwrap();
      const realTask = result.task;
      setLocalTasks(prev => prev.map(t => t._id === tempId ? realTask : t));
      const index = orderMap.current[tempId];
      delete orderMap.current[tempId];
      if (index !== undefined) orderMap.current[realTask._id] = index;
      toast.success(payload.recurrenceType !== 'none' ? 'Reminder created!' : 'Task created!');
      setShowCreateModal(false);
      refetchTasks();
      showGestureInstruction();
    } catch (err) {
      setLocalTasks(prev => prev.filter(t => t._id !== tempId));
      delete orderMap.current[tempId];
      toast.error(err?.data?.message || 'Failed to create task');
    }
  };

  const handleUpdateTask = async (payload) => {
    const taskId = editingTask._id;
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => t._id === taskId ? { ...t, ...payload } : t));
    try {
      await updateTask({ taskId, data: payload }).unwrap();
      toast.success(payload.recurrenceType !== 'none' ? 'Reminder updated!' : 'Task updated!');
      setShowCreateModal(false);
      setEditingTask(null);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to update task');
    }
  };

  const handleArchive = async (taskId) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => t._id === taskId ? { ...t, isArchived: true } : t));
    try {
      await archiveTask(taskId).unwrap();
      toast.success('Archived');
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to archive');
    }
  };

  const handleRestore = async (taskId) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(t => !(filters.trash && t._id === taskId)).map(t =>
      t._id === taskId ? { ...t, isArchived: false, isTrash: false } : t
    ));
    try {
      await restoreTask(taskId).unwrap();
      toast.success('Restored');
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to restore');
    }
  };

  const handleDelete = (taskOrId) => {
    if (typeof taskOrId === 'string') {
      const found = localTasks.find(t => t._id === taskOrId);
      setDeleteTarget(found ? { _id: found._id, title: found.title } : { _id: taskOrId, title: '' });
    } else {
      setDeleteTarget({ _id: taskOrId._id, title: taskOrId.title });
    }
  };

  const confirmDeleteTask = async () => {
    if (!deleteTarget) return;
    const taskId = deleteTarget._id;
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(t => t._id !== taskId));
    delete orderMap.current[taskId];
    try {
      await deleteTask(taskId).unwrap();
      toast.success('Moved to trash');
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      setDeleteTarget(null);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to delete');
    }
  };

  const handlePermanentDelete = (task) => {
    setPermanentDeleteTarget({ _id: task._id, title: task.title, isBulk: false });
  };

  const confirmPermanentDeleteTask = async () => {
    const target = permanentDeleteTarget;
    if (!target) return;
    if (target._id === 'bulk') {
      await confirmBulkPermanentDelete();
      return;
    }
    const taskId = target._id;
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(t => t._id !== taskId));
    delete orderMap.current[taskId];
    try {
      await permanentlyDeleteTask(taskId).unwrap();
      toast.success('Permanently deleted');
      setPermanentDeleteTarget(null);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to permanently delete');
    }
  };

  const handleStatusToggle = async (taskId, newStatus) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
    try {
      await updateTask({ taskId, data: { status: newStatus } }).unwrap();
      toast.success(newStatus === 'completed' ? 'Task completed' : 'Task reopened');
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to update status');
    }
  };

  const handleCardStatusToggle = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    handleStatusToggle(task._id, newStatus);
  };

  const handleMoveTaskToFolder = async (taskId, folderId) => {
    const task = localTasks.find(t => t._id === taskId);
    if (!task) return;
    const currentFolderId = task.folder?._id || task.folder || null;
    if (currentFolderId === folderId) return;

    const folderObj = folders.find(f => f._id === folderId);
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t =>
      t._id === taskId
        ? { ...t, folder: folderObj ? { _id: folderObj._id, name: folderObj.name, color: folderObj.color } : null }
        : t
    ));
    try {
      await updateTask({ taskId, data: { folderId } }).unwrap();
      toast.success(`Moved to ${folderObj?.name || 'folder'}`);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to move task');
    }
  };

  const handleSaveFolder = async (data, folderId) => {
    try {
      if (folderId) {
        await updateFolder({ folderId, data }).unwrap();
        toast.success('Folder updated');
      } else {
        await createFolder(data).unwrap();
        toast.success('Folder created');
      }
      refetchFolders();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save folder');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await deleteFolder(folderId).unwrap();
      toast.success('Folder deleted');
      refetchFolders();
      refetchTasks();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete folder');
    }
  };

  // Subtask handlers
  const handleAddSubtask = async (taskId, data) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        const subtasks = t.subtasks || [];
        const newSubtask = { ...data, done: false, _id: `temp-${Date.now()}` };
        return { ...t, subtasks: [...subtasks, newSubtask] };
      }
      return t;
    }));
    try {
      await addSubtask({ taskId, data }).unwrap();
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (taskId, subTaskIndex, done) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        const subtasks = (t.subtasks || []).map((st, i) =>
          i === subTaskIndex ? { ...st, done } : st
        );
        return { ...t, subtasks };
      }
      return t;
    }));
    try {
      await toggleSubtask({ taskId, subTaskIndex, done }).unwrap();
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to toggle subtask');
    }
  };

  const handleDeleteSubtask = async (taskId, subTaskIndex) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        const subtasks = [...(t.subtasks || [])];
        subtasks.splice(subTaskIndex, 1);
        return { ...t, subtasks };
      }
      return t;
    }));
    try {
      await deleteSubtaskMutation({ taskId, subTaskIndex }).unwrap();
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to delete subtask');
    }
  };

  const handleEditSubtask = async (taskId, subTaskIndex, data) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        const subtasks = [...(t.subtasks || [])];
        if (subtasks[subTaskIndex]) subtasks[subTaskIndex] = { ...subtasks[subTaskIndex], ...data };
        return { ...t, subtasks };
      }
      return t;
    }));
    try {
      await updateSubtask({ taskId, subTaskIndex, data }).unwrap();
      toast.success('Subtask updated');
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to update subtask');
    }
  };

  const handleReorderSubtasks = async (taskId, orderedIndices) => {
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.map(t => {
      if (t._id === taskId) {
        const reordered = orderedIndices.map(i => t.subtasks[i]);
        return { ...t, subtasks: reordered };
      }
      return t;
    }));
    try {
      await reorderSubtasks({ taskId, orderedSubTaskIndices: orderedIndices }).unwrap();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to reorder subtasks');
    }
  };

  // ─── Task list handlers ──────────────────────────────────────

  const handleTaskClick = (task) => {
    if (selectionMode) {
      // If selection mode is active, toggle selection (including trash)
      toggleSelection(task._id);
      return;
    }
    // If not selection mode, open task detail or modal for trash
    if (task.isTrash) {
      handleOpenTaskModal(task);
      return;
    }
    setSelectedTaskId(task._id);
  };

  const handleLongPress = (taskId) => {
    const isSelected = selectedIds.has(taskId);
    if (!isSelected) {
      startSelection(taskId);
    } else {
      toggleSelection(taskId);
    }
  };

  const handleSelectFromModal = (taskId) => {
    startSelection(taskId);
  };

  const handleBackToList = () => setSelectedTaskId(null);

  const handleOpenTaskModal = (task) => {
    setActionTask(task);
    setShowActionModal(true);
  };

  const handleEditFromModal = () => {
    if (actionTask) {
      setEditingTask(actionTask);
      setShowCreateModal(true);
      setShowActionModal(false);
    }
  };

  const handleMoveFromModal = (task) => {
    setMoveTask(task);
    setShowMoveModal(true);
    setShowActionModal(false);
  };

  const selectedTask = useMemo(() => localTasks.find(t => t._id === selectedTaskId), [localTasks, selectedTaskId]);

  // ─── Filtering & sorting ──────────────────────────────────────

  const displayedTasks = useMemo(() => {
    let filtered = localTasks.filter(task => {
      if (filters.trash) return task.isTrash === true;
      if (task.isTrash) return false;

      const taskIsReminder = isReminderTask(task);
      if (viewMode === 'reminders' && !taskIsReminder) return false;
      if (viewMode === 'tasks' && taskIsReminder) return false;
      if (filters.folderId && task.folder?._id !== filters.folderId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.archived && !task.isArchived) return false;
      if (!filters.archived && task.isArchived) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const orderA = orderMap.current[a._id] ?? a.order ?? 0;
      const orderB = orderMap.current[b._id] ?? b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = a.dueDate ? new Date(a.dueDate) : new Date(8640000000000000);
      const dateB = b.dueDate ? new Date(b.dueDate) : new Date(8640000000000000);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return filtered;
  }, [localTasks, filters, sortOrder, viewMode]);

  // ─── Reorder tasks / move into folder (drag & drop) ───────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);

    if (overId.startsWith(FOLDER_DROP_PREFIX)) {
      const folderId = overId.slice(FOLDER_DROP_PREFIX.length);
      await handleMoveTaskToFolder(active.id, folderId);
      return;
    }

    if (active.id === over.id) return;

    const oldIndex = localTasks.findIndex(t => t._id === active.id);
    const newIndex = localTasks.findIndex(t => t._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const prevTasks = [...localTasks];
    const reordered = arrayMove(localTasks, oldIndex, newIndex);
    reordered.forEach((t, i) => {
      orderMap.current[t._id] = i;
    });
    setLocalTasks(reordered);

    try {
      await reorderTasks({ orderedTaskIds: reordered.map(t => t._id) }).unwrap();
    } catch (err) {
      setLocalTasks(prevTasks);
      prevTasks.forEach((t, i) => {
        orderMap.current[t._id] = i;
      });
      toast.error(err?.data?.message || 'Failed to reorder tasks');
    }
  };

  // ─── Tabs ──────────────────────────────────────────────────────

  const handleTabClick = (folderId) => {
    if (selectionMode) return;
    setFilters(prev => ({ ...prev, folderId, archived: false, trash: false }));
  };
  const handleArchivedTabClick = () => {
    if (selectionMode) return;
    setFilters(prev => ({ ...prev, archived: true, folderId: '', trash: false }));
  };
  const handleAllTabClick = () => {
    if (selectionMode) return;
    setFilters(prev => ({ ...prev, folderId: '', archived: false, trash: false }));
  };
  const handleTrashTabClick = () => {
    if (selectionMode) return;
    setFilters(prev => ({ ...prev, trash: true, archived: false, folderId: '' }));
  };

  // ─── Get touch device info ──────────────────────────────────
  const isTouch = useIsTouchDevice();

  // ─── Render ────────────────────────────────────────────────────

  if (tasksLoading || foldersLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>
        <div className="flex-1 flex items-center justify-center">
          <FaSpinner className="animate-spin text-teal-500 text-3xl" />
        </div>
      </div>
    );
  }

  const isTrashView = filters.trash;

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-[#0f0f12] flex flex-col md:flex-row">
        <div className="hidden md:block md:w-72 md:flex-shrink-0"><GeneralSidebar /></div>

        <div className="flex-1 flex flex-col min-h-screen relative">
          {selectedTask ? (
            <TaskDetailView
              task={selectedTask}
              onBack={handleBackToList}
              onAddSubtask={handleAddSubtask}
              onToggleSubtask={handleToggleSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onDelete={handleDelete}
              onReorderSubtasks={handleReorderSubtasks}
              onEditSubtask={handleEditSubtask}
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                {selectionMode ? (
                  <BulkActionToolbar
                    selectedCount={selectedIds.size}
                    onCancel={clearSelection}
                    onDelete={bulkDelete}
                    onPermanentDelete={bulkPermanentDelete}
                    onArchive={bulkArchive}
                    onComplete={bulkComplete}
                    onRestore={bulkRestore}
                    isTrashView={isTrashView}
                  />
                ) : (
                  <>
                    <div className="px-3 sm:px-6 h-12 flex items-center justify-between gap-2">
                      <h1 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        <FaTasks className="text-teal-500 text-sm" /> Personal Tasks
                      </h1>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowFolderModal(true)}
                          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <FaFolderOpen className="text-sm" />
                        </button>
                        <button
                          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                          className="p-1.5 text-gray-400 hover:text-teal-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {sortOrder === 'asc' ? <FaSortAmountUp className="text-sm" /> : <FaSortAmountDown className="text-sm" />}
                        </button>
                        <button
                          onClick={handleArchivedTabClick}
                          className={`p-1.5 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${filters.archived ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 hover:text-purple-500'}`}
                          title="Archived"
                        >
                          <FaArchive className="text-sm" />
                        </button>
                        <button
                          onClick={handleTrashTabClick}
                          className={`p-1.5 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${filters.trash ? 'text-red-600 dark:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                          title="Trash"
                        >
                          <FaTrashAlt className="text-sm" />
                        </button>
                      </div>
                    </div>

                    <div className="px-3 pb-2 flex items-center gap-2">
                      <button
                        onClick={() => setViewMode('tasks')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                          viewMode === 'tasks'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        Personal Tasks
                      </button>
                      <button
                        onClick={() => setViewMode('reminders')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                          viewMode === 'reminders'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <FaBell className="text-[10px]" /> Reminders
                      </button>
                    </div>

                    <div className="px-3 pb-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
                      <div
                        onClick={handleAllTabClick}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                          !filters.archived && !filters.folderId && !filters.trash
                            ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                        }`}
                      >
                        All
                      </div>
                      {folders.map((folder) => (
                        <DroppableFolderTab
                          key={folder._id}
                          folder={folder}
                          isActive={filters.folderId === folder._id && !filters.archived && !filters.trash}
                          onClick={() => handleTabClick(folder._id)}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                          {folder.name}
                        </DroppableFolderTab>
                      ))}
                      <button
                        onClick={() => setShowFolderModal(true)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-teal-500 transition rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                      >
                        <FaPlus className="text-xs" />
                      </button>
                    </div>
                  </>
                )}
              </header>

              <main className="flex-1 overflow-y-auto">
                {displayedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                    {filters.trash ? (
                      <>
                        <FaTrashAlt className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm font-medium">Trash is empty</p>
                        <p className="text-xs">Deleted tasks and reminders show up here.</p>
                      </>
                    ) : viewMode === 'reminders' ? (
                      <>
                        <FaBell className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm font-medium">No reminders found</p>
                        <p className="text-xs">Set a reminder to get started.</p>
                      </>
                    ) : (
                      <>
                        <FaTasks className="text-4xl mb-2 opacity-30" />
                        <p className="text-sm font-medium">No tasks found</p>
                        <p className="text-xs">Create a new task to get started.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <SortableContext items={displayedTasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
                    <div>
                      {displayedTasks.map((task) => (
                        <SortableTaskItem
                          key={task._id}
                          id={task._id}
                          task={task}
                          onClick={handleTaskClick}
                          onOpenModal={handleOpenTaskModal}
                          onToggleStatus={handleCardStatusToggle}
                          isSelected={selectedIds.has(task._id)}
                          onLongPress={handleLongPress}
                          isTouch={isTouch}
                          selectionMode={selectionMode}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}
              </main>

              <GeneralBottombar />
            </DndContext>
          )}
        </div>
      </div>

      {/* ─── Modals ────────────────────────────────────────────────── */}

      <BottomSheet isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setEditingTask(null); }}>
        <TaskForm
          task={editingTask}
          folders={folders}
          onSave={editingTask ? handleUpdateTask : handleCreateTask}
          onCancel={() => { setShowCreateModal(false); setEditingTask(null); }}
          isEditing={!!editingTask}
          isLoading={isCreating || isUpdating}
          presetReminder={!editingTask && viewMode === 'reminders'}
        />
      </BottomSheet>

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        folders={folders}
        onSave={handleSaveFolder}
        onDelete={handleDeleteFolder}
        isLoading={isCreatingFolder || isUpdatingFolder || isDeletingFolder}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTask}
        title={isReminderTask(deleteTarget) ? 'Delete Reminder' : 'Delete Task'}
        message="This will be moved to trash. You can restore it from the Trash tab, or it's permanently deleted after 30 days."
        danger
      />

      <PermanentDeleteModal
        isOpen={!!permanentDeleteTarget && permanentDeleteTarget._id !== 'bulk'}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={confirmPermanentDeleteTask}
        itemName={permanentDeleteTarget?.title}
        isBulk={false}
      />

      {/* Bulk permanent delete confirmation */}
      <PermanentDeleteModal
        isOpen={permanentDeleteTarget?._id === 'bulk'}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={confirmPermanentDeleteTask}
        itemName={`${selectedIds.size} tasks`}
        isBulk={true}
      />

      <TaskActionModal
        isOpen={showActionModal}
        onClose={() => { setShowActionModal(false); setActionTask(null); }}
        task={actionTask}
        onEdit={handleEditFromModal}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onStatusToggle={handleStatusToggle}
        onMove={handleMoveFromModal}
        onPermanentDelete={handlePermanentDelete}
        onSelect={handleSelectFromModal}
      />

      <MoveTaskModal
        isOpen={showMoveModal}
        onClose={() => { setShowMoveModal(false); setMoveTask(null); }}
        task={moveTask}
        folders={folders}
        onMoveTask={handleMoveTaskToFolder}
      />

      {!selectedTask && !selectionMode && (
        <button
          onClick={() => { setEditingTask(null); setShowCreateModal(true); }}
          className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
        >
          <FaPlus className="text-xl" />
        </button>
      )}

      {/* ─── Gesture Instruction Modal ────────────────────────── */}
      <GestureInstructionModal show={showGesture} onDismiss={() => setShowGesture(false)} />

      {/* ─── Bulk loading overlay ──────────────────────────────── */}
      {bulkLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 shadow-xl flex flex-col items-center">
            <FaSpinner className="animate-spin text-teal-500 text-4xl mb-3" />
            <p className="text-sm text-gray-700 dark:text-gray-300">Processing bulk action...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default PersonalTasks;