import express from "express";
import {
  // notes
  createWorkspaceNote,
  getWorkspaceNotes,
  getWorkspaceNote,
  updateWorkspaceNote,
  updateWorkspaceNoteColor,       // 👈 new
  moveWorkspaceNote,
  deleteWorkspaceNote,
  exportWorkspaceNotePDF,
  importFileToWorkspaceNote,
  // folders
  createNoteFolder,
  getNoteFolders,
  updateNoteFolder,
  updateNoteFolderColor,          // 👈 new
  deleteNoteFolder,
} from "../controllers/workspaceNoteController.js";
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
    folder: "Xircle_WorkspaceNoteAttachments",
    allowed_formats: [
      "jpg", "png", "jpeg", "webp", "avif",
      "pdf", "doc", "docx", "xls", "xlsx", "txt", "csv",
    ],
    transformation: [{ width: 1000, crop: "limit" }],
    resource_type: "auto",
  },
});

const upload = multer({
  storage: noteStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── All routes require authentication ──────────────────────────────────
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════
//  FOLDER ROUTES  (must come before `/:id` note routes)
// ═══════════════════════════════════════════════════════════════════════
router.post("/folders", createNoteFolder);
router.get("/folders/:workspaceId", getNoteFolders);
router.put("/folders/:id", updateNoteFolder);
router.patch("/folders/:id/color", updateNoteFolderColor);   // 👈 new
router.delete("/folders/:id", deleteNoteFolder);

// ═══════════════════════════════════════════════════════════════════════
//  NOTE ROUTES
// ═══════════════════════════════════════════════════════════════════════

// Create note (drafts allowed)
router.post("/", upload.array("attachments", 5), createWorkspaceNote);

// Import file → note
router.post("/import", upload.single("file"), importFileToWorkspaceNote);

// Get one note
router.get("/note/:id", getWorkspaceNote);

// Export PDF
router.get("/:id/export-pdf", exportWorkspaceNotePDF);

// Move note to folder
router.patch("/:id/move", moveWorkspaceNote);

// Change note color only
router.patch("/:id/color", updateWorkspaceNoteColor);        // 👈 new

// Update / delete note
router.put("/:id", upload.array("attachments", 5), updateWorkspaceNote);
router.delete("/:id", deleteWorkspaceNote);

// List notes for a workspace — keep LAST
router.get("/:workspaceId", getWorkspaceNotes);

export default router;