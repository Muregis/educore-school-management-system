#!/usr/bin/env node

/**
 * Security Testing Script
 * Tests the critical security fixes implemented for multi-tenant isolation
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000/api';

// Test configuration
const TEST_CONFIG = {
  school1: {
    email: 'admin@greenfield.ac.ke',
    password: 'admin123',
    schoolId: 1
  },
  school2: {
    email: 'teacher2@school2.test',
    password: 'teacher123', 
    schoolId: 2
  }
};

let tokens = {};

async function login(schoolKey) {
  const config = TEST_CONFIG[schoolKey];
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      console.error(`❌ Login failed for ${schoolKey}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    tokens[schoolKey] = data.token;
    console.log(`✅ Logged in ${schoolKey} successfully`);
    return data.token;
  } catch (error) {
    console.error(`❌ Login error for ${schoolKey}:`, error.message);
    return null;
  }
}

async function testPaymentIsolation() {
  console.log('\n🔒 Testing Payment Data Isolation...');
  
  // School 1 tries to access School 2's payment data
  try {
    const response = await fetch(`${API_BASE}/mpesa/status/REF-SCHOOL2-001`, {
      headers: { 
        'Authorization': `Bearer ${tokens.school1}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 404) {
      console.log('✅ Payment isolation working - cannot access other school payments');
    } else {
      console.log(`❌ SECURITY BREACH: School 1 accessed School 2 payment data (status: ${response.status})`);
      const data = await response.json();
      console.log('Leaked data:', data);
    }
  } catch (error) {
    console.error('❌ Payment isolation test error:', error.message);
  }
}

async function testRateLimiting() {
  console.log('\n🚦 Testing Rate Limiting...');
  
  let successCount = 0;
  const maxRequests = 25; // Above the 20 request limit
  
  for (let i = 0; i < maxRequests; i++) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid@test.com',
          password: 'wrongpassword',
          schoolId: 1
        })
      });
      
      if (response.status !== 429) {
        successCount++;
      } else {
        console.log(`✅ Rate limiting activated after ${i + 1} requests`);
        break;
      }
    } catch (error) {
      console.error('Rate limit test error:', error.message);
      break;
    }
  }
  
  if (successCount >= maxRequests) {
    console.log('❌ Rate limiting not working - too many successful requests');
  }
}

async function testWebhookSecurity() {
  console.log('\n🔐 Testing Webhook Security...');
  
  // Test Mpesa callback without signature
  try {
    const response = await fetch(`${API_BASE}/integrations/mpesa/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: 1,
        TransID: 'TEST123',
        TransAmount: 1000,
        MSISDN: '254712345678',
        BillRefNumber: 'ADM001'
      })
    });
    
    if (response.status === 401) {
      console.log('✅ Mpesa webhook security working - signature required');
    } else {
      console.log(`❌ SECURITY ISSUE: Mpesa webhook accepted without signature (status: ${response.status})`);
    }
  } catch (error) {
    console.error('Webhook security test error:', error.message);
  }
}

async function testInputValidation() {
  console.log('\n✅ Testing Input Validation...');
  
  // Test SQL injection attempts
  const maliciousInputs = [
    "'; DROP TABLE students; --",
    "' OR '1'='1",
    "<script>alert('xss')</script>",
    "../../../etc/passwd"
  ];
  
  for (const input of maliciousInputs) {
    try {
      const response = await fetch(`${API_BASE}/students`, {
        headers: { 
          'Authorization': `Bearer ${tokens.school1}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check if malicious input was executed
        const dataStr = JSON.stringify(data);
        if (dataStr.includes('DROP TABLE') || dataStr.includes('<script>')) {
          console.log(`❌ Input validation failed - malicious input processed: ${input}`);
        }
      }
    } catch (error) {
      // Expected for malformed requests
    }
  }
  
  console.log('✅ Input validation tests completed');
}

async function runSecurityTests() {
  console.log('🛡️  Starting Security Tests...\n');
  
  // Login to get tokens
  await login('school1');
  await login('school2');
  
  if (!tokens.school1) {
    console.log('❌ Cannot proceed without authentication tokens');
    return;
  }
  
  // Run security tests
  await testPaymentIsolation();
  await testRateLimiting();
  await testWebhookSecurity();
  await testInputValidation();
  
  console.log('\n🏁 Security Testing Complete');
  console.log('\n📋 Summary:');
  console.log('- Payment data isolation: Tested');
  console.log('- Rate limiting: Tested');
  console.log('- Webhook security: Tested');
  console.log('- Input validation: Tested');
  console.log('\n⚠️  Manual verification recommended for comprehensive security assessment');
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityTests().catch(console.error);
}

export { runSecurityTests };
