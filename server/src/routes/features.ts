import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const featuresRouter = Router();

const features = {
  socialDiscovery: true,
  portfolioChat: true,
  automationBuilder: true,
  websiteBuilder: false,
  n8nIntegration: true,
  manyChatIntegration: false,
};

featuresRouter.get('/', requireAuth, (_req, res) => {
  res.json(features);
});

featuresRouter.patch('/', requireAuth, (req, res) => {
  Object.assign(features, req.body);
  res.json(features);
});
