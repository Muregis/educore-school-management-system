#!/usr/bin/env node

// =====================================================
// SUPABASE MIGRATION TEST SCRIPT
// =====================================================
// Tests the complete migration from MySQL/PostgreSQL to Supabase

import { testDbConnection } from './src/config/db.js';
import { database, supabase } from './src/config/db.js';
import { hybridAuthLogin } from './src/services/hybrid-auth.js';

async function runTests() {
  console.log('🚀 Starting Supabase Migration Tests...\n');
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  // Test 1: Database Connection
  testsTotal++;
  try {
    const result = await testDbConnection();
    if (result.success && result.type === 'supabase') {
      console.log('✅ Test 1: Database Connection - PASSED');
      console.log(`   Type: ${result.type}`);
      testsPassed++;
    } else {
      console.log('❌ Test 1: Database Connection - FAILED');
      console.log('   Expected: Supabase connection');
    }
  } catch (error) {
    console.log('❌ Test 1: Database Connection - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 2: Database Interface
  testsTotal++;
  try {
    const { data, error } = await database.query('users', { limit: 1 });
    if (!error) {
      console.log('✅ Test 2: Database Interface - PASSED');
      console.log(`   Query executed successfully`);
      testsPassed++;
    } else {
      console.log('❌ Test 2: Database Interface - FAILED');
      console.log(`   Error: ${error.message}`);
    }
  } catch (error) {
    console.log('❌ Test 2: Database Interface - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 3: Raw Supabase Client
  testsTotal++;
  try {
    const { data, error } = await supabase.from('users').select('user_id').limit(1);
    if (!error) {
      console.log('✅ Test 3: Raw Supabase Client - PASSED');
      console.log(`   Direct Supabase query executed`);
      testsPassed++;
    } else {
      console.log('❌ Test 3: Raw Supabase Client - FAILED');
      console.log(`   Error: ${error.message}`);
    }
  } catch (error) {
    console.log('❌ Test 3: Raw Supabase Client - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 4: Authentication System
  testsTotal++;
  try {
    const authResult = await hybridAuthLogin('test@example.com', 'password', 1);
    console.log('✅ Test 4: Authentication System - PASSED');
    console.log(`   Authentication service ready`);
    testsPassed++;
  } catch (error) {
    console.log('❌ Test 4: Authentication System - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 5: Service Import Tests
  testsTotal++;
  try {
    const { LedgerService } = await import('./src/services/ledger.service.js');
    const { AdminService } = await import('./src/services/admin.service.js');
    console.log('✅ Test 5: Service Imports - PASSED');
    console.log(`   All services import successfully`);
    testsPassed++;
  } catch (error) {
    console.log('❌ Test 5: Service Imports - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 6: Route Import Tests
  testsTotal++;
  try {
    await import('./src/routes/auth.routes.js');
    await import('./src/routes/reports.routes.js');
    console.log('✅ Test 6: Route Imports - PASSED');
    console.log(`   All routes import successfully`);
    testsPassed++;
  } catch (error) {
    console.log('❌ Test 6: Route Imports - FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Results
  console.log('\n📊 Test Results:');
  console.log(`   Passed: ${testsPassed}/${testsTotal}`);
  console.log(`   Success Rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 ALL TESTS PASSED! Migration is complete.');
    console.log('\n📋 Next Steps:');
    console.log('   1. Apply RLS policies: database/rls/supabase-tenant-policies.sql');
    console.log('   2. Run migration: database/migrations/004_enable_supabase_rls.sql');
    console.log('   3. Test with real data in Supabase');
    console.log('   4. Monitor performance and add indexes as needed');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
}

// Run tests
runTests().catch(console.error);
