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
// EDIT == VIEW PARITY:
//   Uses the exact same NOTE_RICH_CSS as WriteNote.jsx so a note renders
//   identically inside the editor, in this public viewer, and in the PDF
//   exporter. Tables and callouts share the same CSS helpers.
//
// RESPONSIVE CARD:
//   On mobile the note body is full-bleed (no card, tiny padding).
//   From sm: up it sits in a bordered, rounded card — matching the
//   original desktop look.
//
// PDF EXPORT:
//   Same helpers as WriteNote's handleExportPDF (generatePdfFromNote +
//   PDF_SCOPED_CSS) so a downloaded PDF looks the same regardless of
//   which page triggered the export. Dynamic import keeps html2canvas
//   and jsPDF out of the initial bundle for readers who don't export.
//
// SECURITY:
//   Content is sanitized with DOMPurify before injection. `style` is
//   allowed so inline text colors, font sizes, backgrounds, highlights,
//   table CSS vars, and callout CSS vars all survive — but scripts,
//   event handlers, and iframes are stripped.
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useGetNoteByShareLinkQuery } from '../slices/personalNoteApiSlice';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  FaSpinner,
  FaExclamationTriangle,
  FaPaperclip,
  FaExternalLinkAlt,
  FaClock,
  FaArrowUp,
  FaFilePdf,
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

// How often to poll the server for changes to a shared note.
const POLL_INTERVAL_MS = 15_000;

// Matches image extensions we'll treat as OG candidates.
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;

// ─── SHARED TABLE CSS (copied verbatim from WriteNote.jsx) ─────────
const buildTableCss = (S, { dark = true } = {}) => `
${S} {
  --tb-def-border: #d1d5db;
  --tb-def-head-bg: #f3f4f6;
  --tb-def-head-color: #111827;
  --tb-def-stripe: rgba(0, 0, 0, 0.04);
}
${
  dark
    ? `.dark ${S} {
  --tb-def-border: #3f3f46;
  --tb-def-head-bg: #27272a;
  --tb-def-head-color: #f4f4f5;
  --tb-def-stripe: rgba(255, 255, 255, 0.05);
}`
    : ''
}
${S} .tableWrapper { overflow-x: auto; }
${S} table {
  border-collapse: collapse;
  table-layout: fixed;
  max-width: 100%;
  margin: 12px 0;
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  color: var(--tb-color, inherit);
}
${S} table[data-align="left"] { margin-left: 0; margin-right: auto; }
${S} table[data-align="center"] { margin-left: auto; margin-right: auto; }
${S} table[data-align="right"] { margin-left: auto; margin-right: 0; }
${S} td,
${S} th {
  border: var(--tb-bw, 1px) var(--tb-bs, solid) var(--tb-border, var(--tb-def-border));
  padding: 8px 10px;
  vertical-align: top;
  text-align: left;
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  overflow-wrap: anywhere;
  background-color: var(--tb-bg, transparent);
  color: var(--tb-color, inherit);
}
${S} th {
  background-color: var(--tb-head-bg, var(--tb-def-head-bg));
  color: var(--tb-head-color, var(--tb-def-head-color));
  font-weight: 600;
}
${S} table[data-density="compact"] td,
${S} table[data-density="compact"] th { padding: 4px 6px; }
${S} table[data-density="roomy"] td,
${S} table[data-density="roomy"] th { padding: 14px 16px; }
${S} table[data-striped="true"] tbody tr:nth-child(even) td {
  background-image: linear-gradient(
    var(--tb-stripe, var(--tb-def-stripe)),
    var(--tb-stripe, var(--tb-def-stripe))
  );
}
${S} td p,
${S} th p { margin: 4px 0; }
${S} td > :first-child,
${S} th > :first-child { margin-top: 0; }
${S} td > :last-child,
${S} th > :last-child { margin-bottom: 0; }
${S} td ul, ${S} td ol, ${S} th ul, ${S} th ol { margin: 2px 0; }
`;

// ─── SHARED CALLOUT CSS (copied verbatim from WriteNote.jsx) ───────
const buildCalloutCss = (S, { dark = true } = {}) => `
${S} {
  --callout-def-bg: #f0fdfa;
  --callout-def-border: #14b8a6;
  --callout-def-text: #0f172a;
}
${
  dark
    ? `.dark ${S} {
  --callout-def-bg: #042f2e;
  --callout-def-border: #14b8a6;
  --callout-def-text: #d1faf5;
}`
    : ''
}
${S} [data-callout] {
  position: relative;
  margin: 14px 0;
  padding: 12px 16px 12px 48px;
  border-radius: 8px;
  background-color: var(--callout-bg, var(--callout-def-bg));
  border-left: 4px solid var(--callout-border, var(--callout-def-border));
  color: var(--callout-color, var(--callout-def-text));
}
${S} [data-callout]::before {
  content: attr(data-icon);
  position: absolute;
  left: 14px;
  top: 12px;
  font-size: 18px;
  line-height: 1.2;
  pointer-events: none;
  user-select: none;
}
${S} [data-callout] > :first-child { margin-top: 0; }
${S} [data-callout] > :last-child { margin-bottom: 0; }
${S} [data-callout] p { margin: 0.35rem 0; }
${S} [data-callout] p:first-child { margin-top: 0; }
${S} [data-callout] p:last-child { margin-bottom: 0; }
`;

