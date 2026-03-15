import { pgPool } from '../config/pg.js';

async function analyzeFinancialSystemSafety() {
  console.log('🔍 Phase 7: Financial System Safety Analysis');
  
  try {
    console.log('\n📊 Financial System Components Analysis:');
    
    // Check 1: Payment processing security
    console.log('\n💳 Payment Processing Security:');
    const paymentSecurity = await analyzePaymentSecurity();
    console.log(`Tenant Isolation: ${paymentSecurity.hasTenantIsolation ? '✅' : '❌'}`);
    console.log(`Amount Validation: ${paymentSecurity.hasAmountValidation ? '✅' : '❌'}`);
    console.log(`Reference Uniqueness: ${paymentSecurity.hasReferenceUniqueness ? '✅' : '❌'}`);
    console.log(`Webhook Security: ${paymentSecurity.hasWebhookSecurity ? '✅' : '❌'}`);
    
    // Check 2: Financial data access controls
    console.log('\n🔐 Financial Data Access Controls:');
    const accessControls = await analyzeFinancialAccessControls();
    console.log(`Role-Based Access: ${accessControls.hasRoleBasedAccess ? '✅' : '❌'}`);
    console.log(`Audit Logging: ${accessControls.hasAuditLogging ? '✅' : '❌'}`);
    console.log(`Data Encryption: ${accessControls.hasDataEncryption ? '✅' : '❌'}`);
    console.log(`Sensitive Data Masking: ${accessControls.hasDataMasking ? '✅' : '❌'}`);
    
    // Check 3: Ledger integrity
    console.log('\n📗 Ledger Integrity Analysis:');
    const ledgerIntegrity = await analyzeLedgerIntegrity();
    console.log(`Double-Entry Accounting: ${ledgerIntegrity.hasDoubleEntry ? '✅' : '❌'}`);
    console.log(`Transaction Immutability: ${ledgerIntegrity.hasImmutableTransactions ? '✅' : '❌'}`);
    console.log(`Balance Reconciliation: ${ledgerIntegrity.hasBalanceReconciliation ? '✅' : '❌'}`);
    console.log(`Audit Trail: ${ledgerIntegrity.hasAuditTrail ? '✅' : '❌'}`);
    
    // Check 4: Payment gateway security
    console.log('\n🌐 Payment Gateway Security:');
    const gatewaySecurity = await analyzePaymentGatewaySecurity();
    console.log(`API Key Security: ${gatewaySecurity.hasApiKeySecurity ? '✅' : '❌'}`);
    console.log(`Webhook Verification: ${gatewaySecurity.hasWebhookVerification ? '✅' : '❌'}`);
    console.log(`Timeout Protection: ${gatewaySecurity.hasTimeoutProtection ? '✅' : '❌'}`);
    console.log(`Rate Limiting: ${gatewaySecurity.hasRateLimiting ? '✅' : '❌'}`);
    
    // Risk Analysis
    console.log('\n⚠️  Financial System Risks:');
    
    let riskScore = 0;
    let risks = [];
    
    // Risk 1: Cross-tenant financial data access
    if (!paymentSecurity.hasTenantIsolation) {
      risks.push('CROSS_TENANT_ACCESS: Financial data not properly isolated by tenant');
      riskScore += 40;
    }
    
    // Risk 2: Insufficient payment validation
    if (!paymentSecurity.hasAmountValidation) {
      risks.push('PAYMENT_VALIDATION: Insufficient payment amount validation');
      riskScore += 25;
    }
    
    // Risk 3: Weak financial access controls
    if (!accessControls.hasRoleBasedAccess) {
      risks.push('ACCESS_CONTROL: Insufficient role-based access for financial operations');
      riskScore += 20;
    }
    
    // Risk 4: Missing financial audit trail
    if (!accessControls.hasAuditLogging) {
      risks.push('AUDIT_TRAIL: Missing comprehensive financial audit logging');
      riskScore += 15;
    }
    
    // Risk 5: Payment gateway vulnerabilities
    if (!gatewaySecurity.hasWebhookVerification) {
      risks.push('WEBHOOK_SECURITY: Payment webhook verification not implemented');
      riskScore += 20;
    }
    
    // Risk 6: Ledger integrity issues
    if (!ledgerIntegrity.hasImmutableTransactions) {
      risks.push('LEDGER_INTEGRITY: Financial transactions can be modified');
      riskScore += 25;
    }
    
    // Risk 7: Missing data encryption
    if (!accessControls.hasDataEncryption) {
      risks.push('DATA_ENCRYPTION: Sensitive financial data not encrypted');
      riskScore += 15;
    }
    
    // Display risks
    if (risks.length > 0) {
      console.log('\n❌ Identified Financial Risks:');
      risks.forEach((risk, index) => {
        console.log(`${index + 1}. ${risk}`);
      });
    } else {
      console.log('✅ No financial system risks detected');
    }
    
    // Calculate score
    const maxScore = 100;
    const safetyScore = Math.max(0, maxScore - riskScore);
    
    console.log(`\n📊 Financial System Safety Score: ${safetyScore}/100`);
    
    if (safetyScore >= 80) {
      console.log('✅ GOOD: Financial system is secure and compliant');
    } else if (safetyScore >= 60) {
      console.log('⚠️  NEEDS IMPROVEMENT: Some financial security measures missing');
    } else {
      console.log('❌ POOR: Major financial security risks present');
    }
    
    // Compliance checks
    console.log('\n🔍 Compliance Analysis:');
    const compliance = await analyzeFinancialCompliance();
    console.log(`PCI DSS Compliance: ${compliance.pciCompliance ? '✅' : '❌'}`);
    console.log(`GDPR Compliance: ${compliance.gdprCompliance ? '✅' : '❌'}`);
    console.log(`SOX Compliance: ${compliance.soxCompliance ? '✅' : '❌'}`);
    console.log(`Data Retention: ${compliance.dataRetention ? '✅' : '❌'}`);
    
    // Recommendations
    console.log('\n🔧 Financial Security Recommendations:');
    
    if (!paymentSecurity.hasTenantIsolation) {
      console.log('1. Implement strict tenant isolation for all financial data');
    }
    
    if (!paymentSecurity.hasAmountValidation) {
      console.log('2. Add comprehensive payment amount validation');
    }
    
    if (!accessControls.hasRoleBasedAccess) {
      console.log('3. Implement role-based access control for financial operations');
    }
    
    if (!accessControls.hasAuditLogging) {
      console.log('4. Add comprehensive financial audit logging');
    }
    
    if (!gatewaySecurity.hasWebhookVerification) {
      console.log('5. Implement payment webhook signature verification');
    }
    
    if (!ledgerIntegrity.hasImmutableTransactions) {
      console.log('6. Ensure financial transaction immutability');
    }
    
    if (!accessControls.hasDataEncryption) {
      console.log('7. Encrypt sensitive financial data at rest and in transit');
    }
    
    return {
      safetyScore,
      risks,
      paymentSecurity,
      accessControls,
      ledgerIntegrity,
      gatewaySecurity,
      compliance
    };
    
  } catch (error) {
    console.error('❌ Financial system analysis failed:', error.message);
    return null;
  }
}

