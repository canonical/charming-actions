import * as exec from '@actions/exec';
import { Snap } from './snap';

describe('the snap helper', () => {
  describe('the install function', () => {
    let execSpy: jest.SpyInstance;
    beforeEach(() => {
      execSpy = jest.spyOn(exec, 'exec').mockResolvedValue(true as never);
    });
    it('should install from channel if one was supplied', async () => {
      const snap = new Snap();
      await snap.install('charmcraft', 'latest/beta');
      expect(execSpy).toHaveBeenCalledWith('sudo', [
        'snap',
        'install',
        'charmcraft',
        '--classic',
        '--channel',
        'latest/beta',
      ]);
    });
    it('should not specify a channel if none was supplied', async () => {
      const snap = new Snap();
      await snap.install('charmcraft');
      expect(execSpy).toHaveBeenCalledWith('sudo', [
        'snap',
        'install',
        'charmcraft',
        '--classic',
      ]);
    });
  });
});
