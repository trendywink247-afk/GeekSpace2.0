// ============================================================
// Swagger/OpenAPI auto-documentation setup
// Collects JSDoc annotations from all module swagger.ts files
// Serves Swagger UI at /api/docs
// ============================================================

import type { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agentin API',
      version: '3.1.0',
      description: 'Agentin modular API — auto-generated from module swagger annotations',
    },
    servers: [
      { url: '/api/v1', description: 'Versioned API base path (canonical)' },
      { url: '/api', description: 'Unversioned API base path (deprecated, backward-compatible)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from POST /auth/login or /auth/signup',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan all module swagger files (both .ts source and .js compiled)
  apis: [
    './src/modules/*/swagger.ts',
    './src/modules/*/swagger.js',
    './dist/modules/*/swagger.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Mount Swagger UI and JSON spec endpoint onto the Express app.
 * Call this in app.ts after all routes are registered.
 */
export function setupSwagger(app: Application): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Agentin API Docs',
  }));

  // Raw JSON spec for tooling / code generation
  app.get('/api/docs/spec.json', (_req, res) => {
    res.json(swaggerSpec);
  });
}
