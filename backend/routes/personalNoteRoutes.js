// routes/personalNoteRoutes.js
import express from "express";
import {
  createNote,
  getNotes,
  getNote,
  updateNote,
  moveNote,                // 👈 new
  deleteNote,
  togglePublic,
  getNoteByShareLink,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorPermission,
  exportNotePDF,
  importFileToNote,
  // 👇 new — folder handlers, same controller
  createNoteFolder,
  getNoteFolders,
  updateNoteFolder,
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

// ── Public route (no authentication) ──────────────────────────────────────
router.get("/share/:link", getNoteByShareLink);

// ── Protected routes ──────────────────────────────────────────────────────
router.use(protect);

// ══════════════════════════════════════════════════════════════════════════
//  1. AI ROUTES (static "/ai/*" — must come before any "/:id" route)
// ══════════════════════════════════════════════════════════════════════════
router.post("/ai/scripture", lookupScripture);
router.post("/ai/scripture/expand", expandScripture);
router.post("/ai/search", searchHighlight);
router.post("/ai/proofread", proofreadNoteHandler);
router.post("/ai/complete", completeNoteHandler);
router.post("/ai/rewrite", rewriteNoteHandler);

// ══════════════════════════════════════════════════════════════════════════
//  2. FOLDER ROUTES (static "/folders*" — must come before "/:id")
//     Otherwise `GET /folders` would be caught by `GET /:id` (id="folders").
// ══════════════════════════════════════════════════════════════════════════
router.post("/folders", createNoteFolder);
router.get("/folders", getNoteFolders);
router.put("/folders/:id", updateNoteFolder);
router.delete("/folders/:id", deleteNoteFolder);

// ══════════════════════════════════════════════════════════════════════════
//  3. IMPORT (static "/import" — before dynamic CRUD)
// ══════════════════════════════════════════════════════════════════════════
router.post("/import", upload.single("file"), importFileToNote);

// ══════════════════════════════════════════════════════════════════════════
//  4. NOTE CRUD
// ══════════════════════════════════════════════════════════════════════════
router.post("/", upload.array("attachments", 5), createNote);
router.get("/", getNotes);                                            // ?folderId=<id|root>
router.get("/:id", getNote);
router.put("/:id", upload.array("attachments", 5), updateNote);
router.delete("/:id", deleteNote);

// ══════════════════════════════════════════════════════════════════════════
//  5. SUB-RESOURCE / ACTION ROUTES on a note
// ══════════════════════════════════════════════════════════════════════════
router.patch("/:id/public", togglePublic);
router.patch("/:id/move", moveNote);                                  // 👈 new
router.get("/:id/export-pdf", exportNotePDF);

// Collaborators
router.post("/:id/collaborators", addCollaborator);
router.delete("/:id/collaborators/:collaboratorId", removeCollaborator);
router.patch("/:id/collaborators/:collaboratorId", updateCollaboratorPermission);

export default router;