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

        charmcraft.buildResourceFlag = jest.fn(
          async (_name, resource_name) => ({
            flag: `${flags.find((f) => f.includes(resource_name))}`,
            info: ``,
          })
        );

        const uploadResources = await charmcraft.uploadResources();
        expect(uploadResources).toEqual({ flags, resourceInfo });
      });
    });
  });

  describe('test getRevisionFromChannel', () => {
    describe('gets correct revision number', () => {
      // test data
      const charmcraftStatus = `Track    Base                  Channel    Version    Revision    Resources                                                                                                                                 
        latest   ubuntu 20.04 (amd64)  stable     66         66           -                                                                                                                                         
                                       candidate  67         67           -                                                                                                                                         
                                       beta       68         68           -                                                                                                                                         
                                       edge       80         80           httpbin-image (r3)
        2.28     ubuntu 20.04 (amd64)  stable     78         78           -                                                                                                                                         
                                       candidate  79         79           -                                                                                                                                         
                                       beta       77         77           -                                                                                                                                         
                                       edge       76         76           httpbin-image (r3)`;

      [
        {
          track: 'latest',
          channel: 'stable',
          expected: '66',
        },
        {
          track: 'latest',
          channel: 'candidate',
          expected: '67',
        },
        {
          track: 'latest',
          channel: 'beta',
          expected: '68',
        },
        {
          track: 'latest',
          channel: 'edge',
          expected: '80',
        },
        {
          track: '2.28',
          channel: 'stable',
          expected: '78',
        },
        {
          track: '2.28',
          channel: 'candidate',
          expected: '79',
        },
        {
          track: '2.28',
          channel: 'beta',
          expected: '77',
        },
        {
          track: '2.28',
          channel: 'edge',
          expected: '76',
        },
      ].forEach(({ track, channel, expected }) => {
        it(`gets the correct revision number for ${track}/${channel}`, async () => {
          const charmcraft = new Charmcraft('token');

          jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
            exitCode: 0,
            stderr: '',
            stdout: charmcraftStatus,
          });

          const revNum = await charmcraft.getRevisionFromChannel(
            'dummy-charm',
            track,
            channel
          );
          expect(revNum).toEqual(expected);
        });
      });
    });

    describe('correct error handling', () => {
      // test data
      const charmcraftStatus = `Track    Base                  Channel    Version    Revision    Resources                                                                                                                                 
        latest   ubuntu 20.04 (amd64)  stable     2          2           -                                                                                                                                         
                                       candidate  -          -           -                                                                                                                                         
                                       beta       1          1           -                                                                                                                                         
                                       edge       3          3           httpbin-image (r3)`;

      it('throws error if no revision is available', async () => {
        const charmcraft = new Charmcraft('token');
        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: charmcraftStatus,
        });

        await expect(
          charmcraft.getRevisionFromChannel(
            'dummy-charm',
            'latest',
            'candidate'
          )
        ).rejects.toThrow(Error('No revision available in latest/candidate'));
      });
      it('throws error if track does not exist', async () => {
        const charmcraft = new Charmcraft('token');
        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: charmcraftStatus,
        });

        await expect(
          charmcraft.getRevisionFromChannel('dummy-charm', '1.0.0', 'candidate')
        ).rejects.toThrow(Error('No track with name 1.0.0'));
      });
      it('throws error if not provided with one of the default channels', async () => {
        const charmcraft = new Charmcraft('token');
        await expect(
          charmcraft.getRevisionFromChannel(
            'dummy-charm',
            'latest',
            'stable/feature-123'
          )
        ).rejects.toThrow(
          Error(
            'Provided channel stable/feature-123 is not supported. This actions currently only works with one of the following default channels: edge, beta, candidate, stable'
          )
        );
      });
    });
  });

  describe('test charmcraft release', () => {
    it('should be called with the correct arguments with resources', async () => {
      const charmcraft = new Charmcraft('token');
      const mock = jest.spyOn(exec, 'exec');
      mock.mockResolvedValue(0);

      await charmcraft.release('test-charm', '10', 'latest/candidate', [
        { resourceName: 'resource_1', resourceRev: '2' },
        { resourceName: 'resource-2-k8s', resourceRev: '8' },
      ]);

      expect(mock).toHaveBeenCalled();
      expect(mock).toHaveBeenCalledWith(
        'charmcraft',
        [
          'release',
          'test-charm',
          '--revision',
          '10',
          '--channel',
          'latest/candidate',
          '--resource',
          'resource_1:2',
          '--resource',
          'resource-2-k8s:8',
        ],
        expect.anything()
      );
    });

    it('should be called with the correct arguments without resources', async () => {
      const charmcraft = new Charmcraft('token');
      const mock = jest.spyOn(exec, 'exec');
      mock.mockResolvedValue(0);

      await charmcraft.release('test-charm', '10', 'latest/candidate', []);

      expect(mock).toHaveBeenCalled();
      expect(mock).toHaveBeenCalledWith(
        'charmcraft',
        [
          'release',
          'test-charm',
          '--revision',
          '10',
          '--channel',
          'latest/candidate',
        ],
        expect.anything()
      );
    });
  });
});