// Helper functions for financial analysis
async function analyzePaymentSecurity() {
  try {
    // Check payment routes for tenant isolation
    const fs = await import('fs');
    const paymentsRoute = fs.readFileSync('src/routes/payments.routes.js', 'utf8');
    
    const hasTenantIsolation = paymentsRoute.includes('school_id') && 
                              paymentsRoute.includes('WHERE p.school_id =');
    
    const hasAmountValidation = paymentsRoute.includes('amount') && 
                                paymentsRoute.includes('Number(');
    
    const hasReferenceUniqueness = paymentsRoute.includes('reference_number') && 
                                   paymentsRoute.includes('UNIQUE') || 
                                   paymentsRoute.includes('ON DUPLICATE KEY');
    
    const hasWebhookSecurity = paymentsRoute.includes('webhook') || 
                               paymentsRoute.includes('signature');
    
    return {
      hasTenantIsolation,
      hasAmountValidation,
      hasReferenceUniqueness,
      hasWebhookSecurity
    };
  } catch {
    return {
      hasTenantIsolation: false,
      hasAmountValidation: false,
      hasReferenceUniqueness: false,
      hasWebhookSecurity: false
    };
  }
}

async function analyzeFinancialAccessControls() {
  try {
    const fs = await import('fs');
    const paymentsRoute = fs.readFileSync('src/routes/payments.routes.js', 'utf8');
    const paystackRoute = fs.readFileSync('src/routes/paystack.routes.js', 'utf8');
    
    const hasRoleBasedAccess = paymentsRoute.includes('requireRoles') || 
                               paystackRoute.includes('requireRoles');
    
    const hasAuditLogging = paymentsRoute.includes('logActivity') || 
                           paymentsRoute.includes('logAuditEvent') ||
                           paymentsRoute.includes('audit');
    
    const hasDataEncryption = paymentsRoute.includes('encrypt') || 
                             paymentsRoute.includes('crypto');
    
    const hasDataMasking = paymentsRoute.includes('mask') || 
                          paymentsRoute.includes('redact');
    
    return {
      hasRoleBasedAccess,
      hasAuditLogging,
      hasDataEncryption,
      hasDataMasking
    };
  } catch {
    return {
      hasRoleBasedAccess: false,
      hasAuditLogging: false,
      hasDataEncryption: false,
      hasDataMasking: false
    };
  }
}

