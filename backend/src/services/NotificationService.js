import { database } from "../config/db.js";
import { sendEmail } from "./email.service.js";
import { sendWhatsAppPaymentReceipt } from "./whatsappService.js";

/**
 * Notification Service
 * Handles automated notifications and reminders
 */
export class NotificationService {
  /**
   * Queue a notification for sending
   */
  static async queueNotification(schoolId, options) {
    const {
      recipientType = 'parent',
      message,
      channel = 'sms',
      scheduledAt = null,
      metadata = {}
    } = options;
    
    try {
      const { data: notification } = await database.insert('notification_queue', {
        school_id: schoolId,
        recipient_type: recipientType,
        message,
        channel,
        scheduled_at: scheduledAt,
        metadata
      });
      
      return notification[0];
    } catch (error) {
      console.error('Queue notification error:', error);
      throw error;
    }
  }
  
  /**
   * Send fee reminder to parents
   */
  static async sendFeeReminder(schoolId, studentId, amount, channel = 'sms') {
    try {
      const { data: student } = await database.query('students', {
        where: { student_id: studentId, school_id: schoolId },
        limit: 1
      });
      
      if (!student || student.length === 0) {
        return { success: false, error: 'Student not found' };
      }

      const parentPhone = student[0].parent_phone;
      const parentEmail = student[0].parent_email;
      const studentName = `${student[0].first_name} ${student[0].last_name}`;
      
      let message = `Fee reminder for ${studentName}: KES ${amount.toLocaleString()} is outstanding. Please pay to avoid disruption.`;
      
      if (channel === 'email' && parentEmail) {
        await sendEmail({
          to: parentEmail,
          subject: 'Fee Reminder - EduCore',
          html: this.formatFeeReminderEmail(studentName, amount),
          schoolId,
          sentByUserId: null
        });
      } else if (channel === 'whatsapp' && parentPhone) {
        // WhatsApp implementation would go here
        // Using SMS as fallback
        channel = 'sms';
      }
      
      if (channel === 'sms' && parentPhone) {
        // Queue SMS via Africa's Talking or other provider
        await this.queueNotification(schoolId, {
          recipientType: 'parent',
          message,
          channel: 'sms',
          metadata: { studentId, amount, type: 'fee_reminder' }
        });
      }
      
      return { success: true, channel, message };
    } catch (error) {
      console.error('Send fee reminder error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send bulk fee reminders to all parents with outstanding balances
   */
  static async sendBulkFeeReminders(schoolId, options = {}) {
    const { minBalance = 100, channel = 'sms', dryRun = false } = options;
    
    try {
      // Get students with outstanding balances
      const students = await this.getStudentsWithOutstandingBalances(schoolId, minBalance);
      
      if (students.length === 0) {
        return { success: true, sent: 0, message: 'No outstanding balances found' };
      }
      
      const results = [];
      
      for (const student of students) {
        if (dryRun) {
          results.push({
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            balance: student.balance,
            wouldSend: true
          });
        } else {
          const result = await this.sendFeeReminder(schoolId, student.student_id, student.balance, channel);
          results.push({
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            balance: student.balance,
            success: result.success,
            channel
          });
        }
      }
      
      return {
        success: true,
        sent: results.filter(r => r.success || r.wouldSend).length,
        total: students.length,
        results
      };
    } catch (error) {
      console.error('Send bulk fee reminders error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get students with outstanding balances
   */
  static async getStudentsWithOutstandingBalances(schoolId, minBalance = 0) {
    try {
      // Calculate balances using ledger
      const { data: payments } = await database.query('payments', {
        where: { school_id: schoolId, status: 'paid', is_deleted: false }
      });
      
      const { data: students } = await database.query('students', {
        where: { school_id: schoolId, is_deleted: false, status: 'active' }
      });
      
      if (!students || students.length === 0) {
        return [];
      }
      
      // For now, use invoice balances as fallback
      // In production, this should use the ledger
      const { data: invoices } = await database.query('invoices', {
        where: { school_id: schoolId, is_deleted: false }
      });
      
      const studentBalances = {};
      
      // Calculate total balance per student from invoices
      (invoices || []).forEach(invoice => {
        if (!studentBalances[invoice.student_id]) {
          studentBalances[invoice.student_id] = 0;
        }
        studentBalances[invoice.student_id] += Number(invoice.balance || 0);
      });
      
      // Filter students with outstanding balances
      return students
        .map(student => ({
          ...student,
          balance: studentBalances[student.student_id] || 0
        }))
        .filter(student => student.balance >= minBalance);
    } catch (error) {
      console.error('Get students with outstanding balances error:', error);
      return [];
    }
  }
  
  /**
   * Process pending notifications in queue
   */
  static async processNotificationQueue(schoolId, limit = 50) {
    try {
      const { data: pending } = await database.query('notification_queue', {
        where: {
          school_id: schoolId,
          status: 'pending',
          scheduled_at: { '<=': new Date().toISOString() }
        },
        limit,
        order: { column: 'created_at', ascending: true }
      });
      
      if (!pending || pending.length === 0) {
        return { processed: 0, message: 'No pending notifications' };
      }
      
      const processed = [];
      
      for (const notification of pending) {
        try {
          let success = false;
          let error = null;
          
          if (notification.channel === 'email') {
            // Send email notification
            const result = await sendEmail({
              to: notification.recipient_type,
              subject: 'Notification from EduCore',
              html: notification.message,
              schoolId,
              sentByUserId: null
            });
            success = result.sent > 0;
          } else if (notification.channel === 'sms') {
            // Queue for SMS sending
            // Implementation depends on SMS provider
            success = true; // Mark as sent for now
          }
          
          // Update notification status
          await database.update('notification_queue', {
            status: success ? 'sent' : 'failed',
            sent_at: success ? new Date().toISOString() : null,
            error_message: error
          }, {
            queue_id: notification.queue_id
          });
          
          processed.push({
            queueId: notification.queue_id,
            success,
            channel: notification.channel
          });
        } catch (error) {
          await database.update('notification_queue', {
            status: 'failed',
            error_message: error.message
          }, {
            queue_id: notification.queue_id
          });
          
          processed.push({
            queueId: notification.queue_id,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        processed: processed.length,
        successful: processed.filter(p => p.success).length,
        failed: processed.filter(p => !p.success).length,
        results: processed
      };
    } catch (error) {
      console.error('Process notification queue error:', error);
      return { processed: 0, error: error.message };
    }
  }
  
  /**
   * Format fee reminder email
   */
  formatFeeReminderEmail(studentName, amount) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0F2040, #1a3a6b); padding: 20px; text-align: center;">
          <h1 style="color: #C9A84C; margin: 0;">EduCore School</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Fee Payment Reminder</h2>
          <p>Dear Parent/Guardian,</p>
          <p>This is a friendly reminder that your child, <strong>${studentName}</strong>, has an outstanding fee balance.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;">
              <strong>Outstanding Balance:</strong> KES ${amount.toLocaleString()}
            </p>
          </div>
          <p>Please log in to the parent portal to make the payment, or visit the school office.</p>
          <p>Thank you for your cooperation.</p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;
  }
}

export default NotificationService;
