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

// CRUD
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