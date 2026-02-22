# GeekSpace Improvements Plan

## Issues to Fix & Features to Add

### 1. WhatsApp Button Spamming (CRITICAL)
**Problem:** Buttons like "save", "remind me", "continue on whatsapp", "continue on telegram" appear for every message
**Solution:** 
- Only show action buttons when relevant (e.g., only show "save" when there's content to save)
- Add cooldown/deduplication logic
- Implement smart context-aware buttons

### 2. Image Generation with Free AI Models
**Implementation:**
- Pollinations.AI (completely free, no API key)
- Optional: Stable Diffusion via Replicate free tier
- Add to agent capabilities

### 3. Video Generation (Free Models)
**Implementation:**
- Pollinations.AI video endpoint
- Optional: Luma Dream Machine free tier

### 4. WhatsApp QR Code Setup (Like OpenClaw)
**Current:** Link token-based
**New:** QR code scanning for WhatsApp Business API

### 5. Connections Tab Improvements
**Make all integrations look working:**
- Better visual feedback
- Connection health indicators
- Setup wizards for each integration

### 6. Onboarding Improvements
- Smoother flow
- Better progress indicators
- Skip options with reminders

### 7. General Functionality Audit
- Test all chat features
- Verify reminders work
- Check portfolio generation
- Test agent conversations

## Implementation Order
1. Fix button spamming (immediate UX improvement)
2. Add image generation
3. Improve WhatsApp setup flow
4. Polish connections tab
5. Enhance onboarding
6. Add video generation
7. Full audit & testing
