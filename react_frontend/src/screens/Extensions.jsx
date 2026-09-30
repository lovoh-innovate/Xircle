// pages/Extensions.jsx
//
// Where users turn optional features on/off for their account.
//
//   • AI     — proofread, expand, rewrite, highlight-to-search
//   • Bible  — Bible picker + scripture lookups
//   • Quran  — Quran scripture lookups
//
// Persists to the same updateProfile endpoint as the profile page.
// The response is written into the auth store so the rest of the app
// (WriteNote, header buttons, etc.) sees the new flags immediately.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaMagic, FaBookOpen, FaMoon, FaCheck, FaAngleDown,
} from 'react-icons/fa';

import { setCredentials } from '../slices/authSlice';
import { useUpdateProfileMutation } from '../slices/userApiSlice';

// ─── FEATURE DEFINITIONS ─────────────────────────────────────────────
const EXTENSIONS = [
  {
    key: 'isAiEnabled',
    label: 'AI tools',
    icon: FaMagic,
    accent: 'teal',
    tagline: 'Writing assistant inside your notes',
    bullets: [
      'Proofread — spelling, punctuation, grammar',
      'Expand — add explanation, depth, examples',
      'Rewrite — restructure and reformat the whole note',
      'Highlight any text and ask AI for context',
    ],
  },
  {
    key: 'isBibleEnabled',
    label: 'Bible',
    icon: FaBookOpen,
    accent: 'amber',
    tagline: 'Look up Bible passages',
    bullets: [
      'Pick a book, chapter, and verse manually',
      'Highlight a reference like “John 3:16” to open it',
      'See more verses or expand to the full chapter',
    ],
  },
  {
    key: 'isQuranEnabled',
    label: 'Quran',
    icon: FaMoon,
    accent: 'emerald',
    tagline: 'Look up Quran ayahs',
    bullets: [
      'Highlight a reference like “2:255” to open it',
      'See more ayahs or expand to the full surah',
      'Translated editions supported',
    ],
  },
];

// ─── ACCENT TOKENS ────────────────────────────────────────────────────
const ACCENTS = {
  teal: {
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    icon: 'text-teal-600 dark:text-teal-400',
    toggleOn: 'bg-teal-600 dark:bg-teal-500',
    check: 'text-teal-500',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    icon: 'text-amber-600 dark:text-amber-400',
    toggleOn: 'bg-amber-600 dark:bg-amber-500',
    check: 'text-amber-500',
  },
  emerald: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    toggleOn: 'bg-emerald-600 dark:bg-emerald-500',
    check: 'text-emerald-500',
  },
};

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled, onColor }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex flex-shrink-0 h-6 w-11 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? onColor : 'bg-gray-300 dark:bg-gray-700'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// ─── EXTENSION CARD ───────────────────────────────────────────────────
const ExtensionCard = ({ feature, enabled, busy, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = feature.icon;
  const a = ACCENTS[feature.accent];

  return (
    <div className="bg-white dark:bg-[#14141a] border border-gray-200 dark:border-gray-800/60 rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.iconBg}`}
        >
          <Icon className={`text-base ${a.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {feature.label}
            </h3>
            {busy && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                Saving…
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {feature.tagline}
          </p>
        </div>

        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={busy}
          onColor={a.toggleOn}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-gray-100 dark:border-gray-800/40 text-[11px] font-medium text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition"
      >
        <span>{expanded ? 'Hide details' : "What's included"}</span>
        <FaAngleDown
          className={`text-[9px] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <ul className="px-4 pb-4 pt-1 space-y-1.5 bg-gray-50/60 dark:bg-[#0f0f12]/40">
          {feature.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
            >
              <FaCheck className={`${a.check} text-[9px] mt-1 flex-shrink-0`} />
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────
const Extensions = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.userInfo);

  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [pendingKey, setPendingKey] = useState(null);

  const [local, setLocal] = useState({
    isAiEnabled: Boolean(user?.isAiEnabled),
    isBibleEnabled: Boolean(user?.isBibleEnabled),
    isQuranEnabled: Boolean(user?.isQuranEnabled),
  });

  useEffect(() => {
    setLocal({
      isAiEnabled: Boolean(user?.isAiEnabled),
      isBibleEnabled: Boolean(user?.isBibleEnabled),
      isQuranEnabled: Boolean(user?.isQuranEnabled),
    });
  }, [user?.isAiEnabled, user?.isBibleEnabled, user?.isQuranEnabled]);

  const handleToggle = async (key, value) => {
    const previous = local[key];
    setLocal((s) => ({ ...s, [key]: value }));
    setPendingKey(key);

    try {
      const fd = new FormData();
      fd.append(key, String(value));

      const updated = await updateProfile(fd).unwrap();

      if (user) {
        dispatch(setCredentials({ ...user, ...updated }));
      }

      toast.success(
        `${value ? 'Enabled' : 'Disabled'} ${
          EXTENSIONS.find((e) => e.key === key)?.label || 'feature'
        }`
      );
    } catch (err) {
      setLocal((s) => ({ ...s, [key]: previous }));
      toast.error(err?.data?.message || 'Could not save. Please try again.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0f0f12]">
      {/* ─── Slim top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/85 dark:bg-[#0f0f12]/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/40">
        <div className="max-w-3xl mx-auto flex items-center gap-2 h-12 px-3 sm:px-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition flex-shrink-0"
            title="Go back"
            aria-label="Go back"
          >
            <FaArrowLeft className="text-sm" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            Extensions
          </h1>
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          Turn optional features on or off. Nothing is on unless you enable it.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXTENSIONS.map((feature) => (
            <ExtensionCard
              key={feature.key}
              feature={feature}
              enabled={local[feature.key]}
              busy={pendingKey === feature.key && isLoading}
              onToggle={(value) => handleToggle(feature.key, value)}
            />
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-6 text-center">
          Your choices are saved to your account and apply on every device you sign in to.
        </p>
      </div>
    </div>
  );
};

export default Extensions;