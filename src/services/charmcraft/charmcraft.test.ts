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
        charmcraft.metadata = () => ({ name: 'hello', images: [] });
        jest
          .spyOn(exec, 'getExecOutput')
          .mockResolvedValue({ exitCode: 0, stderr: text, stdout: '' });

        const status = await charmcraft.hasDriftingLibs();
        expect(status.ok).toEqual(expected);
      });
    });
  });
});
