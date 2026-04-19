/**
 * Update Requests API Routes
 * Handles parent update requests for student information
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, canAccessStudentData } = require('../middleware/permissions');
const { supabase } = require('../config/supabaseClient.js');
const { safeSupabaseQuery } = require('../config/supabaseClient.js');

/**
 * GET /api/students/pending-updates
 * Get all pending update requests
 */
router.get('/pending-updates', authenticate, async (req, res) => {
  try {
    let query = supabase
      .from('pending_updates')
      .select('*')
      .eq('school_id', req.user.schoolId || 'default-school')
      .order('created_at', { ascending: false });
    
    // Parents can only see requests for their children
    if (req.user.role === 'parent') {
      query = query.eq('requested_by', req.user.userId || req.user.id);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending updates', error: error.message });
  }
});

/**
 * POST /api/students/pending-updates
 * Create a new update request
 */
router.post('/pending-updates', authenticate, authorize('update-requests'), async (req, res) => {
  try {
    const {
      studentId,
      field,
      oldValue,
      newValue,
      reason,
      requestedBy,
      requestedByRole
    } = req.body;
    
    // Validate required fields
    if (!studentId || !field || !newValue || !reason) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if there's already a pending request for the same field and student
    const { data: existingRequest } = await supabase
      .from('pending_updates')
      .select('*')
      .eq('student_id', studentId)
      .eq('field', field)
      .eq('status', 'pending')
      .eq('school_id', req.user.schoolId || 'default-school')
      .single();
    
    if (existingRequest) {
      return res.status(400).json({ message: 'A pending request for this field already exists' });
    }
    
    // Create new update request
    const newRequest = {
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      student_id: studentId,
      field,
      old_value: oldValue,
      new_value: newValue,
      reason,
      status: 'pending',
      requested_by: requestedBy || req.user.userId || req.user.id,
      requested_by_role: requestedByRole || req.user.role,
      school_id: req.user.schoolId || 'default-school'
    };
    
    const { data, error } = await supabase
      .from('pending_updates')
      .insert([newRequest])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create update request', error: error.message });
  }
});

/**
 * POST /api/students/pending-updates/:updateId/approve
 * Approve an update request
 */
router.post('/pending-updates/:updateId/approve', authenticate, authorize('update-requests'), async (req, res) => {
  try {
    const { updateId } = req.params;
    
    // Find the update request
    const { data: update, error: fetchError } = await supabase
      .from('pending_updates')
      .select('*')
      .eq('id', updateId)
      .eq('school_id', req.user.schoolId || 'default-school')
      .single();
    
    if (fetchError || !update) {
      return res.status(404).json({ message: 'Update request not found' });
    }
    
    if (update.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }
    
    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('pending_updates')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: req.user.userId || req.user.id
      })
      .eq('id', updateId)
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    // TODO: Update the actual student record based on the field
    // This would involve updating the students table with the new value
    
    res.json({ success: true, message: 'Update request approved successfully', data: updatedRequest });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve update request', error: error.message });
  }
});

/**
 * POST /api/students/pending-updates/:updateId/reject
 * Reject an update request
 */
router.post('/pending-updates/:updateId/reject', authenticate, authorize('update-requests'), async (req, res) => {
  try {
    const { updateId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    // Find the update request
    const { data: update, error: fetchError } = await supabase
      .from('pending_updates')
      .select('*')
      .eq('id', updateId)
      .eq('school_id', req.user.schoolId || 'default-school')
      .single();
    
    if (fetchError || !update) {
      return res.status(404).json({ message: 'Update request not found' });
    }
    
    if (update.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }
    
    // Update the request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('pending_updates')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: req.user.userId || req.user.id,
        rejection_reason: reason
      })
      .eq('id', updateId)
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({ success: true, message: 'Update request rejected successfully', data: updatedRequest });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject update request', error: error.message });
  }
});

module.exports = router;
