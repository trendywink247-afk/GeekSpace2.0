/** @deprecated Moved to modules/billing/services/credit-service.ts — this shim keeps legacy imports working. */
export { getBalance, deduct, checkQuota, getUsage } from '../modules/billing/services/credit-service.js';
export type { CreditBalance, UsageReport } from '../modules/billing/services/credit-service.js';
