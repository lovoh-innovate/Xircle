// src/components/SlashMentionPicker.jsx
import React from 'react';
import {
  FaTasks,
  FaFolderOpen,
  FaStickyNote,
  FaClock,
  FaSpinner,
  FaExclamationCircle,
} from 'react-icons/fa';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'task', label: 'Tasks' },
  { id: 'project', label: 'Projects' },
  { id: 'note', label: 'Notes' },
  { id: 'clockin', label: 'Clock-ins' },
];

const ENTITY_ICON = {
  task: FaTasks,
  project: FaFolderOpen,
  note: FaStickyNote,
  clockin: FaClock,
};

const ENTITY_ACCENT = {
  task: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30',
  project: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
  note: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
  clockin: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
};

const ENTITY_LABEL = {
  task: 'Tasks',
  project: 'Projects',
  note: 'Notes',
  clockin: 'Clock-ins',
};

// ─────────────────────────────────────────────────────────────────────
// EntityRow — one result. Uses onMouseDown preventDefault so clicking
// doesn't blur the textarea before we get a chance to insert the ref.
// ─────────────────────────────────────────────────────────────────────
const EntityRow = ({ entity, onPick }) => {
  const Icon = ENTITY_ICON[entity.type] || FaTasks;
  const accent = ENTITY_ACCENT[entity.type] || ENTITY_ACCENT.task;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(entity)}
      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#1e1e26] transition flex items-start gap-2.5"
    >
      <span
        className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${accent}`}
      >
        <Icon className="text-xs" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
          {entity.label}
        </p>
        {entity.sublabel && (
          <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
            {entity.sublabel}
          </p>
        )}
      </div>

      {entity.status && (
        <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 flex-shrink-0 mt-1">
          {entity.status}
        </span>
      )}
    </button>
  );
};

const SlashMentionPicker = ({
  open,
  results,
  query,
  activeTab,
  setActiveTab,
  isFetching,
  onPick,
}) => {
  if (!open) return null;

  const {
    tasks = [],
    projects = [],
    notes = [],
    clockins = [],
  } = results || {};

  const grouped = { task: tasks, project: projects, note: notes, clockin: clockins };

  // What to display based on the active tab
  const visible = [];
  if (activeTab === 'all' || activeTab === 'task') visible.push(...tasks);
  if (activeTab === 'all' || activeTab === 'project') visible.push(...projects);
  if (activeTab === 'all' || activeTab === 'note') visible.push(...notes);
  if (activeTab === 'all' || activeTab === 'clockin') visible.push(...clockins);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40">
      <div className="bg-white dark:bg-[#1e1e26] border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-2xl overflow-hidden max-h-[340px] flex flex-col">
        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-2 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-800/60 overflow-x-auto scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-md transition ${
                activeTab === t.id
                  ? 'bg-teal-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Hint line ──────────────────────────────────────── */}
        <div className="px-3 pt-2 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600">
          {query ? `Searching "${query}"` : 'Pick something to tag'}
        </div>

        {/* ── List ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-1">
          {isFetching && visible.length === 0 ? (
            <div className="py-6 flex items-center justify-center">
              <FaSpinner className="animate-spin text-teal-500 text-sm" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <FaExclamationCircle className="text-xl mb-1.5 opacity-50" />
              <p className="text-xs">Nothing found</p>
            </div>
          ) : activeTab === 'all' ? (
            // Grouped view when the "All" tab is active
            <>
              {Object.entries(grouped).map(([type, list]) => {
                if (list.length === 0) return null;
                return (
                  <div key={type} className="pb-1">
                    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                      {ENTITY_LABEL[type]}
                    </p>
                    {list.map((e) => (
                      <EntityRow
                        key={`${e.type}-${e._id}`}
                        entity={e}
                        onPick={onPick}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          ) : (
            // Flat view when a specific tab is active
            visible.map((e) => (
              <EntityRow
                key={`${e.type}-${e._id}`}
                entity={e}
                onPick={onPick}
              />
            ))
          )}
        </div>

        {/* ── Footer hint ────────────────────────────────────── */}
        <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800/60 text-[10px] text-gray-400 dark:text-gray-600 flex items-center justify-between">
          <span>Tap to add · Esc to close</span>
          <span>
            {visible.length} result{visible.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SlashMentionPicker;