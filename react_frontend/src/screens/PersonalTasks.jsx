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
  useCreatePersonalFolderMutation,
  useUpdatePersonalFolderMutation,
  useDeletePersonalFolderMutation,
  // ─── Personal sub‑task mutations moved here ──────────────────
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
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import GeneralSidebar from '../components/GeneralSidebar';
import GeneralBottombar from '../components/GeneralBottombar';

// ─── DnD ──────────────────────────────────────────────────────────
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Helper: is this task a Reminder (recurring) rather than a
// one-off Personal Task? Reminders recur forever (or until an end
// date) so they never get a "Complete" action — they just repeat.
const isReminderTask = (task) => !!(task?.recurrenceType && task.recurrenceType !== 'none');

// ─── Touch detection hook ──────────────────────────────────────
const useIsTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return isTouch;
};

// ─── Custom Select ────────────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, className = '' }) => {
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
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
      >
        {Icon && <Icon className="text-xs text-gray-400" />}
        <span className="flex-1 text-left truncate">{selected ? selected.label : placeholder}</span>
        <FaAngleDown className={`text-xs text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
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

// ─── Bottom Sheet ──────────────────────────────────────────────────
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
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: animating ? 0 : '100%', opacity: animating ? 1 : 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl bg-white dark:bg-[#1a1a1a] shadow-xl max-h-[90vh] overflow-y-auto"
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
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
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

// ─── Task Action Modal ────────────────────────────────────────────
// Reminders never show a "Complete" action — they recur, they don't finish.
const TaskActionModal = ({ isOpen, onClose, task, onEdit, onArchive, onRestore, onDelete, onStatusToggle }) => {
  if (!isOpen || !task) return null;
  const isArchived = task.isArchived;
  const isCompleted = task.status === 'completed';
  const isReminder = isReminderTask(task);
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{task.title}</h3>
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
            onClick={() => { onDelete(task._id); onClose(); }}
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

// ─── Subtask Action Modal ─────────────────────────────────────────
const SubtaskActionModal = ({ isOpen, onClose, subtask, index, onEdit, onDelete }) => {
  if (!isOpen || !subtask) return null;
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{subtask.title}</h3>
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

// ─── Subtask Edit Modal ──────────────────────────────────────────
const SubtaskEditModal = ({ isOpen, onClose, subtask, index, onSave }) => {
  const [title, setTitle] = useState(subtask?.title || '');
  const [dueDate, setDueDate] = useState(subtask?.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 16) : '');
  const [recurrenceType, setRecurrenceType] = useState(subtask?.recurrenceType || 'none');
  const [recurrenceDays, setRecurrenceDays] = useState(subtask?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    subtask?.recurrenceEndDate ? new Date(subtask.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          <select
            value={recurrenceType}
            onChange={(e) => {
              setRecurrenceType(e.target.value);
              if (e.target.value !== 'weekly') setRecurrenceDays([]);
            }}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 outline-none"
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
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

// ─── Subtask Item ──────────────────────────────────────────────────
const SubtaskItem = ({ subtask, index, onToggle, onLongPress, onOpenModal, isOverdue, formatDate, weekDays, listeners, attributes }) => {
  const [pressTimer, setPressTimer] = useState(null);
  const isTouch = useIsTouchDevice();

  const handlePointerDown = (e) => {
    if (isTouch) {
      const timer = setTimeout(() => {
        onLongPress(index);
      }, 500);
      setPressTimer(timer);
    }
  };

  const handlePointerUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  // Drag only on the grip
  const gripProps = { ...listeners, ...attributes };

  return (
    <div
      className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 text-gray-400 cursor-grab touch-none p-1 -ml-1 touch-action-none"
          {...gripProps}
        >
          <FaGripVertical className="text-sm" />
        </div>
        <button
          onClick={() => onToggle(index, subtask.done)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
            subtask.done
              ? 'bg-teal-500 border-teal-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-teal-500'
          }`}
        >
          {subtask.done && <FaCheck className="text-[10px]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <span className={`text-sm text-gray-800 dark:text-white ${subtask.done ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
              {subtask.title}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenModal(index); }}
              className="hidden md:flex p-1.5 text-gray-400 hover:text-teal-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
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

// ─── Sortable Subtask Item ────────────────────────────────────────
const SortableSubtaskItem = ({ id, subtask, index, onToggle, onLongPress, onOpenModal, isOverdue, formatDate, weekDays }) => {
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
        onLongPress={onLongPress}
        onOpenModal={onOpenModal}
        isOverdue={isOverdue}
        formatDate={formatDate}
        weekDays={weekDays}
        listeners={listeners}
        attributes={attributes}
      />
    </div>
  );
};

