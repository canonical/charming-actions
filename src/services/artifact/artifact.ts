import { DefaultArtifactClient, type ArtifactClient } from '@actions/artifact';
import { getExecOutput, exec } from '@actions/exec';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as glob from '@actions/glob';
import * as path from 'path';

interface ArtifactUploadResult {
  name: string;
  message?: string;
  error?: Error;
}

const normalizeError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

class Artifact {
  private artifacts: ArtifactClient;
  private invocationId: string;

  private async captureUpload(
    name: string,
    upload: () => Promise<string>,
  ): Promise<ArtifactUploadResult> {
    try {
      return { name, message: await upload() };
    } catch (error: unknown) {
      return { name, error: normalizeError(error) };
    }
  }

  constructor(
    artifacts: ArtifactClient = new DefaultArtifactClient(),
    invocationId: string = randomUUID(),
  ) {
    this.artifacts = artifacts;
    this.invocationId = invocationId;
  }

  async uploadManifest(rootDirectory = process.cwd()) {
    const manifestPath = path.join(rootDirectory, 'manifest.txt');
    const { stdout } = await getExecOutput('pip', ['freeze'], {
      silent: true,
    });

    fs.writeFileSync(manifestPath, stdout);

    const result = await this.artifacts.uploadArtifact(
      `manifest-${this.invocationId}`,
      [manifestPath],
      rootDirectory,
    );

    return `Manifest artifact upload result: ${JSON.stringify(result)}`;
  }

  async uploadLogs(
    basePath = '/home/runner/snap/charmcraft/common/cache/charmcraft/log',
    sudoPath = '/root/snap/charmcraft/common/cache/charmcraft/log',
  ) {
    // We're running some charmcraft commands as sudo as others as a
    // regular user - we want to capture both.

    // First check if the path created by sudo invocations of charmcraft
    // exists.
    const dirExistsExitCode = await exec('sudo', ['test', '-d', sudoPath], {
      ignoreReturnCode: true,
    });
    if (dirExistsExitCode === 0) {
      // Make sure the directory we're copying to exists as well.
      if (!fs.existsSync(basePath)) {
        await exec('mkdir', ['-p', basePath]);
      }
      await exec('sudo', ['cp', '-r', `${sudoPath}/.`, basePath]);
    }

    if (!fs.existsSync(basePath)) {
      return 'No charmcraft logs generated, skipping artifact upload.';
    }

    const globber = await glob.create(`${basePath}/*.log`);
    const files = await globber.glob();

    const result = await this.artifacts.uploadArtifact(
      `charmcraft-logs-${this.invocationId}`,
      files,
      basePath,
    );

    return `Artifact upload result: ${JSON.stringify(result)}`;
  }

  async uploadManifestAndLogs(): Promise<ArtifactUploadResult[]> {
    const manifest = await this.captureUpload('manifest', () =>
      this.uploadManifest(),
    );
    const logs = await this.captureUpload('charmcraft logs', () =>
      this.uploadLogs(),
    );

    return [manifest, logs];
  }
}

export { Artifact };
