import { database } from "../config/db.js";
import { logAuditEvent, AUDIT_ACTIONS } from "../helpers/audit.logger.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { logTenantQuery } from "../helpers/tenant-debug.logger.js";

// Admin Tools Service
export class AdminService {
  // Reset user password
  static async resetPassword(adminUser, targetUserId, newPassword, req) {
    try {
      // Get target user info using Supabase
      const { data: users } = await database.query('users', {
        select: 'user_id, school_id, full_name, email, role',
        where: { user_id: targetUserId, school_id: adminUser.school_id, is_deleted: false },
        limit: 1
      });
      logTenantQuery("admin.reset_password.target_user", {
        table: "users",
        userId: targetUserId,
        schoolId: adminUser.school_id,
      });

      const targetUser = users?.[0];
      if (!targetUser) {
        throw new Error('User not found in your school');
      }

      // Hash new password
      const hash = await bcrypt.hash(newPassword, 10);

      // Update password using Supabase
      await database.update('users', 
        { 
          password_hash: hash, 
          updated_at: new Date().toISOString() 
        },
        { user_id: targetUserId, school_id: adminUser.school_id }
      );
      logTenantQuery("admin.reset_password.update_user", {
        table: "users",
        userId: targetUserId,
        schoolId: adminUser.school_id,
      });

      // Log password reset
      await logAuditEvent(req, AUDIT_ACTIONS.USER_STATUS_CHANGE, {
        entityId: targetUserId,
        entityType: 'user',
        description: `Password reset for ${targetUser.full_name} (${targetUser.role}) by admin ${adminUser.full_name}`,
        newValues: { action: 'password_reset', performedBy: adminUser.user_id }
      });

      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      console.error('Password reset error:', error);
      throw new Error(`Failed to reset password: ${error.message}`);
    }
  }

