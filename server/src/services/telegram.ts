// ============================================================
// SHIM — re-exports from modules/integrations/services/telegram
// This file exists for backward compatibility. New code should
// import from '../modules/integrations/services/telegram.js'.
// ============================================================
export {
  type TelegramUpdate,
  type NormalizedMessage,
  verifyTelegramWebhook,
  parseTelegramUpdate,
  extractBotCommand,
  sendTelegramMessage,
  editTelegramMessage,
  sendTelegramTyping,
  sendTelegramButtons,
  answerCallbackQuery,
  getTelegramFileUrl,
  downloadTelegramFile,
  registerTelegramWebhook,
  deleteTelegramWebhook,
  getTelegramBotInfo,
  getBotUsername,
  initTelegramBot,
  escapeTelegramHtml,
  sendTelegramNotification,
  sendTelegramPhoto,
  sendTelegramVideo,
} from '../modules/integrations/services/telegram.js';
