import * as exec from '@actions/exec';
import { Charmcraft } from '.';

describe('the charmcraft service', () => {
  let mockExec: jest.SpyInstance;

  beforeEach(() => {
    mockExec = jest.spyOn(exec, 'getExecOutput');
    mockExec.mockClear();
  });

  describe('the check for drifting libs', () => {
    [
      { text: 'updated to version', expected: false },
      { text: 'not found in Charmhub', expected: false },
      { text: 'has local changes', expected: false },
      { text: 'is ok', expected: true },
    ].forEach(({ text, expected }) => {
      it(`should detect when lib ${text}`, async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = () => ({ name: 'hello', images: [], files: [] });
        mockExec.mockResolvedValue({ exitCode: 0, stderr: text, stdout: '' });

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
          images: [],
          files: ['resource_1'],
          name: 'hello',
        });

        mockExec.mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout:
            'Revision    Created at    Size\n' +
            '2           2021-07-22    512B\n' +
            '1           2021-07-19    512B\n',
        });

        await charmcraft.upload('edge', ['--resource=resource_1:2']);

        expect(mockExec).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalledWith(
          'charmcraft',
          [
            'upload',
            '--quiet',
            '--release',
            'edge',
            undefined,
            '--resource=resource_1:2',
          ],
          expect.anything()
        );
      });

      it('should fail if there are no resource revisions for a file resource that is being looked up', async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = jest.fn(() => ({
          images: [['hello', 'docker.io/library/hello:latest']],
          files: ['resource_1'],
          name: 'hello',
        }));

        const mockGetExecOutput = jest.spyOn(exec, 'getExecOutput');
        mockGetExecOutput.mockClear();
        mockGetExecOutput.mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: 'Revision    Created at    Size\n',
        });

        await expect(charmcraft.fetchFileFlags({})).rejects.toThrow(
          `Resource 'resource_1' does not have any uploaded revisions.`
        );
      });
      it('should not include overriden images', () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = jest.fn(() => ({
          images: [['hello', 'docker.io/library/hello:latest']],
          files: ['resource_1'],
          name: 'hello',
        }));
        charmcraft.uploadResources({ hello: '2' });
        const mockGetExecOutput = jest.spyOn(exec, 'getExecOutput');
        expect(mockGetExecOutput).not.toHaveBeenCalled();
      });
    });
  });
});

describe('the check for upload resources', () => {
  [
    {
      flags: ['edge-release-test-charm-image:17'],
      resourceInfo: 'resources:\n',
      images: [
        [
          'edge-release-test-charm-image',
          'docker.artifactory.magmacore.org/controller:latest',
        ],
      ],
    },
    {
      flags: ['lollercopter-image:1', 'bueno-image:4'],
      resourceInfo: 'resources:\n',
      images: [
        [
          'lollercopter-image',
          'docker.artifactory.magmacore.org/controller:latest',
        ],
        ['bueno-image', 'docker.artifactory.magmacore.org/controller:latest'],
      ],
    },
  ].forEach(({ flags, resourceInfo, images }) => {
    it(`should return the right flags and resource info`, async () => {
      const charmcraft = new Charmcraft('token');

      charmcraft.uploadResource = jest.fn();
      charmcraft.metadata = jest.fn(() => ({
        name: 'hello',
        files: ['resource_1'],
        images,
      }));

      charmcraft.buildResourceFlag = jest.fn(async (_name, resource_name) => ({
        flag: `${flags.find((f) => f.includes(resource_name))}`,
        info: ``,
      }));

      const uploadResources = await charmcraft.uploadResources();
      expect(uploadResources).toEqual({ flags, resourceInfo });
    });
  });
});
