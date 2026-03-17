// OLD: MySQL-specific Admin Service (commented for safety)
// This file used MySQL-specific syntax and is replaced by admin.service.js which uses Supabase
/*
import { pool } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// Admin Tools Service
export class AdminService {
  // Reset user password
  static async resetPassword(adminUser, targetUserId, newPassword, req) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get target user info
      const [[targetUser]] = await connection.query(
        `SELECT user_id, school_id, full_name, email, role FROM users 
         WHERE user_id = ? AND is_deleted = 0`,
        [targetUserId]
      );

      if (!targetUser) {
        throw new Error('User not found');
      }

      // Verify admin can reset this user's password (same school)
      if (targetUser.school_id !== adminUser.school_id) {
        throw new Error('Cannot reset password for user from different school');
      }

      // Hash new password
      const hash = await bcrypt.hash(newPassword, 10);

      // Update password
      await connection.query(
        `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
        [hash, targetUserId]
      );

      // Log password reset
      await logAuditEvent(req, AUDIT_ACTIONS.USER_STATUS_CHANGE, {
        entityId: targetUserId,
        entityType: 'user',
        description: `Password reset for ${targetUser.full_name} (${targetUser.role}) by admin ${adminUser.full_name}`,
        newValues: { action: 'password_reset', performedBy: adminUser.user_id }
      });

      await connection.commit();
      
      return {
        success: true,
        userId: targetUserId,
        userName: targetUser.full_name,
        message: 'Password reset successfully'
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Generate impersonation token
  static async generateImpersonationToken(adminUser, targetUserId, req) {
    // Get target user info
    const [[targetUser]] = await pool.query(
      `SELECT user_id, school_id, full_name, email, role, student_id FROM users 
       WHERE user_id = ? AND is_deleted = 0`,
      [targetUserId]
    );

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Verify admin can impersonate this user (same school)
    if (targetUser.school_id !== adminUser.school_id) {
      throw new Error('Cannot impersonate user from different school');
    }

    // Create impersonation payload
    const impersonationPayload = {
      user_id: targetUser.user_id,
      school_id: targetUser.school_id,
      role: targetUser.role,
      name: targetUser.full_name,
      email: targetUser.email,
      student_id: targetUser.student_id,
      impersonated_by: adminUser.user_id,
      impersonated_by_name: adminUser.full_name,
      is_impersonation: true
    };

    // Generate short-lived token (1 hour)
    const token = jwt.sign(impersonationPayload, env.jwtSecret, {
      expiresIn: '1h'
    });

    // Log impersonation
    await logAuditEvent(req, AUDIT_ACTIONS.ADMIN_ACTION, {
      entityId: targetUserId,
      entityType: 'user',
      description: `User impersonation: ${adminUser.full_name} impersonating ${targetUser.full_name}`,
      newValues: { 
        targetUserId: targetUser.user_id,
        targetRole: targetUser.role,
        impersonationToken: token.substring(0, 20) + '...'
      }
    });

    return {
      token,
      targetUser: {
        userId: targetUser.user_id,
        name: targetUser.full_name,
        role: targetUser.role,
        email: targetUser.email
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }

  // Get system health metrics
  static async getSystemHealth(schoolId) {
    const metrics = {};

    // Database connection test
    try {
      await pool.query('SELECT 1');
      metrics.database = { status: 'healthy', latency: Date.now() };
    } catch (error) {
      metrics.database = { status: 'unhealthy', error: error.message };
    }

    // User counts
    const [[userCounts]] = await pool.query(
      `SELECT 
         COUNT(*) as total_users,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
         SUM(CASE WHEN last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent_logins
       FROM users WHERE school_id = ? AND is_deleted = 0`,
      [schoolId]
    );

    metrics.users = userCounts;

    // Student counts
    const [[studentCounts]] = await pool.query(
      `SELECT 
         COUNT(*) as total_students,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students
       FROM students WHERE school_id = ? AND is_deleted = 0`,
      [schoolId]
    );

    metrics.students = studentCounts;

    // Payment summary
    const [[paymentSummary]] = await pool.query(
      `SELECT 
         COUNT(*) as total_payments,
         SUM(amount) as total_amount,
         SUM(CASE WHEN payment_date > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN amount ELSE 0 END) as recent_amount
       FROM payments WHERE school_id = ? AND is_deleted = 0`,
      [schoolId]
    );

    metrics.payments = paymentSummary;

    // Storage usage (approximate)
    const [[storageUsage]] = await pool.query(
      `SELECT 
         COUNT(*) as total_records,
         SUM(LENGTH(first_name) + LENGTH(last_name) + LENGTH(email)) as data_size
       FROM students WHERE school_id = ? AND is_deleted = 0`,
      [schoolId]
    );

    metrics.storage = {
      totalRecords: storageUsage.total_records,
      estimatedSizeKB: Math.round((storageUsage.data_size || 0) / 1024)
    };

    return metrics;
  }

  // Get activity logs with pagination
  static async getActivityLogs(schoolId, filters = {}, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    let whereClause = `WHERE al.school_id = ?`;
    const params = [schoolId];

    if (filters.userId) {
      whereClause += ` AND al.user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.action) {
      whereClause += ` AND al.action = ?`;
      params.push(filters.action);
    }

    if (filters.dateFrom) {
      whereClause += ` AND al.created_at >= ?`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClause += ` AND al.created_at <= ?`;
      params.push(filters.dateTo);
    }

    // Get logs
    const [logs] = await pool.query(
      `SELECT al.*, u.full_name, u.role
       FROM activity_logs al
       LEFT JOIN users u ON u.user_id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const [[countResult]] = await pool.query(
      `SELECT COUNT(*) as total FROM activity_logs al ${whereClause}`,
      params
    );

    return {
      logs,
      pagination: {
        page,
        limit,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    };
  }

  // Get audit logs with pagination
  static async getAuditLogs(schoolId, filters = {}, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    let whereClause = `WHERE al.school_id = ?`;
    const params = [schoolId];

    if (filters.userId) {
      whereClause += ` AND al.user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.action) {
      whereClause += ` AND al.action = ?`;
      params.push(filters.action);
    }

    if (filters.entityType) {
      whereClause += ` AND al.entity_type = ?`;
      params.push(filters.entityType);
    }

    if (filters.dateFrom) {
      whereClause += ` AND al.timestamp >= ?`;
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClause += ` AND al.timestamp <= ?`;
      params.push(filters.dateTo);
    }

    // Get logs
    const [logs] = await pool.query(
      `SELECT al.*, u.full_name, u.role
       FROM audit_logs al
       LEFT JOIN users u ON u.user_id = al.user_id
       ${whereClause}
       ORDER BY al.timestamp DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const [[countResult]] = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );

    return {
      logs,
      pagination: {
        page,
        limit,
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    };
  }

  // Get user management data
  static async getUserManagementData(schoolId) {
    const [[userStats]] = await pool.query(
      `SELECT 
         role,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN last_login_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent_logins
       FROM users 
       WHERE school_id = ? AND is_deleted = 0
       GROUP BY role`,
      [schoolId]
    );

    const [[recentUsers]] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role, u.status, u.last_login_at, u.created_at
       FROM users u
       WHERE u.school_id = ? AND u.is_deleted = 0
       ORDER BY u.created_at DESC
       LIMIT 10`,
      [schoolId]
    );

    return {
      stats: userStats,
      recentUsers
    };
  }

  // Bulk user operations
  static async bulkUpdateUsers(schoolId, userIds, updates, req) {
    const connection = await pool.getConnection();
    const results = { updated: [], errors: [] };

    try {
      await connection.beginTransaction();

      for (const userId of userIds) {
        try {
          // Verify user belongs to school
          const [[user]] = await connection.query(
            `SELECT user_id, full_name, role FROM users 
             WHERE user_id = ? AND school_id = ? AND is_deleted = 0`,
            [userId, schoolId]
          );

          if (!user) {
            results.errors.push({ userId, message: 'User not found' });
            continue;
          }

          // Build update query
          const updateFields = [];
          const updateValues = [];

          if (updates.status) {
            updateFields.push('status = ?');
            updateValues.push(updates.status);
          }

          if (updates.role) {
            updateFields.push('role = ?');
            updateValues.push(updates.role);
          }

          if (updateFields.length === 0) {
            results.errors.push({ userId, message: 'No valid updates provided' });
            continue;
          }

          updateFields.push('updated_at = CURRENT_TIMESTAMP');
          updateValues.push(userId);

          await connection.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
            updateValues
          );

          // Log bulk update
          await logAuditEvent(req, AUDIT_ACTIONS.USER_ROLE_CHANGE, {
            entityId: userId,
            entityType: 'user',
            description: `Bulk user update: ${user.full_name} (${user.role}) - ${Object.keys(updates).join(', ')}`,
            newValues: updates
          });

          results.updated.push({ userId, userName: user.full_name, updates });

        } catch (error) {
          results.errors.push({ userId, message: error.message });
        }
      }

      await connection.commit();
      return results;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default AdminService;
*/
