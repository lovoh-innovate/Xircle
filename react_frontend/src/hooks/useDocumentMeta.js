// src/hooks/useDocumentMeta.js
import { useEffect } from 'react';

// Ensures a <meta> or <link> tag exists for the given selector.
// Creates it if missing, updates the attributes if present.
const ensureTag = (selector, tagName, attrs = {}) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tagName);
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) el.removeAttribute(k);
    else el.setAttribute(k, String(v));
  }
  return el;
};

const ensureMeta = (selector, attrs) => ensureTag(selector, 'meta', attrs);
const ensureLink = (selector, attrs) => ensureTag(selector, 'link', attrs);

// Snapshot the current state of a head element so we can restore it.
const captureTag = (selector) => {
  const el = document.head.querySelector(selector);
  if (!el) return { existed: false };
  const attrs = {};
  for (const a of el.attributes) attrs[a.name] = a.value;
  return { existed: true, attrs };
};

// Restore a snapshot. If the tag didn't exist before, remove any
// element the hook created at that selector.
const restoreTag = (selector, tagName, snapshot) => {
  if (!snapshot) return;
  if (snapshot.existed) {
    ensureTag(selector, tagName, snapshot.attrs);
  } else {
    const el = document.head.querySelector(selector);
    if (el) el.remove();
  }
};

/**
 * Sets document title + standard / OpenGraph / Twitter meta tags while
 * the calling component is mounted. Restores the previous values on
 * unmount so navigating away doesn't leave stale metadata in <head>.
 *
 * All fields are optional. Passing `undefined` or `null` for any field
 * means "don't touch it" — the existing tag (if any) is left alone.
 *
 * Usage:
 *   useDocumentMeta({
 *     title: 'Some note — Xircle',
 *     description: 'A shared note',
 *     image: 'https://…/cover.jpg',
 *     url: 'https://xircle.lovohcreate.com/share/abc',
 *     // optional:
 *     type: 'article',      // default 'article'
 *     siteName: 'Xircle',   // default 'Xircle'
 *   });
 */
export function useDocumentMeta({
  title,
  description,
  image,
  url,
  type = 'article',
  siteName = 'Xircle',
} = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    const plan = [];

    if (description != null) {
      plan.push({
        selector: 'meta[name="description"]',
        tagName: 'meta',
        attrs: { name: 'description', content: description },
      });
    }

    if (title) {
      plan.push({
        selector: 'meta[property="og:title"]',
        tagName: 'meta',
        attrs: { property: 'og:title', content: title },
      });
      plan.push({
        selector: 'meta[name="twitter:title"]',
        tagName: 'meta',
        attrs: { name: 'twitter:title', content: title },
      });
    }

    if (description != null) {
      plan.push({
        selector: 'meta[property="og:description"]',
        tagName: 'meta',
        attrs: { property: 'og:description', content: description },
      });
      plan.push({
        selector: 'meta[name="twitter:description"]',
        tagName: 'meta',
        attrs: { name: 'twitter:description', content: description },
      });
    }

    if (image) {
      plan.push({
        selector: 'meta[property="og:image"]',
        tagName: 'meta',
        attrs: { property: 'og:image', content: image },
      });
      plan.push({
        selector: 'meta[property="og:image:secure_url"]',
        tagName: 'meta',
        attrs: { property: 'og:image:secure_url', content: image },
      });
      plan.push({
        selector: 'meta[name="twitter:image"]',
        tagName: 'meta',
        attrs: { name: 'twitter:image', content: image },
      });
    }

    if (url) {
      plan.push({
        selector: 'meta[property="og:url"]',
        tagName: 'meta',
        attrs: { property: 'og:url', content: url },
      });
      plan.push({
        selector: 'link[rel="canonical"]',
        tagName: 'link',
        attrs: { rel: 'canonical', href: url },
      });
    }

    // Only set the "wrapper" tags if we have something to say.
    if (title || description != null || image || url) {
      plan.push({
        selector: 'meta[property="og:type"]',
        tagName: 'meta',
        attrs: { property: 'og:type', content: type },
      });
      plan.push({
        selector: 'meta[property="og:site_name"]',
        tagName: 'meta',
        attrs: { property: 'og:site_name', content: siteName },
      });
      plan.push({
        selector: 'meta[name="twitter:card"]',
        tagName: 'meta',
        attrs: {
          name: 'twitter:card',
          content: image ? 'summary_large_image' : 'summary',
        },
      });
    }

    // Snapshot every tag we're about to touch BEFORE mutating anything.
    const snapshots = plan.map(({ selector, tagName }) => ({
      selector,
      tagName,
      snapshot: captureTag(selector),
    }));

    // Apply.
    if (title) document.title = title;
    for (const { selector, tagName, attrs } of plan) {
      if (tagName === 'link') ensureLink(selector, attrs);
      else ensureMeta(selector, attrs);
    }

    return () => {
      document.title = prevTitle;
      for (const { selector, tagName, snapshot } of snapshots) {
        restoreTag(selector, tagName, snapshot);
      }
    };
  }, [title, description, image, url, type, siteName]);
}

export default useDocumentMeta;