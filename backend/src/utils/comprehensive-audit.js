import crypto from 'crypto';
import { pgPool } from '../config/pg.js';

// Comprehensive audit logging system for multi-tenant SaaS
export class ComprehensiveAuditLogger {
  constructor(options = {}) {
    this.options = {
      signingKey: options.signingKey || process.env.AUDIT_SIGNING_KEY,
      retentionDays: options.retentionDays || 2555, // 7 years default
      archivalEnabled: options.archivalEnabled || false,
      ...options
    };
  }

  // Create immutable audit record with digital signature
  async createAuditRecord(auditData) {
    try {
      // Add metadata
      const enhancedAuditData = {
        ...auditData,
        audit_id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        version: '1.0',
        sequence_number: await this.getNextSequenceNumber(auditData.school_id)
      };

      // Generate digital signature
      const signature = this.generateAuditSignature(enhancedAuditData);
      
      // Create immutable record
      const result = await pgPool.query(`
        INSERT INTO comprehensive_audit_log (
          audit_id, school_id, user_id, action, entity_type, entity_id,
          old_values, new_values, description, ip_address, user_agent,
          digital_signature, audit_hash, sequence_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING audit_id, digital_signature, audit_hash
      `, [
        enhancedAuditData.audit_id,
        enhancedAuditData.school_id,
        enhancedAuditData.user_id,
        enhancedAuditData.action,
        enhancedAuditData.entity_type,
        enhancedAuditData.entity_id,
        enhancedAuditData.old_values ? JSON.stringify(enhancedAuditData.old_values) : null,
        enhancedAuditData.new_values ? JSON.stringify(enhancedAuditData.new_values) : null,
        enhancedAuditData.description,
        enhancedAuditData.ip_address,
        enhancedAuditData.user_agent,
        signature.signature,
        signature.hash,
        enhancedAuditData.sequence_number,
        enhancedAuditData.timestamp
      ]);

      // Log to archival system if enabled
      if (this.options.archivalEnabled) {
        await this.archiveAuditRecord(result.rows[0]);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create audit record:', error);
      throw new Error('Audit logging failed');
    }
  }

  // Generate unique audit ID
  generateAuditId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `AUD-${timestamp}-${random}`;
  }

  // Get next sequence number for ordering
  async getNextSequenceNumber(schoolId) {
    try {
      const result = await pgPool.query(`
        SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_sequence
        FROM comprehensive_audit_log 
        WHERE school_id = $1
      `, [schoolId]);
      
      return result.rows[0].next_sequence;
    } catch (error) {
      console.error('Failed to get sequence number:', error);
      return 1;
    }
  }

  // Generate digital signature for audit record
  generateAuditSignature(auditData) {
    if (!this.options.signingKey) {
      throw new Error('Audit signing key not configured');
    }

    // Create canonical representation
    const canonicalData = JSON.stringify({
      audit_id: auditData.audit_id,
      school_id: auditData.school_id,
      user_id: auditData.user_id,
      action: auditData.action,
      timestamp: auditData.timestamp,
      sequence_number: auditData.sequence_number
    });

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(canonicalData).digest('hex');

    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', this.options.signingKey)
      .update(canonicalData)
      .digest('hex');

    return {
      hash,
      signature,
      algorithm: 'HMAC-SHA256'
    };
  }

  // Verify audit record integrity
  async verifyAuditIntegrity(auditId) {
    try {
      const result = await pgPool.query(`
        SELECT digital_signature, audit_hash, school_id, user_id, action, 
               timestamp, sequence_number
        FROM comprehensive_audit_log 
        WHERE audit_id = $1
      `, [auditId]);

      if (result.rows.length === 0) {
        throw new Error('Audit record not found');
      }

      const record = result.rows[0];
      
      // Regenerate signature
      const expectedSignature = this.generateAuditSignature({
        audit_id: auditId,
        school_id: record.school_id,
        user_id: record.user_id,
        action: record.action,
        timestamp: record.timestamp,
        sequence_number: record.sequence_number
      });

      // Compare signatures
      const signatureValid = crypto.timingSafeEqual(
        Buffer.from(record.digital_signature, 'hex'),
        Buffer.from(expectedSignature.signature, 'hex')
      );

      const hashValid = record.audit_hash === expectedSignature.hash;

      return {
        signatureValid,
        hashValid,
        isValid: signatureValid && hashValid
      };
    } catch (error) {
      console.error('Audit integrity verification failed:', error);
      return {
        signatureValid: false,
        hashValid: false,
        isValid: false
      };
    }
  }

