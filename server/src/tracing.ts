// ============================================================
// OpenTelemetry Distributed Tracing — opt-in via OTEL_ENABLED=true
// Must be imported before any other module to ensure auto-instrumentation
// ============================================================

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const otelEnabled = process.env.OTEL_ENABLED === 'true';

let sdk: NodeSDK | undefined;

if (otelEnabled) {
  // Enable diagnostic logging at WARN level for troubleshooting
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  const exporter = new OTLPTraceExporter({ url: endpoint });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'agentin-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Only enable instrumentations we care about
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-dns': { enabled: true },
        // Disable noisy/unnecessary ones
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
   
  console.log('[otel] OpenTelemetry tracing initialized — exporting to', endpoint);
}

/**
 * Gracefully flush and shut down the OTel SDK.
 * Safe to call even when tracing is disabled (no-op).
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}
