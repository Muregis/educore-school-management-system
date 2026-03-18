import { supabase } from '../config/supabaseClient.js';

/**
 * Payment Configuration Service
 * Handles multi-tenant payment provider configurations
 */

class PaymentConfigService {
  /**
   * Get payment configuration for a school
   * @param {number} schoolId - School ID
   * @returns {Promise<Object>} Payment configuration
   */
  async getPaymentConfig(schoolId) {
    try {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .maybeSingle();

      if (error) {
        console.error('Error fetching payment config:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Payment config service error:', err);
      return null;
    }
  }

  /**
   * Get M-Pesa credentials for a school
   * @param {number} schoolId - School ID
   * @returns {Promise<Object>} M-Pesa configuration
   */
  async getMpesaConfig(schoolId) {
    const config = await this.getPaymentConfig(schoolId);
    
    if (!config) {
      console.warn(`No payment config found for school ${schoolId}, using global fallback`);
      // Fallback to global credentials (temporary)
      return {
        consumerKey: process.env.MPESA_CONSUMER_KEY || '',
        consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
        shortcode: process.env.MPESA_SHORTCODE || '174379',
        passkey: process.env.MPESA_PASSKEY || '',
        baseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
        callbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || '',
        environment: config?.mpesa_environment || 'sandbox'
      };
    }

    return {
      consumerKey: config.mpesa_consumer_key || process.env.MPESA_CONSUMER_KEY,
      consumerSecret: config.mpesa_consumer_secret || process.env.MPESA_CONSUMER_SECRET,
      shortcode: config.mpesa_shortcode || process.env.MPESA_SHORTCODE,
      passkey: config.mpesa_passkey || process.env.MPESA_PASSKEY,
      baseUrl: config.mpesa_base_url || process.env.MPESA_BASE_URL,
      callbackBaseUrl: config.mpesa_callback_base_url || process.env.MPESA_CALLBACK_BASE_URL,
      environment: config.mpesa_environment || 'sandbox',
      tillNumber: config.mpesa_till_number,
      paybill: config.mpesa_paybill
    };
  }

  /**
   * Get Paystack credentials for a school
   * @param {number} schoolId - School ID
   * @returns {Promise<Object>} Paystack configuration
   */
  async getPaystackConfig(schoolId) {
    const config = await this.getPaymentConfig(schoolId);
    
    if (!config) {
      console.warn(`No payment config found for school ${schoolId}, using global fallback`);
      // Fallback to global credentials (temporary)
      return {
        secretKey: process.env.PAYSTACK_SECRET_KEY || '',
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
        callbackUrl: process.env.PAYSTACK_CALLBACK_URL || '',
        environment: 'test'
      };
    }

    return {
      secretKey: config.paystack_secret_key || process.env.PAYSTACK_SECRET_KEY,
      publicKey: config.paystack_public_key || process.env.PAYSTACK_PUBLIC_KEY,
      callbackUrl: config.paystack_callback_url || process.env.PAYSTACK_CALLBACK_URL,
      environment: config.paystack_environment || 'test'
    };
  }

  /**
   * Get SMS configuration for a school
   * @param {number} schoolId - School ID
   * @returns {Promise<Object>} SMS configuration
   */
  async getSmsConfig(schoolId) {
    const config = await this.getPaymentConfig(schoolId);
    
    return {
      enabled: config?.sms_enabled || false,
      senderId: config?.sms_sender_id || 'EDUCORE',
      // Global Africa's Talking credentials (can be made per-school later)
      apiKey: process.env.AT_API_KEY || '',
      username: process.env.AT_USERNAME || ''
    };
  }

  /**
   * Create or update payment configuration for a school
   * @param {number} schoolId - School ID
   * @param {Object} configData - Configuration data
   * @returns {Promise<Object>} Updated configuration
   */
  async upsertPaymentConfig(schoolId, configData) {
    try {
      const { data, error } = await supabase
        .from('payment_configs')
        .upsert({
          school_id: schoolId,
          ...configData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'school_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting payment config:', error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Payment config upsert error:', err);
      throw err;
    }
  }

  /**
   * Validate payment configuration completeness
   * @param {Object} config - Payment configuration
   * @param {string} provider - Payment provider ('mpesa' or 'paystack')
   * @returns {boolean} Is configuration valid
   */
  validateConfig(config, provider) {
    if (!config) return false;

    switch (provider) {
      case 'mpesa':
        return !!(config.consumerKey && config.consumerSecret && 
                 config.shortcode && config.passkey);
      
      case 'paystack':
        return !!(config.secretKey && config.publicKey);
      
      default:
        return false;
    }
  }
}

export default new PaymentConfigService();