  // Archive audit record to long-term storage
  async archiveAuditRecord(auditRecord) {
    try {
      // This would integrate with your archival system
      // For now, just log the archival action
      console.log(`Archived audit record: ${auditRecord.audit_id}`);
      
      // In production, this would:
      // - Store in object storage (S3, Azure Blob, etc.)
      // - Compress the record
      // - Update archival status in database
      // - Implement retrieval mechanisms
      
      return true;
    } catch (error) {
      console.error('Audit archival failed:', error);
      return false;
    }
  }

  // Query audit records with integrity verification
  async queryAuditRecords(filters = {}) {
    try {
      let query = `
        SELECT audit_id, school_id, user_id, action, entity_type, entity_id,
               old_values, new_values, description, ip_address, user_agent,
               digital_signature, audit_hash, created_at
        FROM comprehensive_audit_log 
        WHERE 1=1
      `;
      
      const params = [];
      let paramIndex = 1;

      // Add filters
      if (filters.schoolId) {
        query += ` AND school_id = $${paramIndex++}`;
        params.push(filters.schoolId);
      }

      if (filters.userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(filters.userId);
      }

      if (filters.action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(filters.action);
      }

      if (filters.entityType) {
        query += ` AND entity_type = $${paramIndex++}`;
        params.push(filters.entityType);
      }

      if (filters.startDate) {
        query += ` AND created_at >= $${paramIndex++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND created_at <= $${paramIndex++}`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY sequence_number DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      const result = await pgPool.query(query, params);
      
      // Verify integrity of returned records
      const verifiedRecords = [];
      for (const record of result.rows) {
        const integrity = await this.verifyAuditIntegrity(record.audit_id);
        verifiedRecords.push({
          ...record,
          integrityVerified: integrity.isValid
        });
      }

      return verifiedRecords;
    } catch (error) {
      console.error('Audit query failed:', error);
      throw new Error('Failed to query audit records');
    }
  }

  // Implement audit retention policy
  async applyRetentionPolicy() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

      // Archive old records before deletion
      const recordsToArchive = await pgPool.query(`
        SELECT audit_id, school_id, user_id, action, entity_type, entity_id,
               old_values, new_values, description, ip_address, user_agent,
               digital_signature, audit_hash, created_at
        FROM comprehensive_audit_log 
        WHERE created_at < $1
        ORDER BY created_at ASC
      `, [cutoffDate]);

      // Archive each record
      for (const record of recordsToArchive.rows) {
        await this.archiveAuditRecord(record);
      }

      // Delete old records from main table
      const deleteResult = await pgPool.query(`
        DELETE FROM comprehensive_audit_log 
        WHERE created_at < $1
        RETURNING COUNT(*) as deleted_count
      `, [cutoffDate]);

      console.log(`Applied retention policy: archived ${recordsToArchive.rows.length} records, deleted ${deleteResult.rows[0].deleted_count} records`);

      return {
        archived: recordsToArchive.rows.length,
        deleted: deleteResult.rows[0].deleted_count
      };
    } catch (error) {
      console.error('Retention policy application failed:', error);
      throw new Error('Failed to apply retention policy');
    }
  }

  // Generate audit compliance report
  async generateComplianceReport(schoolId, reportType = 'SOX') {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

      const auditRecords = await this.queryAuditRecords({
        schoolId,
        startDate,
        endDate: new Date()
      });

      // Generate report based on compliance requirements
      const report = {
        reportType,
        schoolId,
        period: {
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        summary: {
          totalEvents: auditRecords.length,
          uniqueUsers: new Set(auditRecords.map(r => r.user_id)).size,
          uniqueActions: new Set(auditRecords.map(r => r.action)).size,
          integrityVerified: auditRecords.filter(r => r.integrityVerified).length,
          integrityIssues: auditRecords.filter(r => !r.integrityVerified).length
        },
        events: auditRecords.map(record => ({
          auditId: record.audit_id,
          action: record.action,
          entityType: record.entity_type,
          timestamp: record.created_at,
          userId: record.user_id,
          integrityVerified: record.integrityVerified
        }))
      };

      return report;
    } catch (error) {
      console.error('Compliance report generation failed:', error);
      throw new Error('Failed to generate compliance report');
    }
  }

  // Export audit data for compliance
  async exportAuditData(schoolId, format = 'JSON', filters = {}) {
    try {
      const records = await this.queryAuditRecords({ schoolId, ...filters });
      
      if (format === 'CSV') {
        return this.convertToCSV(records);
      } else if (format === 'XML') {
        return this.convertToXML(records);
      } else {
        return JSON.stringify(records, null, 2);
      }
    } catch (error) {
      console.error('Audit data export failed:', error);
      throw new Error('Failed to export audit data');
    }
  }

  // Convert audit records to CSV
  convertToCSV(records) {
    const headers = [
      'audit_id', 'school_id', 'user_id', 'action', 'entity_type', 
      'entity_id', 'description', 'ip_address', 'created_at'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const record of records) {
      const row = [
        record.audit_id,
        record.school_id,
        record.user_id,
        record.action,
        record.entity_type,
        record.entity_id,
        `"${record.description || ''}"`,
        record.ip_address,
        record.created_at
      ];
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }

  // Convert audit records to XML
  convertToXML(records) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<audit_records>\n';
    
    for (const record of records) {
      xml += '  <record>\n';
      xml += `    <audit_id>${record.audit_id}</audit_id>\n`;
      xml += `    <school_id>${record.school_id}</school_id>\n`;
      xml += `    <user_id>${record.user_id}</user_id>\n`;
      xml += `    <action>${record.action}</action>\n`;
      xml += `    <entity_type>${record.entity_type}</entity_type>\n`;
      xml += `    <entity_id>${record.entity_id}</entity_id>\n`;
      xml += `    <description>${record.description || ''}</description>\n`;
      xml += `    <ip_address>${record.ip_address}</ip_address>\n`;
      xml += `    <created_at>${record.created_at}</created_at>\n`;
      xml += `    <integrity_verified>${record.integrity_verified}</integrity_verified>\n`;
      xml += '  </record>\n';
    }
    
    xml += '</audit_records>';
    return xml;
  }
}

