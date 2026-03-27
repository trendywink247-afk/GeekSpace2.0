// ============================================================
// SHIM — re-exports from modules/integrations/services/gmail-sync
// This file exists for backward compatibility. New code should
// import from '../modules/integrations/services/gmail-sync.js'.
// ============================================================
export {
  type GmailTokenData,
  type GmailMessageRow,
  type GmailToken,
  getOAuth2Client,
  saveGmailToken,
  loadGmailToken,
  clearGmailToken,
  getGmailStatus,
  getGmailMessages,
  syncUserGmail,
  sendGmailReply,
  sendGmailCompose,
  startGmailSyncScheduler,
  _resetGmailSyncTimer,
} from '../modules/integrations/services/gmail-sync.js';