// ─── SHARED NOTE CONTENT CSS — identical to WriteNote's NOTE_RICH_CSS.
const NOTE_RICH_CSS = `
.note-rich { line-height: 1.6; }

.note-rich .note-content {
  outline: none;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  line-height: 1.6;
  color: inherit;
}

.note-rich .note-content p {
  margin: 0.5rem 0;
  line-height: 1.6;
}
.note-rich .note-content > p:first-child { margin-top: 0; }
.note-rich .note-content > p:last-child  { margin-bottom: 0; }
.note-rich .note-content p:empty::after {
  content: '\\200B';
  display: inline;
}

.note-rich .note-content ul,
.note-rich .note-content ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}
.note-rich .note-content ul { list-style: disc; }
.note-rich .note-content ol { list-style: decimal; }
.note-rich .note-content li {
  margin: 0.125rem 0;
  line-height: 1.6;
}
.note-rich .note-content li > p,
.note-rich .note-content li > p:first-child,
.note-rich .note-content li > p:last-child {
  margin: 0;
}

.note-rich .note-content h1 {
  font-size: 1.875rem; font-weight: 700; line-height: 1.3;
  margin: 1.25rem 0 0.5rem;
}
.note-rich .note-content h2 {
  font-size: 1.5rem; font-weight: 700; line-height: 1.3;
  margin: 1rem 0 0.5rem;
}
.note-rich .note-content h3 {
  font-size: 1.25rem; font-weight: 600; line-height: 1.3;
  margin: 0.875rem 0 0.5rem;
}
.note-rich .note-content h1:first-child,
.note-rich .note-content h2:first-child,
.note-rich .note-content h3:first-child { margin-top: 0; }

.note-rich .note-content a {
  color: #0d9488;
  text-decoration: underline;
}
.note-rich .note-content img {
  max-width: 100%;
  border-radius: 0.5rem;
}
` + buildTableCss('.note-rich') + buildCalloutCss('.note-rich');

// ─── PDF EXPORT (same helpers as WriteNote.jsx) ────────────────────
const PDF_SCOPED_CSS =
  `
  [data-pdf-root] { background: #ffffff; color: #111827; }
  [data-pdf-root] h1 { font-size: 18pt; font-weight: 700; line-height: 1.3; margin: 14pt 0 6pt 0; }
  [data-pdf-root] h2 { font-size: 15pt; font-weight: 700; line-height: 1.3; margin: 12pt 0 6pt 0; }
  [data-pdf-root] h3 { font-size: 13pt; font-weight: 600; line-height: 1.3; margin: 10pt 0 5pt 0; }
  [data-pdf-root] p { margin: 6pt 0; }
  [data-pdf-root] ul { list-style: disc outside; padding-left: 20pt; margin: 6pt 0; }
  [data-pdf-root] ol { list-style: decimal outside; padding-left: 20pt; margin: 6pt 0; }
  [data-pdf-root] li { margin: 2pt 0; }
  [data-pdf-root] li > p { margin: 0; }
  [data-pdf-root] a { color: #0d9488; text-decoration: underline; }
  [data-pdf-root] strong, [data-pdf-root] b { font-weight: 700; }
  [data-pdf-root] em, [data-pdf-root] i { font-style: italic; }
  [data-pdf-root] u { text-decoration: underline; }
  [data-pdf-root] s, [data-pdf-root] del { text-decoration: line-through; }
  [data-pdf-root] sub { vertical-align: sub; font-size: 75%; line-height: 0; }
  [data-pdf-root] sup { vertical-align: super; font-size: 75%; line-height: 0; }
  [data-pdf-root] img { max-width: 100%; height: auto; display: block; margin: 8pt auto; }
` +
  buildTableCss('[data-pdf-root]', { dark: false }) +
  buildCalloutCss('[data-pdf-root]', { dark: false });