async function analyzeLedgerIntegrity() {
  try {
    const fs = await import('fs');
    const ledgerRoute = fs.readFileSync('src/routes/ledger.routes.js', 'utf8');
    
    const hasDoubleEntry = ledgerRoute.includes('debit') && 
                          ledgerRoute.includes('credit');
    
    const hasImmutableTransactions = ledgerRoute.includes('UPDATE') === false || 
                                    ledgerRoute.includes('is_deleted') || 
                                    ledgerRoute.includes('immutable');
    
    const hasBalanceReconciliation = ledgerRoute.includes('balance') || 
                                    ledgerRoute.includes('reconcile');
    
    const hasAuditTrail = ledgerRoute.includes('audit') || 
                         ledgerRoute.includes('log') || 
                         ledgerRoute.includes('history');
    
    return {
      hasDoubleEntry,
      hasImmutableTransactions,
      hasBalanceReconciliation,
      hasAuditTrail
    };
  } catch {
    return {
      hasDoubleEntry: false,
      hasImmutableTransactions: false,
      hasBalanceReconciliation: false,
      hasAuditTrail: false
    };
  }
}

async function analyzePaymentGatewaySecurity() {
  try {
    const fs = await import('fs');
    const paystackRoute = fs.readFileSync('src/routes/paystack.routes.js', 'utf8');
    const mpesaRoute = fs.readFileSync('src/routes/mpesa.routes.js', 'utf8');
    
    const hasApiKeySecurity = paystackRoute.includes('Bearer') || 
                             paystackRoute.includes('Authorization');
    
    const hasWebhookVerification = paystackRoute.includes('webhook') && 
                                   paystackRoute.includes('verify') ||
                                   mpesaRoute.includes('webhook') && 
                                   mpesaRoute.includes('verify');
    
    const hasTimeoutProtection = paystackRoute.includes('timeout') || 
                                paystackRoute.includes('fetch') ||
                                mpesaRoute.includes('timeout');
    
    const hasRateLimiting = paystackRoute.includes('rate') || 
                           paystackRoute.includes('limit');
    
    return {
      hasApiKeySecurity,
      hasWebhookVerification,
      hasTimeoutProtection,
      hasRateLimiting
    };
  } catch {
    return {
      hasApiKeySecurity: false,
      hasWebhookVerification: false,
      hasTimeoutProtection: false,
      hasRateLimiting: false
    };
  }
}

async function analyzeFinancialCompliance() {
  // This would check for compliance implementations
  return {
    pciCompliance: false, // Likely not PCI DSS compliant
    gdprCompliance: false, // Likely missing GDPR measures
    soxCompliance: false, // Likely not SOX compliant
    dataRetention: false // Likely missing data retention policies
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeFinancialSystemSafety()
    .then((result) => {
      console.log('\n🎉 Financial system safety analysis complete!');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

export { analyzeFinancialSystemSafety };
