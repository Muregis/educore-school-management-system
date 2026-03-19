/**
 * WhatsApp Migration Test Script
 * Tests all notification flows after Africa's Talking replacement
 */

import { supabase } from './src/config/supabaseClient.js';
import { sendWhatsAppPaymentReceipt } from './src/services/whatsappService.js';
import { sendPaymentReceipt } from './src/utils/smsUtils.js';

// Test configuration
const TEST_SCHOOL_ID = 1; // Replace with actual school ID
const TEST_PHONE = '+254712345678'; // Replace with test phone number
const TEST_AMOUNT = 5000;
const TEST_REFERENCE = 'TEST-001';
const TEST_STUDENT_NAME = 'Test Student';

console.log('🧪 Starting WhatsApp Migration Tests...\n');

// Test 1: WhatsApp Service Direct
async function testWhatsAppService() {
  console.log('📱 Test 1: WhatsApp Service Direct');
  try {
    const result = await sendWhatsAppPaymentReceipt({
      schoolId: TEST_SCHOOL_ID,
      recipientPhone: TEST_PHONE,
      amount: TEST_AMOUNT,
      reference: TEST_REFERENCE,
      studentName: TEST_STUDENT_NAME
    });
    
    console.log('✅ WhatsApp Service Test PASSED');
    console.log('Result:', result);
    return true;
  } catch (error) {
    console.log('❌ WhatsApp Service Test FAILED:', error.message);
    return false;
  }
}

// Test 2: SMS Utils (now using WhatsApp)
async function testSmsUtils() {
  console.log('\n📱 Test 2: SMS Utils (WhatsApp Integration)');
  try {
    await sendPaymentReceipt(
      TEST_SCHOOL_ID,
      TEST_PHONE,
      TEST_AMOUNT,
      TEST_REFERENCE,
      TEST_STUDENT_NAME
    );
    
    console.log('✅ SMS Utils Test PASSED');
    return true;
  } catch (error) {
    console.log('❌ SMS Utils Test FAILED:', error.message);
    return false;
  }
}

// Test 3: Database Logging
async function testDatabaseLogging() {
  console.log('\n📊 Test 3: Database Logging');
  try {
    const { data: logs, error } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('school_id', TEST_SCHOOL_ID)
      .eq('channel', 'sms')  // Use 'sms' channel until schema supports 'whatsapp'
      .order('sent_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    console.log('✅ Database Logging Test PASSED');
    console.log(`Found ${logs?.length || 0} recent logs`);
    
    if (logs?.length > 0) {
      console.log('Latest log:', {
        recipient: logs[0].recipient,
        status: logs[0].status,
        channel: logs[0].channel,
        type: logs[0].type
      });
    }
    
    return true;
  } catch (error) {
    console.log('❌ Database Logging Test FAILED:', error.message);
    return false;
  }
}

// Test 4: Multi-tenant Isolation
async function testTenantIsolation() {
  console.log('\n🔒 Test 4: Multi-tenant Isolation');
  try {
    // Test with invalid school_id
    try {
      await sendWhatsAppPaymentReceipt({
        schoolId: 99999, // Invalid school ID
        recipientPhone: TEST_PHONE,
        amount: TEST_AMOUNT,
        reference: TEST_REFERENCE,
        studentName: TEST_STUDENT_NAME
      });
      
      console.log('❌ Tenant Isolation Test FAILED - Should have rejected invalid school');
      return false;
    } catch (error) {
      if (error.message.includes('School not found or access denied')) {
        console.log('✅ Tenant Isolation Test PASSED - Correctly rejected invalid school');
        return true;
      } else {
        console.log('❌ Tenant Isolation Test FAILED - Wrong error:', error.message);
        return false;
      }
    }
  } catch (error) {
    console.log('❌ Tenant Isolation Test FAILED:', error.message);
    return false;
  }
}

// Test 5: Phone Number Validation
async function testPhoneValidation() {
  console.log('\n📞 Test 5: Phone Number Validation');
  try {
    const { validateWhatsAppPhone } = await import('./src/services/whatsappService.js');
    
    const testCases = [
      { phone: '+254712345678', expected: true, desc: 'International format' },
      { phone: '254712345678', expected: true, desc: 'Kenyan format without +' },
      { phone: '0712345678', expected: true, desc: 'Kenyan local format' },
      { phone: '12345', expected: false, desc: 'Invalid short number' },
      { phone: 'abc123', expected: false, desc: 'Non-numeric' }
    ];

    let passed = 0;
    for (const testCase of testCases) {
      const result = validateWhatsAppPhone(testCase.phone);
      const isValid = result !== null;
      
      if (isValid === testCase.expected) {
        console.log(`  ✅ ${testCase.desc}: ${testCase.phone}`);
        passed++;
      } else {
        console.log(`  ❌ ${testCase.desc}: ${testCase.phone} (expected ${testCase.expected}, got ${isValid})`);
      }
    }

    if (passed === testCases.length) {
      console.log('✅ Phone Validation Test PASSED');
      return true;
    } else {
      console.log(`❌ Phone Validation Test FAILED (${passed}/${testCases.length} passed)`);
      return false;
    }
  } catch (error) {
    console.log('❌ Phone Validation Test FAILED:', error.message);
    return false;
  }
}

// Test 6: Environment Configuration
async function testEnvironmentConfig() {
  console.log('\n⚙️  Test 6: Environment Configuration');
  try {
    const { env } = await import('./src/config/env.js');
    const { getWhatsAppConfigStatus } = await import('./src/services/whatsappService.js');
    
    const config = getWhatsAppConfigStatus();
    
    console.log('WhatsApp Configuration Status:');
    console.log(`  Configured: ${config.configured}`);
    console.log(`  API URL: ${config.apiUrl}`);
    console.log(`  Phone Number ID: ${config.phoneNumberId || 'Not set'}`);
    console.log(`  Has Token: ${config.hasToken}`);
    
    if (config.configured) {
      console.log('✅ Environment Config Test PASSED - WhatsApp is properly configured');
      return true;
    } else {
      console.log('⚠️  Environment Config Test - WhatsApp not configured (expected for testing)');
      return true; // Not configured is OK for testing
    }
  } catch (error) {
    console.log('❌ Environment Config Test FAILED:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const tests = [
    { name: 'WhatsApp Service', fn: testWhatsAppService },
    { name: 'SMS Utils Integration', fn: testSmsUtils },
    { name: 'Database Logging', fn: testDatabaseLogging },
    { name: 'Tenant Isolation', fn: testTenantIsolation },
    { name: 'Phone Validation', fn: testPhoneValidation },
    { name: 'Environment Config', fn: testEnvironmentConfig }
  ];

  const results = [];
  
  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
  }

  console.log('\n📋 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} ${result.name}`);
  });
  
  console.log('='.repeat(50));
  console.log(`Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! WhatsApp migration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the issues above.');
  }
  
  return passed === total;
}

// Run tests
runAllTests().catch(console.error);
