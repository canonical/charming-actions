import { context } from '@actions/github';
import { Tagger } from './tagging';

let tagger: Tagger;
const MOCK_HASH = 'SOME-MOCK-SHA';

describe('the tagging helper', () => {
  beforeAll(() => {
    tagger = new Tagger('...');
    process.env['GITHUB_SHA'] = MOCK_HASH;
  });

  describe('the get date function', () => {
    it('should return a formatted UTC date', () => {
      const output = tagger._get_date_text();
      const isValid = /\d{2}:\d{2} UTC on \d{1,2} \w{3} \d{4}/.test(output);
      expect(output).toBeDefined();
      expect(isValid).toBeTruthy();
    });
  });

  describe('when calling the tag function', () => {
    it('should call the github rest api with the expected parameters', async () => {
      const { repos } = tagger.kit.rest;
      jest
        .spyOn(context, 'repo', 'get')
        .mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
      jest.spyOn(repos, 'createRelease').mockReturnValue({} as any);

      const expected = expect.objectContaining({
        draft: false,
        generate_release_notes: true,
        name: 'Revision 12',
        owner: 'test-owner',
        repo: 'test-repo',
        target_commitish: MOCK_HASH,
      });

      await tagger.tag('12', 'edge', 'SOME-RESOURCES-STRING');
      expect(repos.createRelease).toHaveBeenCalledWith(expected);
    });
  });
});