// Audit logging middleware for Express
export function createAuditMiddleware() {
  const auditLogger = new ComprehensiveAuditLogger();
  
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;
    
    // Intercept responses to capture data changes
    res.json = function(data) {
      // Log audit event for data modifications
      if (req.method !== 'GET' && req.user?.schoolId) {
        auditLogger.createAuditRecord({
          school_id: req.user.schoolId,
          user_id: req.user.user_id,
          action: `${req.method.toLowerCase()}.${req.path.replace('/api/', '').replace('/', '.')}`,
          entity_type: getEntityTypeFromPath(req.path),
          entity_id: getEntityIdFromData(data),
          new_values: data,
          description: `${req.method} ${req.path}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }).catch(error => {
          console.error('Audit middleware error:', error);
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Helper functions
function getEntityTypeFromPath(path) {
  if (path.includes('/students')) return 'student';
  if (path.includes('/payments')) return 'payment';
  if (path.includes('/users')) return 'user';
  if (path.includes('/grades')) return 'grade';
  if (path.includes('/classes')) return 'class';
  return 'unknown';
}

function getEntityIdFromData(data) {
  if (data?.student_id) return data.student_id;
  if (data?.payment_id) return data.payment_id;
  if (data?.user_id) return data.user_id;
  if (data?.grade_id) return data.grade_id;
  if (data?.class_id) return data.class_id;
  return null;
}

export default {
  ComprehensiveAuditLogger,
  createAuditMiddleware
};
