import { supabase } from './src/config/supabaseClient.js';
import paymentConfigService from './src/services/payment-config.service.js';

async function debugPaymentConfig() {
  console.log('🔍 Debugging payment config service...');
  
  try {
    // Test with school ID 1
    const schoolId = 1;
    console.log(`\nTesting payment config for school ${schoolId}...`);
    
    // Test getPaymentConfig directly
    console.log('\n1. Testing getPaymentConfig()...');
    const config = await paymentConfigService.getPaymentConfig(schoolId);
    console.log('Config result:', config);
    
    // Test getPaystackConfig
    console.log('\n2. Testing getPaystackConfig()...');
    const paystackConfig = await paymentConfigService.getPaystackConfig(schoolId);
    console.log('Paystack config:', paystackConfig);
    console.log('Secret key exists:', !!paystackConfig.secretKey);
    console.log('Secret key length:', paystackConfig.secretKey?.length || 0);
    
    // Test direct table access
    console.log('\n3. Testing direct table access...');
    try {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
      
      if (error) {
        console.log('Direct table error:', error);
        console.log('Error code:', error.code);
        console.log('Error message:', error.message);
      } else {
        console.log('Direct table data:', data);
      }
    } catch (err) {
      console.log('Direct table exception:', err.message);
    }
    
  } catch (err) {
    console.error('Debug failed:', err);
  }
}

debugPaymentConfig().catch(console.error);
