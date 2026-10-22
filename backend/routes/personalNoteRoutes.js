// routes/personalNoteRoutes.js
import express from "express";
import {
  createNote,
  getNotes,
  getNote,
  getNoteByShareLink, // 👈 Import the legacy route
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
//  1. PUBLIC ROUTES (Legacy Support & New Guest Access)
// ══════════════════════════════════════════════════════════════════════════

// Legacy share link route (kept for existing users)
router.get("/share/:link", getNoteByShareLink);

// New direct link route (supports guests if the note is public)
router.get("/:id", optionalAuth, getNote);

// ══════════════════════════════════════════════════════════════════════════
//  2. PROTECTED ROUTES
// ══════════════════════════════════════════════════════════════════════════
router.use(protect);

// ── AI routes ──
router.post("/ai/scripture", lookupScripture);
router.post("/ai/scripture/expand", expandScripture);
router.post("/ai/search", searchHighlight);
router.post("/ai/proofread", proofreadNoteHandler);
router.post("/ai/complete", completeNoteHandler);
router.post("/ai/rewrite", rewriteNoteHandler);

// ── Folder routes ──
router.post("/folders", createNoteFolder);
router.get("/folders", getNoteFolders);
router.put("/folders/:id", updateNoteFolder);
router.patch("/folders/:id/color", updateNoteFolderColor);
router.delete("/folders/:id", deleteNoteFolder);

// ── Import route ──
router.post("/import", upload.single("file"), importFileToNote);

// ── Note CRUD ──
router.post("/", upload.array("attachments", 5), createNote);
router.get("/", getNotes);
router.put("/:id", upload.array("attachments", 5), updateNote);
router.delete("/:id", deleteNote);

// ── Sub-resource / Action routes ──
router.patch("/:id/public", togglePublic);
router.patch("/:id/move", moveNote);
router.patch("/:id/color", updateNoteColor);
router.get("/:id/export-pdf", exportNotePDF);

// ── Collaborators ──
router.post("/:id/collaborators", addCollaborator);
router.delete("/:id/collaborators/:collaboratorId", removeCollaborator);
router.patch("/:id/collaborators/:collaboratorId", updateCollaboratorPermission);

export default router;