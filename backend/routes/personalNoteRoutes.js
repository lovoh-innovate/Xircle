// routes/personalNoteRoutes.js
import express from "express";
import {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
  togglePublic,
  getNoteByShareLink,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorPermission,
  exportNotePDF,
  importFileToNote,
} from "../controllers/personalNoteController.js";
import {
  lookupScripture,
  expandScripture,
  searchHighlight,
  proofreadNoteHandler,
  completeNoteHandler,
  rewriteNoteHandler,                    // 👈 NEW
} from "../controllers/noteAiController.js";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

// ── Cloudinary config ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const noteStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Xircle_NoteAttachments",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf", "doc", "docx", "xls", "xlsx", "txt", "csv"],
    transformation: [{ width: 1000, crop: "limit" }], // For images; other files remain as is
    resource_type: "auto", // important to handle non-image files
  },
});

const upload = multer({
  storage: noteStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
});

// ── Public route (no authentication) ──────────────────────────────────────
// Get a public note by share link
router.get("/share/:link", getNoteByShareLink);

// ── Protected routes ──────────────────────────────────────────────────────
router.use(protect); // All following routes require authentication

// ── AI routes ─────────────────────────────────────────────────────────────
// Must be declared BEFORE the /:id routes so path segments like "ai" are
// never mistaken for a note id. All six are POST; none of them write to
// the database — proofread, complete, and rewrite return suggestions only.

// Highlight → detect Bible/Quran/general, fetch the passage text
router.post("/ai/scripture", lookupScripture);

// "Show more verses" / "Show full chapter" buttons
router.post("/ai/scripture/expand", expandScripture);

// Non-scripture highlight → summary, definitions, search links
router.post("/ai/search", searchHighlight);

// Spelling / punctuation / grammar / formatting fixes (suggestions only)
router.post("/ai/proofread", proofreadNoteHandler);

// Expand a note with explanation, examples, depth (suggestions only)
router.post("/ai/complete", completeNoteHandler);

// Full rewrite: restructure, elaborate, reformat, adjust tone/length.
// Body: { noteId } OR { content, title }
// Optional: instructions (string), style, length
//   style:  explanatory | formal | casual | devotional | academic | journal
//   length: shorter | same | longer | much_longer
// Returns { original, rewrittenContent, changed, changeCount, changes, summary, style, length }
router.post("/ai/rewrite", rewriteNoteHandler);                    // 👈 NEW

// ── CRUD ──────────────────────────────────────────────────────────────────
router.post("/", upload.array("attachments", 5), createNote); // max 5 attachments
router.get("/", getNotes);
router.get("/:id", getNote);
router.put("/:id", upload.array("attachments", 5), updateNote);
router.delete("/:id", deleteNote);

// Toggle public status
router.patch("/:id/public", togglePublic);

// Collaborators
router.post("/:id/collaborators", addCollaborator);
router.delete("/:id/collaborators/:collaboratorId", removeCollaborator);
router.patch("/:id/collaborators/:collaboratorId", updateCollaboratorPermission);

// Export as PDF
router.get("/:id/export-pdf", exportNotePDF);

// Import file to create note
router.post("/import", upload.single("file"), importFileToNote);

export default router;