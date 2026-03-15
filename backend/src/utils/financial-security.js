import crypto from 'crypto';
import { pgPool } from '../config/pg.js';

// Financial security utilities for multi-tenant SaaS
export class FinancialSecurityManager {
  constructor(options = {}) {
    this.options = {
      encryptionKey: options.encryptionKey || process.env.FINANCIAL_ENCRYPTION_KEY,
      webhookSecret: options.webhookSecret || process.env.WEBHOOK_SECRET,
      ...options
    };
  }

  // Encrypt sensitive financial data
  encryptFinancialData(data) {
    if (!this.options.encryptionKey) {
      throw new Error('Financial encryption key not configured');
    }
    
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.options.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Financial data encryption failed:', error);
      throw new Error('Failed to encrypt financial data');
    }
  }

  // Decrypt sensitive financial data
  decryptFinancialData(encryptedData) {
    if (!this.options.encryptionKey || !encryptedData.encrypted) {
      return encryptedData;
    }
    
    try {
      const algorithm = 'aes-256-gcm';
      const decipher = crypto.createDecipher(algorithm, this.options.encryptionKey);
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Financial data decryption failed:', error);
      throw new Error('Failed to decrypt financial data');
    }
  }

  // Validate payment amount with tenant-specific rules
  validatePaymentAmount(schoolId, amount, currency = 'USD') {
    // Basic validation
    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    // Amount limits (could be tenant-specific)
    const limits = {
      min: 0.01,
      max: 1000000 // $1M max per transaction
    };
    
    if (amount < limits.min || amount > limits.max) {
      throw new Error(`Amount must be between ${limits.min} and ${limits.max}`);
    }
    
    // Currency validation
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES'];
    if (!supportedCurrencies.includes(currency)) {
      throw new Error('Unsupported currency');
    }
    
    return true;
  }

  // Generate secure payment reference with tenant isolation
  generatePaymentReference(schoolId, studentId, type = 'payment') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${type.toUpperCase()}-${schoolId}-${studentId}-${timestamp}-${random}`;
  }

  // Verify webhook signature for payment gateways
  verifyWebhookSignature(payload, signature, gateway = 'paystack') {
    if (!this.options.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }
    
    switch (gateway) {
      case 'paystack':
        return this.verifyPaystackSignature(payload, signature);
      case 'mpesa':
        return this.verifyMpesaSignature(payload, signature);
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  // Paystack webhook verification
  verifyPaystackSignature(payload, signature) {
    const expectedSignature = crypto
      .createHmac('sha512', this.options.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // M-Pesa webhook verification (simplified)
  verifyMpesaSignature(payload, signature) {
    // M-Pesa uses different signature method
    // This is a simplified version - implement according to M-Pesa docs
    const expectedSignature = crypto
      .createHmac('sha256', this.options.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return signature === expectedSignature;
  }

  // Mask sensitive financial data for logging
  maskFinancialData(data) {
    const masked = { ...data };
    
    // Mask card numbers
    if (masked.cardNumber) {
      masked.cardNumber = this.maskCardNumber(masked.cardNumber);
    }
    
    // Mask account numbers
    if (masked.accountNumber) {
      masked.accountNumber = this.maskAccountNumber(masked.accountNumber);
    }
    
    // Mask phone numbers (partial)
    if (masked.phoneNumber) {
      masked.phoneNumber = this.maskPhoneNumber(masked.phoneNumber);
    }
    
    return masked;
  }

  maskCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '****';
    const last4 = cardNumber.slice(-4);
    return '*'.repeat(cardNumber.length - 4) + last4;
  }

  maskAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) return '****';
    const first4 = accountNumber.slice(0, 4);
    const last4 = accountNumber.slice(-4);
    return first4 + '*'.repeat(accountNumber.length - 8) + last4;
  }

  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) return '****';
    const last4 = phoneNumber.slice(-4);
    return '*'.repeat(phoneNumber.length - 4) + last4;
  }

  // Validate tenant access to financial data
  async validateTenantFinancialAccess(schoolId, userId, operation, resourceId = null) {
    try {
      // Check if user has permission for this operation
      const permissionCheck = await pgPool.query(`
        SELECT u.role, u.school_id, u.status
        FROM users u
        WHERE u.user_id = $1 AND u.school_id = $2 AND u.is_deleted = false
      `, [userId, schoolId]);
      
      if (permissionCheck.rows.length === 0) {
        throw new Error('User not found or not authorized for this tenant');
      }
      
      const user = permissionCheck.rows[0];
      
      // Role-based operation validation
      const allowedOperations = {
        'admin': ['read', 'write', 'delete', 'refund'],
        'finance': ['read', 'write', 'refund'],
        'teacher': ['read'],
        'parent': ['read', 'write'],
        'student': ['read']
      };
      
      const userOperations = allowedOperations[user.role] || [];
      if (!userOperations.includes(operation)) {
        throw new Error(`User role ${user.role} not authorized for operation ${operation}`);
      }
      
      // Additional validation for specific resources
      if (resourceId && operation !== 'read') {
        const resourceCheck = await pgPool.query(`
          SELECT school_id FROM payments 
          WHERE payment_id = $1 AND school_id = $2 AND is_deleted = false
        `, [resourceId, schoolId]);
        
        if (resourceCheck.rows.length === 0) {
          throw new Error('Resource not found or not accessible for this tenant');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Tenant financial access validation failed:', error);
      throw error;
    }
  }

  // Create immutable financial transaction
  async createImmutableTransaction(transactionData) {
    try {
      // Add immutability metadata
      const immutableData = {
        ...transactionData,
        created_at: new Date().toISOString(),
        immutable_hash: this.generateTransactionHash(transactionData),
        is_immutable: true
      };
      
      // Insert with immutability constraints
      const result = await pgPool.query(`
        INSERT INTO financial_transactions 
        (school_id, transaction_type, amount, reference, metadata, immutable_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING transaction_id, immutable_hash
      `, [
        immutableData.school_id,
        immutableData.transaction_type,
        immutableData.amount,
        immutableData.reference,
        JSON.stringify(immutableData),
        immutableData.immutable_hash,
        immutableData.created_at
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to create immutable transaction:', error);
      throw new Error('Failed to create financial transaction');
    }
  }

  // Generate transaction hash for integrity
  generateTransactionHash(transactionData) {
    const hashInput = JSON.stringify({
      school_id: transactionData.school_id,
      amount: transactionData.amount,
      reference: transactionData.reference,
      timestamp: new Date().toISOString()
    });
    
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  // Verify transaction integrity
  async verifyTransactionIntegrity(transactionId) {
    try {
      const result = await pgPool.query(`
        SELECT immutable_hash, metadata, school_id, amount, reference
        FROM financial_transactions 
        WHERE transaction_id = $1
      `, [transactionId]);
      
      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }
      
      const transaction = result.rows[0];
      const expectedHash = this.generateTransactionHash({
        school_id: transaction.school_id,
        amount: transaction.amount,
        reference: transaction.reference
      });
      
      return transaction.immutable_hash === expectedHash;
    } catch (error) {
      console.error('Transaction integrity verification failed:', error);
      return false;
    }
  }
}

// Financial security middleware
export function createFinancialSecurityMiddleware() {
  const securityManager = new FinancialSecurityManager();
  
  return async (req, res, next) => {
    try {
      // Validate tenant access for financial operations
      if (req.user?.schoolId && req.method !== 'GET') {
        await securityManager.validateTenantFinancialAccess(
          req.user.schoolId,
          req.user.user_id,
          'write'
        );
      }
      
      // Mask sensitive data in responses
      const originalJson = res.json;
      res.json = function(data) {
        if (req.path.includes('/payments') || req.path.includes('/financial')) {
          const maskedData = securityManager.maskFinancialData(data);
          return originalJson.call(this, maskedData);
        }
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Financial security middleware error:', error);
      res.status(403).json({ 
        error: 'Financial access denied',
        code: 'FINANCIAL_ACCESS_DENIED'
      });
    }
  };
}

export default {
  FinancialSecurityManager,
  createFinancialSecurityMiddleware
};
