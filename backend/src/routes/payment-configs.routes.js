import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import paymentConfigService from "../services/payment-config.service.js";

const router = Router();
router.use(authRequired);

// ─── GET payment configuration for school ────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const config = await paymentConfigService.getPaymentConfig(schoolId);
    
    if (!config) {
      return res.json({
        exists: false,
        message: "No payment configuration found. Please configure payment settings."
      });
    }

    // Return config without sensitive data for non-admin users
    const { is_admin, role } = req.user;
    let safeConfig = { ...config };
    
    if (!is_admin && role !== 'admin') {
      // Hide sensitive credentials from non-admin users
      delete safeConfig.mpesa_consumer_key;
      delete safeConfig.mpesa_consumer_secret;
      delete safeConfig.mpesa_passkey;
      delete safeConfig.paystack_secret_key;
    }

    res.json({
      exists: true,
      config: safeConfig
    });
  } catch (err) { next(err); }
});

// ─── UPSERT payment configuration ───────────────────────────────────────────────
router.put("/", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const {
      // M-Pesa Configuration
      mpesaTillNumber,
      mpesaPaybill,
      mpesaShortcode,
      mpesaConsumerKey,
      mpesaConsumerSecret,
      mpesaPasskey,
      mpesaEnvironment = 'sandbox',
      mpesaBaseUrl,
      mpesaCallbackBaseUrl,
      
      // Paystack Configuration
      paystackPublicKey,
      paystackSecretKey,
      paystackEnvironment = 'test',
      paystackCallbackUrl,
      
      // Bank Configuration
      bankAccountNumber,
      bankName,
      bankBranch,
      accountName,
      
      // SMS Configuration
      smsEnabled = false,
      smsSenderId,
      
      // WhatsApp Configuration
      whatsappEnabled = false,
      whatsappApiUrl,
      whatsappPhoneNumberId,
      whatsappToken,
      whatsappBusinessAccountId
    } = req.body;

    const configData = {
      // M-Pesa
      mpesa_till_number: mpesaTillNumber,
      mpesa_paybill: mpesaPaybill,
      mpesa_shortcode: mpesaShortcode,
      mpesa_consumer_key: mpesaConsumerKey,
      mpesa_consumer_secret: mpesaConsumerSecret,
      mpesa_passkey: mpesaPasskey,
      mpesa_environment: mpesaEnvironment,
      mpesa_base_url: mpesaBaseUrl,
      mpesa_callback_base_url: mpesaCallbackBaseUrl,
      
      // Paystack
      paystack_public_key: paystackPublicKey,
      paystack_secret_key: paystackSecretKey,
      paystack_environment: paystackEnvironment,
      paystack_callback_url: paystackCallbackUrl,
      
      // Bank
      bank_account_number: bankAccountNumber,
      bank_name: bankName,
      bank_branch: bankBranch,
      account_name: accountName,
      
      // SMS
      sms_enabled: smsEnabled,
      sms_sender_id: smsSenderId,
      
      // WhatsApp
      whatsapp_enabled: whatsappEnabled,
      whatsapp_api_url: whatsappApiUrl,
      whatsapp_phone_number_id: whatsappPhoneNumberId,
      whatsapp_token: whatsappToken,
      whatsapp_business_account_id: whatsappBusinessAccountId,
      
      is_active: true,
      is_deleted: false
    };

    const updatedConfig = await paymentConfigService.upsertPaymentConfig(schoolId, configData);

    res.json({
      success: true,
      message: "Payment configuration updated successfully",
      config: updatedConfig
    });
  } catch (err) { next(err); }
});

// ─── TEST payment configuration ─────────────────────────────────────────────────
router.post("/test", requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { provider } = req.body; // 'mpesa' or 'paystack'

    if (!provider || !['mpesa', 'paystack'].includes(provider)) {
      return res.status(400).json({ 
        message: "Provider must be 'mpesa' or 'paystack'" 
      });
    }

    const config = await paymentConfigService.getPaymentConfig(schoolId);
    
    if (!config) {
      return res.status(404).json({ 
        message: "No payment configuration found for this school" 
      });
    }

    let testResult;
    
    if (provider === 'mpesa') {
      const mpesaConfig = await paymentConfigService.getMpesaConfig(schoolId);
      const isValid = paymentConfigService.validateConfig(mpesaConfig, 'mpesa');
      
      testResult = {
        provider: 'mpesa',
        valid: isValid,
        config: {
          hasConsumerKey: !!mpesaConfig.consumerKey,
          hasConsumerSecret: !!mpesaConfig.consumerSecret,
          hasShortcode: !!mpesaConfig.shortcode,
          hasPasskey: !!mpesaConfig.passkey,
          environment: mpesaConfig.environment
        }
      };
    } else if (provider === 'paystack') {
      const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);
      const isValid = paymentConfigService.validateConfig(paystackConfig, 'paystack');
      
      testResult = {
        provider: 'paystack',
        valid: isValid,
        config: {
          hasPublicKey: !!paystackConfig.publicKey,
          hasSecretKey: !!paystackConfig.secretKey,
          environment: paystackConfig.environment
        }
      };
    }

    res.json({
      success: true,
      test: testResult
    });
  } catch (err) { next(err); }
});

// ─── DELETE payment configuration ───────────────────────────────────────────────
router.delete("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('payment_configs')
      .update({ 
        is_deleted: true, 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('school_id', schoolId);

    if (error) throw error;

    res.json({
      success: true,
      message: "Payment configuration deleted successfully"
    });
  } catch (err) { next(err); }
});

export default router;
