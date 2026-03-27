// ============================================================
// SHIM — re-exports from modules/integrations/services/whatsapp
// This file exists for backward compatibility. New code should
// import from '../modules/integrations/services/whatsapp.js'.
// ============================================================
export {
  sendWhatsAppMessage,
  verifyWhatsAppWebhook,
  generateWhatsAppLinkToken,
  generateWhatsAppQRSession,
  checkWhatsAppSession,
  handleWhatsAppWebhook,
  unlinkWhatsApp,
  getWhatsAppStatus,
} from '../modules/integrations/services/whatsapp.js';
