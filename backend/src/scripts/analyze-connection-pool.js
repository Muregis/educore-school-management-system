import { pgPool } from '../config/pg.js';
import { pool as mysqlPool } from '../config/db.js';

async function analyzeConnectionPoolSafety() {
  console.log('🔍 Phase 5: Connection Pool Safety Analysis');
  
  try {
    console.log('\n📊 PostgreSQL Connection Pool Analysis:');
    
    // Check PostgreSQL pool configuration
    const pgConfig = pgPool.options;
    console.log('✅ PostgreSQL Pool Config:');
    console.log(`  Max Connections: ${pgConfig.max || 'Not set'}`);
    console.log(`  SSL Enabled: ${pgConfig.ssl ? 'Yes' : 'No'}`);
    console.log(`  Connection String: ${pgConfig.connectionString ? 'Yes' : 'Direct'}`);
    
    // Check session reset implementation
    console.log('\n🔒 Tenant Session Reset Analysis:');
    const hasSessionReset = pgPool._events && 
                           (pgPool._events.connect || pgPool._events.acquire);
    
    if (hasSessionReset) {
      console.log('✅ Session reset implemented on connect/acquire events');
    } else {
      console.log('❌ Session reset NOT implemented - RISK of tenant contamination');
    }
    
    // Check MySQL pool configuration (if used)
    console.log('\n📊 MySQL Connection Pool Analysis:');
    const mysqlConfig = mysqlPool.config;
    console.log('✅ MySQL Pool Config:');
    console.log(`  Connection Limit: ${mysqlConfig.connectionLimit}`);
    console.log(`  Wait For Connections: ${mysqlConfig.waitForConnections}`);
    console.log(`  Queue Limit: ${mysqlConfig.queueLimit}`);
    
    // Analyze pool safety risks
    console.log('\n⚠️  Connection Pool Safety Risks:');
    
    // Risk 1: Tenant context contamination
    if (!hasSessionReset) {
      console.log('❌ HIGH RISK: Tenant context can leak between requests');
    }
    
    // Risk 2: Connection pool size
    const pgMaxConnections = pgConfig.max || 10;
    if (pgMaxConnections < 20) {
      console.log('⚠️  MEDIUM RISK: Pool size may be insufficient for multi-tenant scale');
    }
    
    // Risk 3: No connection timeout
    if (!pgConfig.connectionTimeoutMillis) {
      console.log('⚠️  MEDIUM RISK: No connection timeout configured');
    }
    
    // Risk 4: No idle timeout
    if (!pgConfig.idleTimeoutMillis) {
      console.log('⚠️  LOW RISK: No idle timeout configured');
    }
    
    console.log('\n🔧 Recommended Safety Improvements:');
    
    if (!hasSessionReset) {
      console.log('1. Implement session reset on connection acquire/release');
    }
    
    if (pgMaxConnections < 20) {
      console.log('2. Increase pool size for multi-tenant workload');
    }
    
    if (!pgConfig.connectionTimeoutMillis) {
      console.log('3. Add connection timeout (30s recommended)');
    }
    
    if (!pgConfig.idleTimeoutMillis) {
      console.log('4. Add idle timeout (30000ms recommended)');
    }
    
    console.log('\n📋 Connection Pool Safety Score:');
    let score = 100;
    
    if (!hasSessionReset) score -= 40;
    if (pgMaxConnections < 20) score -= 20;
    if (!pgConfig.connectionTimeoutMillis) score -= 15;
    if (!pgConfig.idleTimeoutMillis) score -= 10;
    
    console.log(`🎯 Current Score: ${score}/100`);
    
    if (score >= 80) {
      console.log('✅ GOOD: Connection pool is reasonably safe');
    } else if (score >= 60) {
      console.log('⚠️  NEEDS IMPROVEMENT: Some safety measures missing');
    } else {
      console.log('❌ POOR: Major security risks present');
    }
    
  } catch (error) {
    console.error('❌ Connection pool analysis failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeConnectionPoolSafety()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { analyzeConnectionPoolSafety };