const generatePdfFromNote = async (title, contentHtml) => {
  const [html2canvasMod, jspdfMod] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const html2canvas = html2canvasMod.default || html2canvasMod;
  const JsPDF = jspdfMod.jsPDF || jspdfMod.default;

  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-pdf-style', 'true');
  styleEl.textContent = PDF_SCOPED_CSS;
  document.head.appendChild(styleEl);

  const container = document.createElement('div');
  container.setAttribute('data-pdf-root', 'true');
  Object.assign(container.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: '190mm', padding: '0', boxSizing: 'border-box',
    background: '#ffffff', color: '#111827',
    fontFamily: 'Georgia, "Times New Roman", "Iowan Old Style", serif',
    fontSize: '11pt', lineHeight: '1.6',
  });

  const titleEl = document.createElement('h1');
  titleEl.textContent = title || 'Untitled Note';
  Object.assign(titleEl.style, {
    fontSize: '22pt', fontWeight: '700', margin: '0 0 6pt 0',
    textAlign: 'center', color: '#111827',
  });
  container.appendChild(titleEl);

  const meta = document.createElement('p');
  meta.textContent = `Exported from Xircle · ${new Date().toLocaleString()}`;
  Object.assign(meta.style, {
    fontSize: '9pt', color: '#6b7280',
    textAlign: 'center', margin: '0 0 18pt 0',
  });
  container.appendChild(meta);

  const body = document.createElement('div');
  body.innerHTML = contentHtml || '';
  container.appendChild(body);

  document.body.appendChild(container);

  try {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => new Promise((resolve) => {
      if (img.complete) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
    })));

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });

    const PAGE_W_MM = 210, PAGE_H_MM = 297;
    const MARGIN_TOP = 12, MARGIN_BOTTOM = 14, MARGIN_SIDE = 10;
    const contentW = PAGE_W_MM - MARGIN_SIDE * 2;
    const contentH = PAGE_H_MM - MARGIN_TOP - MARGIN_BOTTOM;
    const pxPerMm = canvas.width / contentW;
    const pageHeightPx = Math.floor(contentH * pxPerMm);

    const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let offsetY = 0, pageIndex = 0;
    while (offsetY < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', MARGIN_SIDE, MARGIN_TOP, contentW, sliceH / pxPerMm);

      offsetY += sliceH;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    if (container.parentNode) document.body.removeChild(container);
    if (styleEl.parentNode) document.head.removeChild(styleEl);
  }
};

const PublicNote = () => {
  const { link } = useParams();

  const { data, isLoading, isError, error } = useGetNoteByShareLinkQuery(link, {
    skip: !link,
    pollingInterval: POLL_INTERVAL_MS,
    refetchOnFocus: true,
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: true,
  });

  const note = data?.note;

  // ── Sanitize note HTML once per content change ──────────────────
  const safeContent = useMemo(() => {
    if (!note?.content) return '';
    return DOMPurify.sanitize(note.content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['style', 'target', 'rel'],
    });
  }, [note?.content]);

  // ── Plain-text description for meta tags ────────────────────────
  const noteDescription = useMemo(() => {
    if (!note?.content) return undefined;
    const text = DOMPurify.sanitize(note.content, { ALLOWED_TAGS: [] })
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.slice(0, 200) : undefined;
  }, [note?.content]);

  const noteImage = useMemo(() => {
    if (!note?.attachments?.length) return undefined;
    return note.attachments.find((a) => IMAGE_EXT_RE.test(a.path || ''))?.path;
  }, [note?.attachments]);

  // ── Document meta ──────────────────────────────────────────────
  useDocumentMeta({
    title: note?.title ? `${note.title} — Xircle` : undefined,
    description: noteDescription,
    image: noteImage,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  // Force scroll to the very top on mount.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Belt-and-braces scroll-to-top after first load only (not on poll).
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

  // ── PDF export ─────────────────────────────────────────────────
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const handleExportPDF = async () => {
    if (!note || pdfBusy) return;
    setPdfError('');
    setPdfBusy(true);
    try {
      const blob = await generatePdfFromNote(
        note.title || 'Untitled Note',
        safeContent
      );
      if (!blob) throw new Error('PDF generation returned no data');

      const safeName =
        (note.title || 'Untitled')
          .replace(/[^a-z0-9\-_. ]/gi, '_')
          .trim()
          .slice(0, 80) || 'Note';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
      setPdfError('Could not generate PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────
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

  // ── Error / not found ───────────────────────────────────────────
  if (isError || !note) {
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
      {/* Shared CSS — same strings as WriteNote.jsx for exact view parity. */}
      <style>{NOTE_RICH_CSS}</style>

      <main
        className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-8"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        {/* Title + meta row (author, updated, PDF button) */}
        <div className="mb-3 sm:mb-6">
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

            {/* PDF download */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={pdfBusy || !safeContent}
              title="Download as PDF"
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-500/60 dark:hover:text-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfBusy ? (
                <FaSpinner className="animate-spin text-[10px]" />
              ) : (
                <FaFilePdf className="text-[10px]" />
              )}
              {pdfBusy ? 'Generating…' : 'PDF'}
            </button>
          </div>

          {pdfError && (
            <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">
              {pdfError}
            </p>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────
            Mobile: full-bleed, tiny padding (no card).
            ≥ sm: bordered, rounded card — matches the original
            desktop look.
            Inside either way: exact same .note-rich > .note-content
            structure + NOTE_RICH_CSS as WriteNote's view mode. */}
        <article className="bg-transparent dark:bg-transparent rounded-none border-0 p-0 sm:bg-white sm:dark:bg-[#1a1a1a] sm:rounded-md sm:border sm:border-gray-200/60 sm:dark:border-gray-800/60 sm:p-6 lg:p-8">
          {safeContent ? (
            <div className="note-rich text-gray-800 dark:text-gray-100">
              <div
                className="note-content"
                dangerouslySetInnerHTML={{ __html: safeContent }}
              />
            </div>
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
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          className="fixed right-4 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 shadow-sm transition-all hover:-translate-y-0.5 hover:text-teal-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:text-teal-400"
          style={{ bottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        >
          <FaArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default PublicNote;