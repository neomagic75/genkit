/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { genkitPlugin, isDevEnv, Plugin } from '@genkit-ai/core';
import { InstrumentationConfigMap } from '@opentelemetry/auto-instrumentations-node';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { AlwaysOnSampler, Sampler } from '@opentelemetry/sdk-trace-base';
import { GoogleAuth, JWTInput } from 'google-auth-library';
import { GcpLogger } from './gcpLogger.js';
import { GcpOpenTelemetry } from './gcpOpenTelemetry.js';
import { GcpPluginConfig, GcpTelemetryConfig } from './types.js';

/** Configuration options for the Google Cloud plugin. */
export interface GcpPluginOptions {
  /** Cloud projectId is required, either passed here, through GCLOUD_PROJECT or application default credentials. */
  projectId?: string;

  /** Telemetry configuration overrides. Defaults will be provided depending on the Genkit environment. */
  telemetryConfig?: GcpTelemetryConfigOptions;

  /** Credentials must be provided to export telemetry, if not available through the environment. */
  credentials?: JWTInput;
}

export interface GcpTelemetryConfigOptions {
  /** Trace sampler, defaults to always on which exports all traces. */
  sampler?: Sampler;

  /** Include OpenTelemetry autoInstrumentation. Defaults to true. */
  autoInstrumentation?: boolean;
  autoInstrumentationConfig?: InstrumentationConfigMap;
  instrumentations?: Instrumentation[];

  /** Metric export intervals, minimum is 5000ms. */
  metricExportIntervalMillis?: number;
  metricExportTimeoutMillis?: number;

  /** When true, metrics are not exported. */
  disableMetrics?: boolean;

  /** When true, traces are not exported. */
  disableTraces?: boolean;

  /** When true, telemetry data will be exported, even for local runs. Defaults to not exporting development traces. */
  forceDevExport?: boolean;
}

/** Consolidated defaults for telemetry configuration. */

export const TelemetryConfigs = {
  defaults: (overrides: GcpTelemetryConfigOptions = {}): GcpTelemetryConfig => {
    return isDevEnv()
      ? TelemetryConfigs.developmentDefaults(overrides)
      : TelemetryConfigs.productionDefaults(overrides);
  },

  developmentDefaults: (
    overrides: GcpTelemetryConfigOptions = {}
  ): GcpTelemetryConfig => {
    const defaults = {
      sampler: new AlwaysOnSampler(),
      autoInstrumentation: true,
      autoInstrumentationConfig: {
        '@opentelemetry/instrumentation-dns': { enabled: false },
      },
      instrumentations: [],
      metricExportIntervalMillis: 5_000,
      metricExportTimeoutMillis: 5_000,
      disableMetrics: false,
      disableTraces: false,
      export: !!overrides.forceDevExport, // false
    };
    return { ...defaults, ...overrides };
  },

  productionDefaults: (
    overrides: GcpTelemetryConfigOptions = {}
  ): GcpTelemetryConfig => {
    const defaults = {
      sampler: new AlwaysOnSampler(),
      autoInstrumentation: true,
      autoInstrumentationConfig: {
        '@opentelemetry/instrumentation-dns': { enabled: false },
      },
      instrumentations: [],
      metricExportIntervalMillis: 300_000,
      metricExportTimeoutMillis: 300_000,
      disableMetrics: false,
      disableTraces: false,
      export: true,
    };
    return { ...defaults, ...overrides };
  },
};

/**
 * Provides a plugin for using Genkit with GCP.
 */
export const googleCloud: Plugin<[GcpPluginOptions] | []> = genkitPlugin(
  'googleCloud',
  async (options?: GcpPluginOptions) => {
    let authClient;
    let credentials;

    // Allow customers to pass in cloud credentials from environment variables
    // following: https://github.com/googleapis/google-auth-library-nodejs?tab=readme-ov-file#loading-credentials-from-environment-variables
    if (process.env.GCLOUD_SERVICE_ACCOUNT_CREDS) {
      const serviceAccountCreds = JSON.parse(
        process.env.GCLOUD_SERVICE_ACCOUNT_CREDS
      );
      const authOptions = { credentials: serviceAccountCreds };
      authClient = new GoogleAuth(authOptions);
      credentials = await authClient.getCredentials();
    } else {
      authClient = new GoogleAuth();
    }

    const config: GcpPluginConfig = {
      projectId: options?.projectId || (await authClient.getProjectId()),
      telemetryConfig: TelemetryConfigs.defaults(options?.telemetryConfig),
      credentials: options?.credentials,
    };

    return {
      telemetry: {
        instrumentation: {
          id: 'googleCloud',
          value: new GcpOpenTelemetry(config),
        },
        logger: {
          id: 'googleCloud',
          value: new GcpLogger(config),
        },
      },
    };
  }
);

export default googleCloud;
export * from './gcpLogger.js';
export * from './gcpOpenTelemetry.js';
