import type { ArtifactClient } from '@actions/artifact';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Artifact } from './artifact';

describe('artifact service', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'charming-actions-artifact-'),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('writes pip freeze output and uploads it as a manifest artifact', async () => {
    const uploadArtifact = jest.fn().mockResolvedValue({
      id: 42,
      size: 10,
      digest: 'sha256:abc123',
    });
    const artifacts = { uploadArtifact } as unknown as ArtifactClient;
    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: 'pip==24.0\n',
      stderr: '',
    });

    const result = await new Artifact(
      artifacts,
      'test-invocation',
    ).uploadManifest(tempDirectory);

    expect(exec.getExecOutput).toHaveBeenCalledWith('pip', ['freeze'], {
      silent: true,
    });
    expect(
      fs.readFileSync(path.join(tempDirectory, 'manifest.txt'), 'utf8'),
    ).toBe('pip==24.0\n');
    expect(uploadArtifact).toHaveBeenCalledWith(
      'manifest-test-invocation',
      [expect.stringMatching(/[\\/]manifest\.txt$/)],
      tempDirectory,
    );
    expect(result).toBe(
      'Manifest artifact upload result: ' +
        '{"id":42,"size":10,"digest":"sha256:abc123"}',
    );
  });

  it('does not create or upload a manifest when pip freeze fails', async () => {
    const uploadArtifact = jest.fn();
    const artifacts = { uploadArtifact } as unknown as ArtifactClient;
    jest
      .spyOn(exec, 'getExecOutput')
      .mockRejectedValue(new Error('pip freeze failed'));

    await expect(
      new Artifact(artifacts, 'test-invocation').uploadManifest(tempDirectory),
    ).rejects.toThrow('pip freeze failed');

    expect(uploadArtifact).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tempDirectory, 'manifest.txt'))).toBe(false);
  });

  it('propagates a manifest upload failure after writing the file', async () => {
    const uploadArtifact = jest
      .fn()
      .mockRejectedValue(new Error('artifact service unavailable'));
    const artifacts = { uploadArtifact } as unknown as ArtifactClient;
    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: 'pip==24.0\n',
      stderr: '',
    });

    await expect(
      new Artifact(artifacts, 'test-invocation').uploadManifest(tempDirectory),
    ).rejects.toThrow('artifact service unavailable');

    expect(
      fs.readFileSync(path.join(tempDirectory, 'manifest.txt'), 'utf8'),
    ).toBe('pip==24.0\n');
  });

  it('generates distinct manifest names for separate invocations', async () => {
    const uploadArtifact = jest.fn().mockResolvedValue({ id: 42, size: 10 });
    const artifacts = { uploadArtifact } as unknown as ArtifactClient;
    const firstDirectory = path.join(tempDirectory, 'first');
    const secondDirectory = path.join(tempDirectory, 'second');
    fs.mkdirSync(firstDirectory);
    fs.mkdirSync(secondDirectory);
    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stdout: 'pip==24.0\n',
      stderr: '',
    });

    await new Artifact(artifacts).uploadManifest(firstDirectory);
    await new Artifact(artifacts).uploadManifest(secondDirectory);

    const firstName = uploadArtifact.mock.calls[0][0];
    const secondName = uploadArtifact.mock.calls[1][0];
    expect(firstName).toMatch(/^manifest-[0-9a-f-]{36}$/);
    expect(secondName).toMatch(/^manifest-[0-9a-f-]{36}$/);
    expect(firstName).not.toBe(secondName);
  });

  it('uses the invocation suffix for charmcraft logs', async () => {
    const uploadArtifact = jest.fn().mockResolvedValue({ id: 43, size: 20 });
    const artifacts = { uploadArtifact } as unknown as ArtifactClient;
    const logPath = path.join(tempDirectory, 'charmcraft.log');
    fs.writeFileSync(logPath, 'log output');
    jest.spyOn(exec, 'exec').mockResolvedValue(1);

    await new Artifact(artifacts, 'test-invocation').uploadLogs(
      tempDirectory,
      path.join(tempDirectory, 'sudo'),
    );

    expect(uploadArtifact).toHaveBeenCalledWith(
      'charmcraft-logs-test-invocation',
      [logPath],
      tempDirectory,
    );
  });

  it('collects logs even when the manifest upload fails', async () => {
    const artifacts = {
      uploadArtifact: jest.fn(),
    } as unknown as ArtifactClient;
    const service = new Artifact(artifacts, 'test-invocation');
    jest
      .spyOn(service, 'uploadManifest')
      .mockRejectedValue(new Error('manifest upload failed'));
    jest
      .spyOn(service, 'uploadLogs')
      .mockResolvedValue('Charmcraft logs uploaded');

    const results = await service.uploadManifestAndLogs();

    expect(service.uploadLogs).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      {
        name: 'manifest',
        error: new Error('manifest upload failed'),
      },
      {
        name: 'charmcraft logs',
        message: 'Charmcraft logs uploaded',
      },
    ]);
  });
});
