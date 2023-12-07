import * as exec from '@actions/exec';
import { getImageDigest } from './docker';

describe('the container image service', () => {
  it('should return a digest it available', async () => {
    const dockerReturn = `somedigest`;

    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: dockerReturn,
    });

    const digest = await getImageDigest('placeholder-image');
    expect(digest).toEqual(dockerReturn);
  });

  it('should throw when digest is empty', async () => {
    const dockerReturn = ``;

    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: dockerReturn,
    });

    const expectedError = `No digest found for pulled resource_image 'placeholder-image'`;

    await expect(getImageDigest('placeholder-image')).rejects.toThrow(
      Error(expectedError),
    );
  });

  it('should throw when digest returns as multiline string', async () => {
    const dockerReturn = `stuff
        more stuff
        more stuff`;

    jest.spyOn(exec, 'exec').mockResolvedValue(0);

    jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: dockerReturn,
    });

    const expectedError = `Found too many digests for pulled resource_image 'placeholder-image'.  Expected single output, got multiline output '${dockerReturn}'.`;

    await expect(getImageDigest('placeholder-image')).rejects.toThrow(
      Error(expectedError),
    );
  });
});
