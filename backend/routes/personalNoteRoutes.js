// routes/personalNoteRoutes.js
import express from "express";
import {
  createNote,
  getNotes,
  getNote,
  getNoteCollaborators,          // 🌟 new: fetch collaborators & edit history
  getNoteByShareLink,            // legacy /share/:link
  updateNote,
  moveNote,
  deleteNote,
  togglePublic,
  updateNoteColor,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorPermission,
  requestNoteAccess,             // request access to a public note
  getAllPendingRequests,         // 🌟 new: global dashboard for pending requests
  getAccessRequests,             // owner — list pending requests for a single note
  resolveAccessRequest,          // owner — approve/reject a request
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
//  1. PUBLIC & OPTIONAL AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════

// Legacy share link route (kept for existing users)
router.get("/share/:link", getNoteByShareLink);

// Fetch a single note — accepts ObjectId, slug, or share link.
router.get("/:id", optionalAuth, getNote);

// Fetch collaborators & edit history for a specific note.
// Uses optionalAuth so guests can see collaborators on a public note.
router.get("/:id/collaborators", optionalAuth, getNoteCollaborators);

// ══════════════════════════════════════════════════════════════════════════
//  2. PROTECTED ROUTES
// ══════════════════════════════════════════════════════════════════════════
router.use(protect);

// ── Folder routes ──
// Note: These MUST be defined before dynamic routes like `/:id` to prevent
// "folders" from being interpreted as a Note ID.
router.get("/folders", getNoteFolders);
router.post("/folders", createNoteFolder);
router.put("/folders/:id", updateNoteFolder);
router.patch("/folders/:id/color", updateNoteFolderColor);
router.delete("/folders/:id", deleteNoteFolder);

// ── Access Request Dashboard ──
// Fetch ALL pending requests across all notes owned by the user.
// Must be defined before `/:id` routes.
router.get("/access-requests/all", getAllPendingRequests);

// ── AI routes ──
router.post("/ai/scripture", lookupScripture);
router.post("/ai/scripture/expand", expandScripture);
router.post("/ai/search", searchHighlight);
router.post("/ai/proofread", proofreadNoteHandler);
router.post("/ai/complete", completeNoteHandler);
router.post("/ai/rewrite", rewriteNoteHandler);

// ── Import route ──
router.post("/import", upload.single("file"), importFileToNote);

// ── Note CRUD (Root) ──
router.get("/", getNotes);
router.post("/", upload.array("attachments", 5), createNote);

// ── Note CRUD (Specific Note Actions) ──
router.put("/:id", upload.array("attachments", 5), updateNote);
router.delete("/:id", deleteNote);
router.patch("/:id/public", togglePublic);
router.patch("/:id/move", moveNote);
router.patch("/:id/color", updateNoteColor);
router.get("/:id/export-pdf", exportNotePDF);

// ── Collaborators ──
router.post("/:id/collaborators", addCollaborator);
router.delete("/:id/collaborators/:collaboratorId", removeCollaborator);
router.patch("/:id/collaborators/:collaboratorId", updateCollaboratorPermission);

// ── Access Requests (Specific Note) ──
// Any signed-in user can request access to a public note.
router.post("/:id/request-access", requestNoteAccess);

// Owner-only — list pending access requests on their note.
router.get("/:id/access-requests", getAccessRequests);

// Owner-only — approve or reject a specific request.
router.patch("/:id/access-requests/:requestId", resolveAccessRequest);

export default router;