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
          stdout: '{"revision": 2}',
        });

        await charmcraft.upload('edge', ['--resource=resource_1:2']);

        expect(mockExec).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalledWith(
          'charmcraft',
          [
            'upload',
            '--format',
            'json',
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
      it('should not include overriden images', async () => {
        const charmcraft = new Charmcraft('token');
        charmcraft.metadata = jest.fn(() => ({
          images: [['hello', 'docker.io/library/hello:latest']],
          files: ['resource_1'],
          name: 'hello',
        }));
        await charmcraft.uploadResources({ hello: '2' });
        const mockGetExecOutput = jest.spyOn(exec, 'getExecOutput');
        expect(mockGetExecOutput).not.toHaveBeenCalled();
      });

      describe('pulling images', () => {
        it('should succeed when image digest is available', async () => {
          const digest = `somedigest`;
          const charmcraft = new Charmcraft('token');

          const mockedExec = jest.spyOn(exec, 'exec').mockResolvedValue(0);

          jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
            exitCode: 0,
            stderr: '',
            stdout: digest,
          });

          await charmcraft.uploadResource(
            'placeholder-image',
            'placeholder-name',
            'placeholder-resource-name'
          );

          const calledProgram = mockedExec.mock.calls[1][0];
          expect(calledProgram).toEqual('charmcraft');
          const charmcraftArgs = mockedExec.mock.calls[1][1];
          if (charmcraftArgs) {
            const calledDigest = charmcraftArgs.at(-1);
            expect(calledDigest).toEqual(digest);
          } else {
            fail('charmcraft not called with expected arguments');
          }
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
      latest   ubuntu 20.04 (amd64)  stable     34         34          noop (r12)                                                                                                                  
                                     candidate  33         33          noop (r11)                                                                                                                  
                                     beta       32         32          noop (r10)                                                                                                                  
                                     edge       68         68          -                                                                                                                           
      1.5      ubuntu 20.04 (amd64)  stable     57         57          kfam-image (r267), profile-image (r265)                                                                                     
                                     candidate  55         55          kfam-image (r268), profile-image (r268)                                                                                                                
                                     beta       56         56          kfam-image (r269), profile-image (r267)                                                                                                              
                                     edge       58         58          kfam-image (r269), profile-image (r270)`;

      [
        {
          track: 'latest',
          channel: 'stable',
          expected: {
            charmRev: '34',
            resources: [{ resourceName: 'noop', resourceRev: '12' }],
          },
        },
        {
          track: 'latest',
          channel: 'candidate',
          expected: {
            charmRev: '33',
            resources: [{ resourceName: 'noop', resourceRev: '11' }],
          },
        },
        {
          track: 'latest',
          channel: 'beta',
          expected: {
            charmRev: '32',
            resources: [{ resourceName: 'noop', resourceRev: '10' }],
          },
        },
        {
          track: 'latest',
          channel: 'edge',
          expected: { charmRev: '68', resources: [] },
        },
        {
          track: '1.5',
          channel: 'stable',
          expected: {
            charmRev: '57',
            resources: [
              { resourceName: 'kfam-image', resourceRev: '267' },
              { resourceName: 'profile-image', resourceRev: '265' },
            ],
          },
        },
        {
          track: '1.5',
          channel: 'candidate',
          expected: {
            charmRev: '55',
            resources: [
              { resourceName: 'kfam-image', resourceRev: '268' },
              { resourceName: 'profile-image', resourceRev: '268' },
            ],
          },
        },
        {
          track: '1.5',
          channel: 'beta',
          expected: {
            charmRev: '56',
            resources: [
              { resourceName: 'kfam-image', resourceRev: '269' },
              { resourceName: 'profile-image', resourceRev: '267' },
            ],
          },
        },
        {
          track: '1.5',
          channel: 'edge',
          expected: {
            charmRev: '58',
            resources: [
              { resourceName: 'kfam-image', resourceRev: '269' },
              { resourceName: 'profile-image', resourceRev: '270' },
            ],
          },
        },
      ].forEach(({ track, channel, expected }) => {
        it(`gets the correct revision number for ${track}/${channel}`, async () => {
          const charmcraft = new Charmcraft('token');

          jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
            exitCode: 0,
            stderr: '',
            stdout: charmcraftStatus,
          });

          const result = await charmcraft.getRevisionInfoFromChannel(
            'placeholder-charm',
            track,
            channel
          );
          expect(result).toEqual(expected);
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
          charmcraft.getRevisionInfoFromChannel(
            'placeholder-charm',
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
          charmcraft.getRevisionInfoFromChannel(
            'placeholder-charm',
            '1.0.0',
            'candidate'
          )
        ).rejects.toThrow(Error('No track with name 1.0.0'));
      });
      it('throws error if not provided with one of the default channels', async () => {
        const charmcraft = new Charmcraft('token');
        await expect(
          charmcraft.getRevisionInfoFromChannel(
            'placeholder-charm',
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

  describe('test getRevisionFromChannelJson', () => {
    describe('returns correct revision details', () => {
      it('with one base in track', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '20.04',
                  architecture: 'amd64',
                },
                releases: [
                  {
                    status: 'closed',
                    channel: 'latest/stable',
                    version: null,
                    revision: null,
                    resources: null,
                    expires_at: null,
                  },
                  {
                    status: 'open',
                    channel: 'latest/candidate',
                    version: '3',
                    revision: 3,
                    resources: [
                      {
                        name: 'httpbin-image',
                        revision: 3,
                      },
                    ],
                    expires_at: null,
                  },
                  {
                    status: 'open',
                    channel: 'latest/beta',
                    version: '10',
                    revision: 10,
                    resources: [
                      {
                        name: 'httpbin-image',
                        revision: 10,
                      },
                    ],
                    expires_at: null,
                  },
                  {
                    status: 'open',
                    channel: 'latest/edge',
                    version: '10',
                    revision: 10,
                    resources: [
                      {
                        name: 'httpbin-image',
                        revision: 10,
                      },
                    ],
                    expires_at: null,
                  },
                ],
              },
            ],
          },
        ];

        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };
        const expected = {
          charmRev: '10',
          resources: [{ resourceName: 'httpbin-image', resourceRev: '10' }],
        };

        const charmcraft = new Charmcraft('token');

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const result = await charmcraft.getRevisionInfoFromChannelJson(
          'placeholder-charm',
          track,
          channel,
          base
        );
        expect(result).toEqual(expected);
      });

      it('with multiple bases in one track', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '20.04',
                  architecture: 'amd64',
                },
                releases: [
                  {
                    status: 'open',
                    channel: 'latest/edge',
                    version: '10',
                    revision: 10,
                    resources: [
                      {
                        name: 'httpbin-image',
                        revision: 10,
                      },
                    ],
                    expires_at: null,
                  },
                ],
              },
              {
                base: {
                  name: 'ubuntu',
                  channel: '18.04',
                  architecture: 'amd64',
                },
                releases: [
                  {
                    status: 'open',
                    channel: 'latest/edge',
                    version: '5',
                    revision: 5,
                    resources: [
                      {
                        name: 'httpbin-image',
                        revision: 6,
                      },
                    ],
                    expires_at: null,
                  },
                ],
              },
            ],
          },
        ];

        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };
        const expected = {
          charmRev: '10',
          resources: [{ resourceName: 'httpbin-image', resourceRev: '10' }],
        };

        const charmcraft = new Charmcraft('token');

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const result = await charmcraft.getRevisionInfoFromChannelJson(
          'placeholder-charm',
          track,
          channel,
          base
        );
        expect(result).toEqual(expected);
      });
    });

    describe('throws correct error', () => {
      it('when an invalid channel was provided', async () => {
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            'valid track',
            'invalid-channel',
            base
          )
        ).rejects.toThrow(
          Error(
            `Provided channel invalid-channel is not supported. This actions currently only works with one of the following default channels: edge, beta, candidate, stable`
          )
        );
      });

      it('when track not found', async () => {
        const charmcraftStatus = [{ track: 'special-track' }];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrow(Error(`No track with name ${track}`));
      });

      it('when channel with matching base is not found', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '18.04',
                  architecture: 'amd64',
                },
                releases: [],
              },
            ],
          },
        ];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrowError();
      });

      it('when channel base is null', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: null,
                releases: [],
              },
            ],
          },
        ];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrow(
          Error(
            `No channel with base name ${base.name}, base channel ${base.channel} and base architecture ${base.architecture}`
          )
        );
      });

      it('when release cannot be found', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '20.04',
                  architecture: 'amd64',
                },
                releases: [{ channel: 'latest/beta' }],
              },
            ],
          },
        ];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrowError();
      });

      it('when release channel is closed', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '20.04',
                  architecture: 'amd64',
                },
                releases: [{ channel: 'latest/edge', status: 'closed' }],
              },
            ],
          },
        ];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrow(
          Error(
            'Channel is not open. Make sure there was a release made to this channel previously.'
          )
        );
      });

      it('when release is closed', async () => {
        const charmcraftStatus = [
          {
            track: 'latest',
            mappings: [
              {
                base: {
                  name: 'ubuntu',
                  channel: '20.04',
                  architecture: 'amd64',
                },
                releases: [
                  { channel: 'latest/beta', status: 'open' },
                  { channel: 'latest/edge', status: 'tracking' },
                ],
              },
            ],
          },
        ];
        const track = 'latest';
        const channel = 'edge';
        const base = {
          name: 'ubuntu',
          channel: '20.04',
          architecture: 'amd64',
        };

        jest.spyOn(exec, 'getExecOutput').mockResolvedValue({
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify(charmcraftStatus),
        });

        const charmcraft = new Charmcraft('token');

        await expect(
          charmcraft.getRevisionInfoFromChannelJson(
            'placeholder-charm',
            track,
            channel,
            base
          )
        ).rejects.toThrow(
          Error(
            'Channel is not open. Make sure there was a release made to this channel previously.'
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
