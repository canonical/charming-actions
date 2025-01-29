import * as core from '@actions/core';
import { UploadCharmAction } from './upload-charm';

describe('the upload charm action', () => {
  beforeEach(() => {
    jest.spyOn(process, 'chdir').mockImplementation(() => {});
    jest.spyOn(core, 'info').mockImplementation(() => {});
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(true);
  });

  [
    { charmcraftPackOutput: ['/path/to/charm.charm'], builtCharmPath: '' }, // charmcraft pack produces one file
    {
      charmcraftPackOutput: ['/path/to/charm1.charm', '/path/to/charm2.charm'],
      builtCharmPath: '',
    }, // charmcraft pack produces two files
    { charmcraftPackOutput: [], builtCharmPath: '/path/to/prebuilt.charm' }, // built-charm-path input option is provided
    {
      charmcraftPackOutput: [],
      builtCharmPath: '/path/to/prebuilt1.charm,/path/to/prebuilt2.charm',
    }, // Multiple comma paths
    {
      charmcraftPackOutput: [],
      builtCharmPath: '/path/to/prebuilt1.charm, /path/to/prebuilt2.charm',
    }, // Multiple comma paths with spaces
  ].forEach(({ charmcraftPackOutput, builtCharmPath }) => {
    it('should call charmcraft upload correct number of times with correct parameters', async () => {
      jest.spyOn(core, 'getInput').mockImplementation((inputOption) => {
        if (inputOption === 'built-charm-path') return builtCharmPath;
        return 'something';
      });

      const action = new UploadCharmAction() as any;
      action.snap.install = jest.fn();
      action.charmcraft.uploadResources = jest.fn(() => ({
        flags: ['f1', 'f2'],
        resourceInfo: 'some info',
      }));
      action.charmcraft.fetchFileFlags = jest.fn(() => ({
        flags: ['f1', 'f2'],
        resourceInfo: 'some info',
      }));
      action.charmcraft.buildStaticFlags = jest.fn(() => ({
        flags: ['f1', 'f2'],
        resourceInfo: 'some info',
      }));
      action.charmcraft.upload = jest.fn();
      action.tagger.tag = jest.fn();
      action.artifacts.uploadLogs = jest.fn();

      action.charmcraft.pack = jest.fn(() => charmcraftPackOutput);

      await action.run();

      if (builtCharmPath) {
        const expectedPaths = builtCharmPath.split(',').map((p) => p.trim());
        expect(action.charmcraft.upload).toHaveBeenCalledTimes(
          expectedPaths.length,
        );
        expectedPaths.forEach((expectedPath, index) => {
          expect(action.charmcraft.upload).toHaveBeenNthCalledWith(
            index + 1,
            expectedPath,
            'something',
            ['f1', 'f2', 'f1', 'f2', 'f1', 'f2'],
          );
        });
      } else {
        expect(action.charmcraft.upload).toHaveBeenCalledTimes(
          charmcraftPackOutput.length,
        );
        charmcraftPackOutput.forEach((charmFile) => {
          expect(action.charmcraft.upload).toHaveBeenCalledWith(
            charmFile,
            'something',
            ['f1', 'f2', 'f1', 'f2', 'f1', 'f2'],
          );
        });
      }
    });
  });
});