// ─── Task Detail View ─────────────────────────────────────────────
const TaskDetailView = ({ task, onBack, onAddSubtask, onToggleSubtask, onDeleteSubtask, onArchive, onRestore, onDelete, onReorderSubtasks, onEditSubtask }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [subtaskToEdit, setSubtaskToEdit] = useState(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);
  const [showSubtaskAction, setShowSubtaskAction] = useState(false);
  const [actionSubtaskIndex, setActionSubtaskIndex] = useState(null);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isReminder = isReminderTask(task);

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

  const handleLongPress = (idx) => {
    setActionSubtaskIndex(idx);
    setShowSubtaskAction(true);
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isOverdue = (due) => due && new Date(due) < new Date();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Moves the ORIGINAL indices (not the reordered array's own position
  // markers) so the backend knows exactly which old slot goes where.
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
      {/* Compact Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f12] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        >
          <FaArrowLeft className="text-base" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white truncate">{task.title}</h2>
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
        {/* Archive and Delete buttons – hidden on mobile, visible on md+ */}
        <div className="flex gap-0.5 hidden md:flex">
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
            onClick={() => onDelete(task._id)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Delete"
          >
            <FaTrashAlt className="text-sm" />
          </button>
        </div>
      </div>

      {/* Subtasks list with DnD */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Subtasks</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">{task.subtasks?.length || 0}</span>
        </div>

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
                  onLongPress={handleLongPress}
                  onOpenModal={handleOpenSubtaskModal}
                  isOverdue={isOverdue}
                  formatDate={formatDate}
                  weekDays={weekDays}
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

      {/* Subtask Action Modal */}
      <SubtaskActionModal
        isOpen={showSubtaskAction}
        onClose={() => { setShowSubtaskAction(false); setActionSubtaskIndex(null); }}
        subtask={actionSubtaskIndex !== null ? task.subtasks[actionSubtaskIndex] : null}
        index={actionSubtaskIndex}
        onEdit={handleEditSubtask}
        onDelete={handleDeleteSubtask}
      />

      {/* Edit Subtask Modal */}
      <SubtaskEditModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSubtaskToEdit(null); }}
        subtask={subtaskToEdit}
        index={subtaskToEdit?.index}
        onSave={handleSaveEdit}
      />

      {/* Confirm Delete Subtask */}
      <ConfirmModal
        isOpen={confirmDeleteIndex !== null}
        onClose={() => setConfirmDeleteIndex(null)}
        onConfirm={confirmDelete}
        title="Delete Subtask"
        message="This subtask will be permanently deleted."
        danger
      />
    </div>
  );
};

// ─── Task Card ──────────────────────────────────────────────────────
// Non-reminder tasks get a tappable status circle on the left, mirroring
// the subtask checkbox. Reminders show a static bell instead — they don't
// have a "done" state, they just keep recurring.
const TaskCard = React.memo(({ task, onClick, onOpenModal, onToggleStatus, listeners, attributes }) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  };
  const isReminder = isReminderTask(task);
  const isOverdue = !isReminder && task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';
  const subtaskCount = task.subtasks?.length || 0;
  const doneCount = task.subtasks?.filter(st => st.done).length || 0;

  const isTouch = useIsTouchDevice();

  const lastTap = useRef(0);
  const handleCardClick = (e) => {
    if (e.target.closest('.task-more-btn') || e.target.closest('.task-status-btn')) return;
    if (isTouch) {
      const now = Date.now();
      const diff = now - lastTap.current;
      if (diff < 300) {
        onOpenModal(task);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
        setTimeout(() => {
          if (lastTap.current === now) {
            onClick(task);
            lastTap.current = 0;
          }
        }, 300);
      }
    } else {
      // Desktop: single click navigates
      onClick(task);
    }
  };

  // Drag only on the grip
  const gripProps = { ...listeners, ...attributes };

  return (
    <div
      className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 text-gray-400 cursor-grab touch-none p-1 -ml-1 touch-action-none"
          {...gripProps}
        >
          <FaGripVertical className="text-sm" />
        </div>

        {isReminder ? (
          <div
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-teal-500 dark:text-teal-400"
            title="Reminder — repeats automatically"
          >
            <FaBell className="text-xs" />
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}
            className={`task-status-btn w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
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
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-white'}`}>
              {task.title}
            </span>
            {isOverdue && <FaExclamationCircle className="text-xs text-red-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isReminder ? (
              <span className="capitalize text-teal-600 dark:text-teal-400">
                {task.recurrenceType === 'daily' ? 'Everyday' : 'Weekly'}
              </span>
            ) : (
              <span className="capitalize">{task.status}</span>
            )}
            {!isReminder && task.dueDate && <span>{formatDate(task.dueDate)}</span>}
            {subtaskCount > 0 && <span>{doneCount}/{subtaskCount}</span>}
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
const SortableTaskItem = ({ id, task, onClick, onOpenModal, onToggleStatus }) => {
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
      <TaskCard
        task={task}
        onClick={onClick}
        onOpenModal={onOpenModal}
        onToggleStatus={onToggleStatus}
        listeners={listeners}
        attributes={attributes}
      />
    </div>
  );
};

// ─── Folder Modal ──────────────────────────────────────────────────
const FolderModal = ({ isOpen, onClose, folders, onSave, onDelete, isLoading }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

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

  const handleDelete = (folderId) => {
    setShowDeleteConfirm(folderId);
  };

  const confirmDelete = () => {
    onDelete(showDeleteConfirm);
    setShowDeleteConfirm(null);
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
            <div key={folder._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                <span className="text-gray-800 dark:text-white font-medium">{folder.name}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(folder)} className="text-gray-400 hover:text-teal-500 transition">
                  <FaEdit />
                </button>
                <button onClick={() => handleDelete(folder._id)} className="text-gray-400 hover:text-red-500 transition">
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
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={confirmDelete}
          title="Delete Folder"
          message="All tasks in this folder will be unlinked. Are you sure?"
          danger
        />
      </div>
    </BottomSheet>
  );
};

// ─── Task Form ──────────────────────────────────────────────────────
// Layout order: Title → Description → "Set as Reminder" (checkbox, right
// after description, always visible) → optional details (Priority, Folder,
// Due Date, Notify time) which are disabled while "Set as Reminder" is on,
// since a recurring reminder doesn't use those fields the way a one-off
// task does.
const TaskForm = ({ task, folders, onSave, onCancel, isEditing, isLoading, presetReminder = false }) => {
  const taskIsReminder = isReminderTask(task);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  const [dailyReminderTime, setDailyReminderTime] = useState(task?.dailyReminderTime || '');
  const [folderId, setFolderId] = useState(task?.folder?._id || task?.folder || '');

  // "Set as Reminder" state: a checkbox plus a frequency choice, replacing
  // the old bare "Recurrence" dropdown.
  const [isReminder, setIsReminder] = useState(task ? taskIsReminder : presetReminder);
  const [frequency, setFrequency] = useState(taskIsReminder ? task.recurrenceType : 'daily');
  const [recurrenceDays, setRecurrenceDays] = useState(task?.recurrenceDays || []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task?.recurrenceEndDate ? new Date(task.recurrenceEndDate).toISOString().slice(0, 16) : ''
  );

  const [showDetails, setShowDetails] = useState(isEditing);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const disabledFieldClass = isReminder ? 'opacity-50 cursor-not-allowed' : '';

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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white placeholder-gray-400"
        />
      </div>

      {/* ─── Set as Reminder ─────────────────────────────────────── */}
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
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isReminder}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white ${disabledFieldClass}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={isReminder}
                className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-gray-800 dark:text-white ${disabledFieldClass}`}
              >
                <option value="">No Folder</option>
                {folders.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isReminder}
              className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none ${disabledFieldClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Notify Time (HH:MM)</label>
            <input
              type="time"
              value={dailyReminderTime}
              onChange={(e) => setDailyReminderTime(e.target.value)}
              disabled={isReminder}
              className={`w-full px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none ${disabledFieldClass}`}
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

// ─── Main Component ──────────────────────────────────────────────
const PersonalTasks = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({ folderId: '', status: '', priority: '', archived: false });
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionTask, setActionTask] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  // Top-level view: 'tasks' (one-off Personal Tasks) or 'reminders' (recurring)
  const [viewMode, setViewMode] = useState('tasks');

  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useGetPersonalTasksQuery({
    folderId: filters.folderId || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    archived: filters.archived ? 'true' : undefined,
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

  // Sync with fetched data, applying stored task order. Subtask order is
  // NOT re-applied here — the backend persists it (reorderPersonalSubTasks),
  // and mutating objects from the RTK Query cache directly throws in dev
  // (cache results are frozen) while also stomping the server's correct
  // order with a stale local mapping.
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
    setLocalTasks(prev => prev.map(t => t._id === taskId ? { ...t, isArchived: false } : t));
    try {
      await restoreTask(taskId).unwrap();
      toast.success('Restored');
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to restore');
    }
  };

  const handleDelete = (taskId) => {
    setDeleteConfirmId(taskId);
  };

  const confirmDeleteTask = async () => {
    const taskId = deleteConfirmId;
    const prevTasks = [...localTasks];
    setLocalTasks(prev => prev.filter(t => t._id !== taskId));
    delete orderMap.current[taskId];
    try {
      await deleteTask(taskId).unwrap();
      toast.success('Moved to trash');
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      setDeleteConfirmId(null);
      refetchTasks();
    } catch (err) {
      setLocalTasks(prevTasks);
      toast.error(err?.data?.message || 'Failed to delete');
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

  // Left-circle tap on the task list — toggles completed/pending directly.
  // Reminders never reach this: TaskCard shows a static bell for them
  // instead of a tappable circle.
  const handleCardStatusToggle = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    handleStatusToggle(task._id, newStatus);
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

  // Builds a brand new subtask object instead of mutating the existing one —
  // subtask objects inside RTK Query's cached array are frozen in dev, so
  // `subtasks[i].done = done` throws "Cannot assign to read only property".
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

  // Optimistic update shows the new order immediately; the backend persists
  // the real order; the subsequent refetch (from cache tag invalidation)
  // brings back that same correct order — nothing else needs to be
  // remembered locally.
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

  const handleTaskClick = (task) => setSelectedTaskId(task._id);
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

  const selectedTask = useMemo(() => localTasks.find(t => t._id === selectedTaskId), [localTasks, selectedTaskId]);

  // ─── Filtering & sorting ──────────────────────────────────────

  const displayedTasks = useMemo(() => {
    let filtered = localTasks.filter(task => {
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

  // ─── Reorder tasks (drag & drop) ─────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Resolves both drag indices against the SAME array (localTasks) by
  // matching _id, rather than mixing an index from `displayedTasks` (the
  // filtered/sorted view) with a splice into `localTasks` (the raw list) —
  // those two arrays don't line up 1:1 whenever a folder/archived/view
  // filter is active, which silently reordered the wrong tasks. Also
  // guards against `over` being null (dropped outside any droppable zone).
  const handleTaskDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalTasks(prev => {
      const oldIndex = prev.findIndex(t => t._id === active.id);
      const newIndex = prev.findIndex(t => t._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(prev, oldIndex, newIndex);
      reordered.forEach((t, i) => {
        orderMap.current[t._id] = i;
      });
      return reordered;
    });
  };

  // ─── Tabs ──────────────────────────────────────────────────────

  const handleTabClick = (folderId) => setFilters(prev => ({ ...prev, folderId, archived: false }));
  const handleArchivedTabClick = () => setFilters(prev => ({ ...prev, archived: true, folderId: '' }));
  const handleAllTabClick = () => setFilters(prev => ({ ...prev, folderId: '', archived: false }));

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
            <>
              <header className="bg-white dark:bg-[#0f0f12] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
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
                  </div>
                </div>

                {/* View mode: Personal Tasks vs Reminders */}
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
                      !filters.archived && !filters.folderId
                        ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    All
                  </div>
                  {folders.map((folder) => (
                    <div
                      key={folder._id}
                      onClick={() => handleTabClick(folder._id)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                        filters.folderId === folder._id && !filters.archived
                          ? 'bg-gray-100 dark:bg-[#2a2a2a] text-teal-600 dark:text-teal-400 border-b-2 border-teal-500'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color || '#4f46e5' }} />
                      {folder.name}
                    </div>
                  ))}
                  <button
                    onClick={() => setShowFolderModal(true)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-teal-500 transition rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                  >
                    <FaPlus className="text-xs" />
                  </button>
                  <div
                    onClick={handleArchivedTabClick}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer transition ${
                      filters.archived
                        ? 'bg-gray-100 dark:bg-[#2a2a2a] text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    <FaArchive className="inline mr-1 text-[10px]" /> Archived
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto">
                {displayedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
                    {viewMode === 'reminders' ? (
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
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
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
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </main>

              <GeneralBottombar />
            </>
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
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="This task will be moved to trash. It will be permanently deleted after 30 days."
        danger
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
      />

      {!selectedTask && (
        <button
          onClick={() => { setEditingTask(null); setShowCreateModal(true); }}
          className="fixed right-4 sm:right-6 bottom-20 md:bottom-6 z-20 w-12 h-12 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 transition active:scale-95"
        >
          <FaPlus className="text-xl" />
        </button>
      )}
    </>
  );
};

export default PersonalTasks;