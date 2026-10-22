// routes/personalNoteRoutes.js
import express from "express";
import {
  createNote,
  getNotes,
  getNote,
  updateNote,
  moveNote,
  deleteNote,
  togglePublic,
  updateNoteColor,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorPermission,
  exportNotePDF,
  importFileToNote,
  // Folder handlers
  createNoteFolder,
  getNoteFolders,
  updateNoteFolder,
  updateNoteFolderColor,
  deleteNoteFolder,
} from "../controllers/personalNoteController.js";

import {
  lookupScripture,
  expandScripture,
  searchHighlight,
  proofreadNoteHandler,
  completeNoteHandler,
  rewriteNoteHandler,
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
    transformation: [{ width: 1000, crop: "limit" }],
    resource_type: "auto",
  },
});

const upload = multer({
  storage: noteStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Optional Auth Middleware ───────────────────────────────────────────────
// If a token is provided, it parses it and attaches req.user.
// If no token is provided, it lets the request through as a guest.
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return protect(req, res, next);
  }
  next();
};

// ══════════════════════════════════════════════════════════════════════════
//  1. STATIC ROUTES (Must come before dynamic "/:id" routes)
// ══════════════════════════════════════════════════════════════════════════

// ── AI routes ──
router.post("/ai/scripture", protect, lookupScripture);
router.post("/ai/scripture/expand", protect, expandScripture);
router.post("/ai/search", protect, searchHighlight);
router.post("/ai/proofread", protect, proofreadNoteHandler);
router.post("/ai/complete", protect, completeNoteHandler);
router.post("/ai/rewrite", protect, rewriteNoteHandler);

// ── Folder routes ──
router.post("/folders", protect, createNoteFolder);
router.get("/folders", protect, getNoteFolders);
router.put("/folders/:id", protect, updateNoteFolder);
router.patch("/folders/:id/color", protect, updateNoteFolderColor);
router.delete("/folders/:id", protect, deleteNoteFolder);

// ── Import route ──
router.post("/import", protect, upload.single("file"), importFileToNote);

// ══════════════════════════════════════════════════════════════════════════
//  2. NOTE CRUD
// ══════════════════════════════════════════════════════════════════════════

// GET /:id is public IF the note is marked public (controller handles the logic).
// It uses optionalAuth so logged-in users still get their user context (for collaborator checks).
router.get("/:id", optionalAuth, getNote);

// The rest of the CRUD routes are fully protected
router.post("/", protect, upload.array("attachments", 5), createNote);
router.get("/", protect, getNotes);
router.put("/:id", protect, upload.array("attachments", 5), updateNote);
router.delete("/:id", protect, deleteNote);

// ══════════════════════════════════════════════════════════════════════════
//  3. SUB-RESOURCE / ACTION ROUTES
// ══════════════════════════════════════════════════════════════════════════
router.patch("/:id/public", protect, togglePublic);
router.patch("/:id/move", protect, moveNote);
router.patch("/:id/color", protect, updateNoteColor);
router.get("/:id/export-pdf", protect, exportNotePDF);

// ── Collaborators ──
router.post("/:id/collaborators", protect, addCollaborator);
router.delete("/:id/collaborators/:collaboratorId", protect, removeCollaborator);
router.patch("/:id/collaborators/:collaboratorId", protect, updateCollaboratorPermission);

export default router;