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

import { firebase } from '@genkit-ai/firebase';
import { gemini15Flash, googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { defineTool, generate, genkit, z } from 'genkit';
import { runWithRegistry } from 'genkit/registry';

const ai = genkit({
  plugins: [firebase(), googleAI(), vertexAI()],
  flowStateStore: 'firebase',
  traceStore: 'firebase',
  enableTracingAndMetrics: true,
  logLevel: 'debug',
  telemetry: {
    instrumentation: 'googleCloud',
    logger: 'googleCloud',
  },
});

const jokeSubjectGenerator = runWithRegistry(ai.registry, () =>
  defineTool(
    {
      name: 'jokeSubjectGenerator',
      description: 'Can be called to generate a subject for a joke',
    },
    async () => {
      return 'banana';
    }
  )
);

export const jokeFlow = ai.defineFlow(
  {
    name: 'jokeFlow',
    inputSchema: z.void(),
    outputSchema: z.any(),
  },
  async () => {
    const llmResponse = await generate({
      model: gemini15Flash,
      config: {
        temperature: 2,
      },
      output: {
        schema: z.object({ jokeSubject: z.string() }),
      },
      tools: [jokeSubjectGenerator],
      prompt: `come up with a subject to joke about (using the function provided)`,
    });
    return llmResponse.output();
  }
);
