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
      const output = tagger.get_date_text();
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

  describe('getReleaseByTag', () => {
    it('gets the correct resource-revision', async () => {
      const testData = {
        url: 'https://api.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992',
        assets_url:
          'https://api.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992/assets',
        upload_url:
          'https://uploads.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992/assets{?name,label}',
        html_url:
          'https://github.com/canonical/prometheus-k8s-operator/releases/tag/rev29',
        id: 63168992,
        author: {
          login: 'github-actions[bot]',
          id: 41898282,
          node_id: 'MDM6Qm90NDE4OTgyODI=',
          avatar_url: 'https://avatars.githubusercontent.com/in/15368?v=4',
          gravatar_id: '',
          url: 'https://api.github.com/users/github-actions%5Bbot%5D',
          html_url: 'https://github.com/apps/github-actions',
          followers_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/followers',
          following_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/following{/other_user}',
          gists_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/gists{/gist_id}',
          starred_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/starred{/owner}{/repo}',
          subscriptions_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/subscriptions',
          organizations_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/orgs',
          repos_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/repos',
          events_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/events{/privacy}',
          received_events_url:
            'https://api.github.com/users/github-actions%5Bbot%5D/received_events',
          type: 'Bot',
          site_admin: false,
        },
        node_id: 'RE_kwDOEcVEWM4Dw-Hg',
        tag_name: 'rev29',
        target_commitish: 'a369c99cfdafeceaf94b1ec3ba1d961a11bb0cc6',
        name: 'Revision 29',
        draft: false,
        prerelease: false,
        created_at: '2022-03-30T14:44:35Z',
        published_at: '2022-03-30T15:31:59Z',
        assets: [],
        tarball_url:
          'https://api.github.com/repos/canonical/prometheus-k8s-operator/tarball/rev29',
        zipball_url:
          'https://api.github.com/repos/canonical/prometheus-k8s-operator/zipball/rev29',
        body: "resources:\n    -  prometheus-image: docker.io/ubuntu/prometheus@sha256:03936a740851b8786c328e08803a70feaa97731714a8dbe4b709c44366699b0c\n       resource-revision: 10\n\n    -  promql-transform-amd64: \n       resource-revision: 6\n    -  promql-transform-arm64: \n       resource-revision: 6\n\nStatic resources:\n Released to 'latest/edge' at 15:31 UTC on 30 Mar 2022\n\n## What's Changed\n* remote_write_2 by @dstathis in https://github.com/canonical/prometheus-k8s-operator/pull/254\n\n\n**Full Changelog**: https://github.com/canonical/prometheus-k8s-operator/compare/rev28...rev29",
        mentions_count: 1,
      };
      tagger = new Tagger('fake-token');

      const { repos } = tagger.kit.rest;
      jest
        .spyOn(repos, 'getReleaseByTag')
        .mockReturnValue({ status: 200, data: testData } as any);

      const resourceInfo = await tagger.getReleaseByTag('rev29');
      expect(resourceInfo).toEqual(testData);
    });

    it('throws error if tag does not exit', async () => {
      tagger = new Tagger('fake-token');

      const { repos } = tagger.kit.rest;
      jest.spyOn(repos, 'getReleaseByTag').mockReturnValue({
        status: 404,
        data: {
          message: 'Not Found',
          documentation_url:
            'https://docs.github.com/rest/reference/repos#get-a-release-by-tag-name',
        },
      } as any);

      await expect(tagger.getReleaseByTag('rev14')).rejects.toThrow(
        Error(`Cannot find release by tag rev14`)
      );
    });
  });
});
