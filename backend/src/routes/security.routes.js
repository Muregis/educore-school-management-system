import { Router } from "express";
import { SecurityService } from "../core/services/SecurityService.js";

const router = Router();
const securityService = new SecurityService();

// Enable 2FA
router.post("/2fa/enable", async (req, res) => {
  try {
    const result = await securityService.enableTwoFactor(req.user.id, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Disable 2FA
router.post("/2fa/disable", async (req, res) => {
  try {
    const result = await securityService.disableTwoFactor(req.user.id, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Verify 2FA
router.post("/2fa/verify", async (req, res) => {
  try {
    const { token } = req.body;
    const result = await securityService.verifyTwoFactor(req.user.id, token);
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Change password
router.post("/password/change", async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await securityService.changePassword(req.user.id, current_password, new_password, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Lock user account
router.post("/users/:userId/lock", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const result = await securityService.lockUserAccount(userId, reason, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Unlock user account
router.post("/users/:userId/unlock", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await securityService.unlockUserAccount(userId, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Get user sessions
router.get("/sessions", async (req, res) => {
  try {
    const result = await securityService.getUserSessions(req.user.id);
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 500);
  }
});

// Revoke session
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await securityService.revokeSession(sessionId, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

// Revoke all other sessions
router.post("/sessions/revoke-others", async (req, res) => {
  try {
    const { current_session_id } = req.body;
    const result = await securityService.revokeAllOtherSessions(req.user.id, current_session_id, { schoolId: req.user.schoolId, userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('SECURITY_ERROR', error.message, {}, 400);
  }
});

export default router;
