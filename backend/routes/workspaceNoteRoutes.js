import express from "express";
import {
  createWorkspaceNote,
  getWorkspaceNotes,
  getWorkspaceNote,
  updateWorkspaceNote,
  deleteWorkspaceNote,
  exportWorkspaceNotePDF,
  importFileToWorkspaceNote,
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
    allowed_formats: ["jpg", "png", "jpeg", "webp", "avif", "pdf", "doc", "docx", "xls", "xlsx", "txt", "csv"],
    transformation: [{ width: 1000, crop: "limit" }],
    resource_type: "auto",
  },
});

const upload = multer({
  storage: noteStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── All routes require authentication ──────────────────────────────────
router.use(protect);

// Workspace notes
router.post("/", upload.array("attachments", 5), createWorkspaceNote);
router.get("/:workspaceId", getWorkspaceNotes);
router.get("/note/:id", getWorkspaceNote); // note: avoid conflict with :workspaceId
router.put("/:id", upload.array("attachments", 5), updateWorkspaceNote);
router.delete("/:id", deleteWorkspaceNote);

// Export as PDF
router.get("/:id/export-pdf", exportWorkspaceNotePDF);

// Import file to create workspace note
router.post("/import", upload.single("file"), importFileToWorkspaceNote);

export default router;