  // Generate impersonation token
  static async generateImpersonationToken(adminUser, targetUserId, req) {
    try {
      // Get target user info using Supabase
      const { data: users } = await database.query('users', {
        select: 'user_id, school_id, full_name, email, role, student_id',
        where: { user_id: targetUserId, school_id: adminUser.school_id, is_deleted: false },
        limit: 1
      });
      logTenantQuery("admin.impersonate.target_user", {
        table: "users",
        userId: targetUserId,
        schoolId: adminUser.school_id,
      });

      const targetUser = users?.[0];
      if (!targetUser) {
        throw new Error('User not found in your school');
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
    } catch (error) {
      console.error('Impersonation error:', error);
      throw new Error(`Failed to generate impersonation token: ${error.message}`);
    }
  }

  // Get system health metrics
  static async getSystemHealth(schoolId) {
    const metrics = {};

    // Database connection test
    try {
      await database.query('users', { select: '1', limit: 1 });
      metrics.database = { status: 'healthy', latency: Date.now() };
    } catch (error) {
      metrics.database = { status: 'unhealthy', error: error.message };
    }

    // User counts using Supabase
    try {
      const { data: activeUsers } = await database.query('users', {
        select: 'status, last_login_at',
        where: { school_id: schoolId, is_deleted: false }
      });

      const totalUsers = activeUsers?.length || 0;
      const activeCount = activeUsers?.filter(u => u.status === 'active').length || 0;
      const recentLogins = activeUsers?.filter(u => {
        const lastLogin = new Date(u.last_login_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastLogin > weekAgo;
      }).length || 0;

      metrics.users = {
        total_users: totalUsers,
        active_users: activeCount,
        recent_logins: recentLogins
      };
    } catch (error) {
      metrics.users = { error: error.message };
    }

    // Student counts using Supabase
    try {
      const { data: students } = await database.query('students', {
        select: 'status',
        where: { school_id: schoolId, is_deleted: false }
      });

      const totalStudents = students?.length || 0;
      const activeStudents = students?.filter(s => s.status === 'active').length || 0;

      metrics.students = {
        total_students: totalStudents,
        active_students: activeStudents
      };
    } catch (error) {
      metrics.students = { error: error.message };
    }

    // Payment summary using Supabase
    try {
      const { data: payments } = await database.query('payments', {
        select: 'amount, payment_date',
        where: { school_id: schoolId, is_deleted: false }
      });

      const totalPayments = payments?.length || 0;
      const totalAmount = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentAmount = payments?.filter(p => new Date(p.payment_date) > thirtyDaysAgo)
        .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      metrics.payments = {
        total_payments: totalPayments,
        total_amount: totalAmount,
        recent_amount: recentAmount
      };
    } catch (error) {
      metrics.payments = { error: error.message };
    }

    return metrics;
  }

  // Get activity logs with pagination
  static async getActivityLogs(schoolId, filters = {}, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      // Build query conditions
      const whereConditions = { school_id: schoolId };
      if (filters.userId) whereConditions.user_id = filters.userId;
      if (filters.action) whereConditions.action = filters.action;
      if (filters.dateFrom) whereConditions.created_at = { gte: filters.dateFrom };
      if (filters.dateTo) whereConditions.created_at = { lte: filters.dateTo };

      // Get logs using Supabase
      const { data: logs, error } = await database.rpc('get_activity_logs_paginated', {
        p_school_id: schoolId,
        p_filters: whereConditions,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        // Fallback to simple query if RPC not available
        const { data: simpleLogs } = await database.query('activity_logs', {
          where: whereConditions,
          order: { column: 'created_at', ascending: false },
          limit: limit,
          offset: offset
        });

        return {
          logs: simpleLogs || [],
          pagination: { page, limit, total: simpleLogs?.length || 0, pages: 1 }
        };
      }

      return {
        logs: logs || [],
        pagination: { page, limit, total: logs?.length || 0, pages: 1 }
      };
    } catch (error) {
      console.error('Activity logs error:', error);
      throw new Error(`Failed to get activity logs: ${error.message}`);
    }
  }

  // Get audit logs with pagination
  static async getAuditLogs(schoolId, filters = {}, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;
      
      // Build query conditions
      const whereConditions = { school_id: schoolId };
      if (filters.userId) whereConditions.user_id = filters.userId;
      if (filters.action) whereConditions.action = filters.action;
      if (filters.entityType) whereConditions.entity_type = filters.entityType;
      if (filters.dateFrom) whereConditions.timestamp = { gte: filters.dateFrom };
      if (filters.dateTo) whereConditions.timestamp = { lte: filters.dateTo };

      // Get logs using Supabase
      const { data: logs, error } = await database.rpc('get_audit_logs_paginated', {
        p_school_id: schoolId,
        p_filters: whereConditions,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        // Fallback to simple query
        const { data: simpleLogs } = await database.query('audit_logs', {
          where: whereConditions,
          order: { column: 'timestamp', ascending: false },
          limit: limit,
          offset: offset
        });

        return {
          logs: simpleLogs || [],
          pagination: { page, limit, total: simpleLogs?.length || 0, pages: 1 }
        };
      }

      return {
        logs: logs || [],
        pagination: { page, limit, total: logs?.length || 0, pages: 1 }
      };
    } catch (error) {
      console.error('Audit logs error:', error);
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }
  }

  // Get user management data
  static async getUserManagementData(schoolId) {
    try {
      // Get user stats using Supabase
      const { data: users } = await database.query('users', {
        select: 'role, status, last_login_at',
        where: { school_id: schoolId, is_deleted: false }
      });

      const userStats = {};
      users?.forEach(user => {
        if (!userStats[user.role]) {
          userStats[user.role] = { total: 0, active: 0, recent_logins: 0 };
        }
        userStats[user.role].total++;
        if (user.status === 'active') userStats[user.role].active++;
        
        const lastLogin = new Date(user.last_login_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (lastLogin > weekAgo) userStats[user.role].recent_logins++;
      });

      // Get recent users
      const { data: recentUsers } = await database.query('users', {
        select: 'user_id, full_name, email, role, status, last_login_at, created_at',
        where: { school_id: schoolId, is_deleted: false },
        order: { column: 'created_at', ascending: false },
        limit: 10
      });

      return {
        stats: Object.entries(userStats).map(([role, stats]) => ({ role, ...stats })),
        recentUsers: recentUsers || []
      };
    } catch (error) {
      console.error('User management data error:', error);
      throw new Error(`Failed to get user management data: ${error.message}`);
    }
  }

  // Bulk user operations
  static async bulkUpdateUsers(schoolId, userIds, updates, req) {
    const results = { updated: [], errors: [] };

    try {
      for (const userId of userIds) {
        try {
          // Verify user belongs to school using Supabase
          const { data: users } = await database.query('users', {
            select: 'user_id, full_name, role',
            where: { user_id: userId, school_id: schoolId, is_deleted: false },
            limit: 1
          });

          const user = users?.[0];
          if (!user) {
            results.errors.push({ userId, message: 'User not found' });
            continue;
          }

          // Update user using Supabase
          await database.update('users', 
            { 
              ...updates,
              updated_at: new Date().toISOString() 
            },
            { user_id: userId, school_id: schoolId }
          );
          logTenantQuery("admin.bulk_update_user", {
            table: "users",
            userId,
            schoolId,
            updateKeys: Object.keys(updates || {}),
          });

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

      return results;
    } catch (error) {
      console.error('Bulk update error:', error);
      throw new Error(`Failed to bulk update users: ${error.message}`);
    }
  }
}

export default AdminService;
