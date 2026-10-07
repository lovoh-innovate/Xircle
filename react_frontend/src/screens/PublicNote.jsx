// pages/PublicNote.jsx
//
// Read-only viewer for a shared note. Rendered at /share/:link (no auth).
//
// Uses the `getNoteByShareLink` query, which hits
// GET /api/personal-notes/share/:link on the server. The server only
// returns the note if `isPublic === true` and the shareLink matches, so
// private notes can never be opened through this route.
//
// Auto-refresh: the query polls every 15 s, refetches when the tab
// regains focus, and refetches on mount. So when the owner edits and
// saves the note, an open viewer picks up the change without a manual
// reload.
//
// Layout: full-bleed on every screen size. No back button — this is a
// standalone share page. On mount, scrolls to top so the reader always
// starts at the beginning of the note.
//
// ── Changes vs previous version ─────────────────────────────────────
// 1. Sanitizes note.content with DOMPurify before dangerouslySetInnerHTML
//    (prevents stored-XSS via note editor).
// 2. Sets document <title>/<meta> for the note via useDocumentMeta —
//    browser tabs and JS-capable share clients now see the real title.
//    Pairs with the server-side /share/:link OG handler (crawlers only).
// 3. Respects the device safe-area on mobile (notches, home indicator).
// 4. Adds a scroll-to-top button that appears after 600 px of scroll.
// 5. Small copy/visual polish in the error + loading states.
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useGetNoteByShareLinkQuery } from '../slices/personalNoteApiSlice';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  FaFileAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaPaperclip,
  FaExternalLinkAlt,
  FaClock,
  FaArrowUp,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

// How often to poll the server for changes to a shared note.
const POLL_INTERVAL_MS = 15_000;

const PublicNote = () => {
  const { link } = useParams();

  const {
    data,
    isLoading,
    isError,
    error,
  } = useGetNoteByShareLinkQuery(link, {
    skip: !link,
    // Poll the server so an open viewer auto-updates when the owner saves.
    pollingInterval: POLL_INTERVAL_MS,
    // Refetch when the tab regains focus (e.g. user switches back).
    refetchOnFocus: true,
    // Refetch when the component remounts.
    refetchOnMountOrArgChange: true,
    // Refetch when the network reconnects.
    refetchOnReconnect: true,
  });

  // ── Document meta (title, description, image) ───────────────────
  // Runs for real browsers; crawlers get their tags from the server-side
  // /share/:link OG handler instead. Together they cover both audiences.
  const note = data?.note;
  useDocumentMeta({
    title: note?.title ? `${note.title} — Xircle` : undefined,
    description: note?.content
      ? DOMPurify.sanitize(note.content, { ALLOWED_TAGS: [] }).slice(0, 200)
      : undefined,
    image:
      note?.attachments?.find((a) =>
        /\.(jpe?g|png|gif|webp)$/i.test(a.path || '')
      )?.path || undefined,
    url:
      typeof window !== 'undefined' ? window.location.href : undefined,
  });

  // ── Sanitize HTML once per note change ──────────────────────────
  // This is the actual XSS gate. The editor stores raw HTML, so any
  // `<img src=x onerror=…>` that makes it into a note would otherwise
  // run in every reader's browser the moment it renders.
  const safeContent = useMemo(() => {
    if (!note?.content) return '';
    return DOMPurify.sanitize(note.content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    });
  }, [note?.content]);

  // Force scroll to the very top the instant this page mounts.
  // useLayoutEffect runs before paint, so there's no visible jump.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Belt-and-braces: also nudge scroll to top after the first load.
  // We only do this ONCE (on the initial load), not on every poll, so
  // an auto-refresh doesn't yank the reader back to the top while they
  // are mid-scroll reading the note.
  const hasLoadedOnceRef = React.useRef(false);
  useEffect(() => {
    if (!isLoading && !hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [isLoading]);

  // ── Scroll-to-top button visibility ─────────────────────────────
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Loading (first time only) ─────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-dvh bg-white dark:bg-[#0f0f12] flex items-center justify-center"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <FaSpinner className="animate-spin text-teal-500 text-3xl" />
      </div>
    );
  }

  // ── Error / not found ─────────────────────────────────────────
  if (isError || !data?.note) {
    const message =
      error?.data?.message ||
      'This note is not available. It may have been made private or deleted.';
    return (
      <div
        className="min-h-dvh bg-white dark:bg-[#0f0f12] flex flex-col items-center justify-center p-6 text-center"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 1.5rem)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)',
        }}
      >
        <div className="w-16 h-16 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <FaExclamationTriangle className="text-red-500 text-2xl" />
        </div>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          Note unavailable
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {message}
        </p>
      </div>
    );
  }

  const authorName = note.user?.name || 'Unknown';
  const updated = note.updatedAt
    ? formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
    : null;

  return (
    <div className="min-h-dvh bg-white dark:bg-[#0f0f12] w-full">
      {/* ── Body — full-bleed on every screen size ────────────── */}
      <main
        className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-8"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        {/* Title + meta */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight break-words">
            {note.title || 'Untitled Note'}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">
                {authorName.charAt(0).toUpperCase()}
              </span>
              {authorName}
            </span>
            {updated && (
              <span className="flex items-center gap-1">
                <FaClock className="text-[10px]" />
                Updated {updated}
              </span>
            )}
          </div>
        </div>

        {/* Content — sanitized HTML */}
        <article className="bg-white dark:bg-[#1a1a1a] rounded-md border border-gray-200/60 dark:border-gray-800/60 p-4 sm:p-6 lg:p-8">
          {safeContent ? (
            <div
              className={
                'prose prose-sm sm:prose-base max-w-none dark:prose-invert ' +
                '[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold ' +
                '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 ' +
                '[&_p]:my-2 [&_a]:text-teal-600 [&_a]:underline ' +
                '[&_strong]:font-semibold [&_em]:italic [&_u]:underline ' +
                '[&_img]:rounded-md [&_img]:max-w-full ' +
                '[&_table]:border-collapse [&_table]:w-full [&_table]:my-3 ' +
                '[&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:p-2 ' +
                '[&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:p-2'
              }
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />
          ) : (
            <p className="text-sm italic text-gray-400 dark:text-gray-500">
              This note is empty.
            </p>
          )}
        </article>

        {/* Attachments */}
        {note.attachments?.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-3 flex items-center gap-2">
              <FaPaperclip className="text-[10px]" /> Attachments (
              {note.attachments.length})
            </h2>
            <div className="space-y-2">
              {note.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white dark:bg-[#1a1a1a] border border-gray-200/60 dark:border-gray-800/60 rounded-md hover:border-teal-400 dark:hover:border-teal-500/60 transition group"
                >
                  <div className="w-9 h-9 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <FaPaperclip className="text-gray-500 text-xs" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {att.filename || 'File'}
                    </p>
                    {att.size ? (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    ) : null}
                  </div>
                  <FaExternalLinkAlt className="text-gray-400 text-xs group-hover:text-teal-500 transition flex-shrink-0" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <p
          className="mt-10 text-center text-[11px] text-gray-400 dark:text-gray-600"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          Shared via Xircle
        </p>
      </main>

      {/* ── Scroll-to-top ─────────────────────────────────────── */}
      {showTop && (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          aria-label="Scroll to top"
          className="fixed right-4 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:-translate-y-0.5 hover:text-teal-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:text-teal-400"
          style={{
            bottom: 'max(env(safe-area-inset-bottom), 1rem)',
          }}
        >
          <FaArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default PublicNote;