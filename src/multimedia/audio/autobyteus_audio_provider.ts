import { AutobyteusClient } from '../../clients/autobyteus_client.js';
import { MultimediaProvider } from '../providers.js';
import { MultimediaRuntime } from '../runtimes.js';
import { AudioModel } from './audio_model.js';
import { AutobyteusAudioClient } from './api/autobyteus_audio_client.js';
import { AudioClientFactory } from './audio_client_factory.js';

function parseHosts(): string[] {
  const hosts = process.env.AUTOBYTEUS_LLM_SERVER_HOSTS;
  if (hosts) {
    return hosts.split(',').map((host) => host.trim()).filter(Boolean);
  }

  const legacyHost = process.env.AUTOBYTEUS_LLM_SERVER_URL;
  if (legacyHost) {
    return [legacyHost];
  }

  return [];
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
}

function resolveProvider(provider: string): MultimediaProvider | null {
  if (Object.values(MultimediaProvider).includes(provider as MultimediaProvider)) {
    return provider as MultimediaProvider;
  }
  return null;
}

export class AutobyteusAudioModelProvider {
  static async discoverAndRegister(): Promise<void> {
    const hosts = parseHosts();
    if (hosts.length === 0) {
      console.info('No Autobyteus server hosts configured. Skipping Autobyteus audio model discovery.');
      return;
    }

    let totalRegistered = 0;

    for (const hostUrl of hosts) {
      if (!isValidUrl(hostUrl)) {
        console.error(`Invalid Autobyteus host URL for audio model discovery: ${hostUrl}, skipping.`);
        continue;
      }

      const client = new AutobyteusClient(hostUrl);
      try {
        const response = await client.getAvailableAudioModelsSync();
        const models = response?.models ?? [];

        if (!Array.isArray(models) || models.length === 0) {
          console.info(`No audio models found on host ${hostUrl}.`);
          continue;
        }

        let hostRegistered = 0;
        for (const modelInfo of models) {
          if (!modelInfo || !modelInfo.name || !modelInfo.value || !modelInfo.provider) {
            console.warn(`Skipping malformed audio model from ${hostUrl}: ${JSON.stringify(modelInfo)}`);
            continue;
          }

          if (!('parameter_schema' in modelInfo)) {
            console.debug(
              `Skipping model from ${hostUrl} as it lacks a parameter schema: ${modelInfo.name}`
            );
            continue;
          }

          const provider = resolveProvider(modelInfo.provider);
          if (!provider) {
            console.error(`Cannot register audio model '${modelInfo.name}' with unknown provider '${modelInfo.provider}'.`);
            continue;
          }

          const audioModel = new AudioModel({
            name: modelInfo.name,
            value: modelInfo.value,
            provider,
            clientClass: AutobyteusAudioClient,
            runtime: MultimediaRuntime.AUTOBYTEUS,
            hostUrl: hostUrl,
            parameterSchema: modelInfo.parameter_schema
          });

          AudioClientFactory.registerModel(audioModel);
          hostRegistered += 1;
        }

        if (hostRegistered > 0) {
          console.info(`Registered ${hostRegistered} audio models from Autobyteus host ${hostUrl}.`);
        }
        totalRegistered += hostRegistered;
      } catch (error) {
        console.warn(`Could not fetch audio models from Autobyteus server at ${hostUrl}: ${String(error)}`);
      } finally {
        await client.close();
      }
    }

    if (totalRegistered > 0) {
      console.info(`Finished Autobyteus audio model discovery. Total models registered: ${totalRegistered}`);
    }
  }
}
