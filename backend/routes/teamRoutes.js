// routes/teamRoutes.js
import express from 'express';
import {
  // ── Permanent member flow ──
  requestToJoin,
  getPendingRequests,
  approveMember,
  rejectMember,
  getMembers,
  getMembersByDepartment,
  updateMember,
  removeMember,
  getMyMembership,

  // ── Associate flow (workspace-level) ──
  getAssociates,
  updateAssociate,
  removeAssociate,
  convertAssociateToMember,
} from '../controllers/teamController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ═════════════════════════════════════════════════════════════════════
// SHARED  (any active member of the workspace)
// ═════════════════════════════════════════════════════════════════════

router.get('/:workspaceId/me', protect, getMyMembership);
router.get('/:workspaceId/members', protect, getMembers);
router.get('/:workspaceId/department/:department', protect, getMembersByDepartment);

// ═════════════════════════════════════════════════════════════════════
// PERMANENT-MEMBER JOIN FLOW  (invite code → request → approve/reject)
//
// Invite codes are for permanent members only. Associates are added
// directly from a project — they never use invite codes.
// ═════════════════════════════════════════════════════════════════════

router.post('/join', protect, requestToJoin);

// ── Owner/Admin: pending requests ──
router.get('/:workspaceId/requests', protect, getPendingRequests);
router.put('/:workspaceId/approve/:memberId', protect, approveMember);
router.delete('/:workspaceId/reject/:memberId', protect, rejectMember);

// ═════════════════════════════════════════════════════════════════════
// MEMBER MANAGEMENT  (Owner/Admin)
//
// These work for permanent members AND associates:
//   - PUT    updates role/department (associates can't be set to Admin)
//   - DELETE removes the member and cleans up all their project ties
// ═════════════════════════════════════════════════════════════════════

router.put('/:workspaceId/member/:memberId', protect, updateMember);
router.delete('/:workspaceId/member/:memberId', protect, removeMember);

// ═════════════════════════════════════════════════════════════════════
// ASSOCIATE MANAGEMENT  (Owner/Admin)
//
// Associates are workspace members with memberType: 'associate'.
// They are normally added from a project (see projectController.addAssociate),
// which handles the workspace member record automatically. These endpoints
// manage the workspace-level side.
//
//   GET    /associates                          → list all associates
//   PATCH  /associate/:memberId                 → update expiry
//   DELETE /associate/:memberId                 → remove + revoke all project ties
//   PATCH  /associate/:memberId/promote         → convert to permanent member
// ═════════════════════════════════════════════════════════════════════

router.get('/:workspaceId/associates', protect, getAssociates);
router.patch('/:workspaceId/associate/:memberId', protect, updateAssociate);
router.delete('/:workspaceId/associate/:memberId', protect, removeAssociate);
router.patch(
  '/:workspaceId/associate/:memberId/promote',
  protect,
  convertAssociateToMember
);

export default router;