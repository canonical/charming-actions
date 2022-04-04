import { getResourcesInfoByRelease } from './helpers';

describe('getResourcesInfoByRevNum', () => {
  it('gets the correct resource-revision', async () => {
    const releaseData = {
      url: 'https://api.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992',
      assets_url:
        'https://api.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992/assets',
      upload_url:
        'https://uploads.github.com/repos/canonical/prometheus-k8s-operator/releases/63168992/assets{?name,label}',
      html_url:
        'https://github.com/canonical/prometheus-k8s-operator/releases/tag/rev29',
      id: 63168992,
      author: {},
      node_id: 'node_id',
      tag_name: 'rev29',
      target_commitish: 'commithash',
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

    const resourceInfo = getResourcesInfoByRelease(releaseData as any);
    expect(resourceInfo).toEqual(
      expect.arrayContaining(
        [
          { resourceName: 'prometheus-image', resourceRev: '10' },
          { resourceName: 'promql-transform-amd64', resourceRev: '6' },
          { resourceName: 'promql-transform-amd64', resourceRev: '6' },
        ].sort()
      )
    );
  });

  it('throws error if response does not have a property named body', async () => {
    expect(() =>
      getResourcesInfoByRelease({ tag_name: 'rev14' } as any)
    ).toThrow(Error(`Cannot find release body in tag rev14`));
  });

  it('throws error if body does not contain resource-revision', async () => {
    expect(() =>
      getResourcesInfoByRelease({
        tag_name: 'rev14',
        body: 'hello world',
      } as any)
    ).toThrow(Error(`Cannot find resources info in release with tag rev14`));
  });
});
