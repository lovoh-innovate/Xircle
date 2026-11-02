// routes/workspaceNoteRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

import {
  // notes
  createWorkspaceNote,
  getWorkspaceNotes,
  getWorkspaceNote,
  getPublicWorkspaceNote,
  updateWorkspaceNote,
  updateWorkspaceNoteColor,
  updateWorkspaceNoteVisibility,
  moveWorkspaceNote,
  deleteWorkspaceNote,
  exportWorkspaceNotePDF,
  importFileToWorkspaceNote,
  // folders
  createNoteFolder,
  getNoteFolders,
  updateNoteFolder,
  updateNoteFolderColor,
  deleteNoteFolder,
} from "../controllers/workspaceNoteController.js";

import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// BULLETPROOF optionalAuth
// ═══════════════════════════════════════════════════════════════════════════
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return next();

    const token = header.split(" ")[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Safely check both 'id' and 'userId' depending on how your token was signed
    const targetId = decoded.id || decoded.userId;
    if (!targetId) {
      console.log("optionalAuth: Token decoded, but no id/userId found inside.");
      return next();
    }

    const user = await User.findById(targetId).select("-password");
    if (user) {
      req.user = user;
    } else {
      console.log("optionalAuth: Token valid, but user no longer exists in DB.");
    }
  } catch (err) {
    console.log("optionalAuth failed (invalid/expired token):", err.message);
  }
  return next();
};

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
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC / OPTIONAL-AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════
// Must be defined BEFORE router.use(protect)
router.get("/note/:id", optionalAuth, getWorkspaceNote);
router.get("/public/:workspaceId/:noteId", getPublicWorkspaceNote);

// ─── All remaining routes require authentication ───────────────────────
router.use(protect);

// ═══════════════════════════════════════════════════════════════════════
//  FOLDER ROUTES
// ═══════════════════════════════════════════════════════════════════════
router.post("/folders", createNoteFolder);
router.get("/folders/:workspaceId", getNoteFolders);
router.put("/folders/:id", updateNoteFolder);
router.patch("/folders/:id/color", updateNoteFolderColor);
router.delete("/folders/:id", deleteNoteFolder);

// ═══════════════════════════════════════════════════════════════════════
//  NOTE ROUTES
// ═══════════════════════════════════════════════════════════════════════
router.post("/", upload.array("attachments", 5), createWorkspaceNote);
router.post("/import", upload.single("file"), importFileToWorkspaceNote);
router.get("/:id/export-pdf", exportWorkspaceNotePDF);
router.patch("/:id/move", moveWorkspaceNote);
router.patch("/:id/color", updateWorkspaceNoteColor);
router.patch("/:id/visibility", updateWorkspaceNoteVisibility);
router.put("/:id", upload.array("attachments", 5), updateWorkspaceNote);
router.delete("/:id", deleteWorkspaceNote);

// List notes for a workspace — keep LAST
router.get("/:workspaceId", getWorkspaceNotes);

export default router;