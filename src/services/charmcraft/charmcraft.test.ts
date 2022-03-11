import * as exec from '@actions/exec';
import { Charmcraft } from '.';

describe('the charmcraft service', () => {
  describe('the check for drifting libs', () => {
    [
      {
        text: 'updated to version',
        expected: false,
      },
      {
        text: 'not found in Charmhub',
        expected: false,
      },
      {
        text: 'has local changes',
        expected: false,
      },
      {
        text: 'is ok',
        expected: true,
      },
    ].forEach(({ text, expected }) => {
      it(`should detect when lib ${text}`, async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = () => ({ name: 'hello', images: [], files: [] });
        jest
          .spyOn(exec, 'getExecOutput')
          .mockResolvedValue({ exitCode: 0, stderr: text, stdout: '' });

        const status = await charmcraft.hasDriftingLibs();
        expect(status.ok).toEqual(expected);
      });
    });
  });

  describe('when uploading a charm', () => {
    describe('with file resources', () => {
      it('should use the latest revision for the file resources', async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = () => ({
          images: [['hello', 'docker.io/library/hello:latest']],
          files: ['resource_1'],
          name: 'hello',
        });

        const mockGetExecOutput = jest.spyOn(exec, 'getExecOutput');

        mockGetExecOutput.mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout:
            'Revision    Created at    Size\n' +
            '1           2021-07-19    512B\n' +
            '2           2021-07-22    512B\n',
        });

        await charmcraft.upload('edge', []);

        const charmcraftUploadCall = mockGetExecOutput.mock.calls.find(
          (call) => {
            return call[1] && call[1][0] == 'upload';
          }
        ) as Array<string>;

        expect(charmcraftUploadCall).not.toBe(undefined);
        expect(charmcraftUploadCall[1]).toContain('--resource=r:2');
      });

      it('should not add a resource for the file resources without revisions', async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = () => ({
          images: [['hello', 'docker.io/library/hello:latest']],
          files: ['resource_1'],
          name: 'hello',
        });

        const mockGetExecOutput = jest.spyOn(exec, 'getExecOutput');

        mockGetExecOutput.mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: 'Revision    Created at    Size\n',
        });

        await charmcraft.upload('edge', []);

        const charmcraftReleaseCall = mockGetExecOutput.mock.calls.find(
          (call) => {
            return call[1] && call[1][0] == 'upload';
          }
        ) as Array<string>;

        expect(charmcraftReleaseCall).not.toBe(undefined);
        expect(charmcraftReleaseCall[1]).not.toContain('--resource');
      });
    });
  });
});
