import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import utc from 'dayjs/plugin/utc';
import dayjs from 'dayjs';

dayjs.extend(utc);

class Tagger {
  kit: InstanceType<typeof GitHub>;

  constructor(token: string) {
    this.kit = getOctokit(token);
  }

  async tag(
    revision: string,
    channel: string,
    resources: string,
    tagPrefix?: string
  ) {
    const { owner, repo } = context.repo;
    if (context.eventName.includes('pull_request')) {
      return;
    }
    const content = this._build(
      owner,
      repo,
      process.env['GITHUB_SHA'] as string,
      revision,
      channel,
      resources,
      tagPrefix
    );

    await this.kit.rest.repos.createRelease(content);
  }

  _build(
    owner: string,
    repo: string,
    hash: string,
    revision: string,
    channel: string,
    resources: string,
    tagPrefix?: string
  ) {
    const name = `${tagPrefix ? `${tagPrefix}-` : ''}rev${revision}`;
    const message = `${resources} Released to '${channel}' at ${this._get_date_text()}`;

    return {
      owner,
      repo,
      name: `Revision ${revision}`,
      tag_name: name,
      body: message,
      draft: false,
      prerelease: false,
      generate_release_notes: true,
      target_commitish: hash,
    };
  }

  _get_date_text() {
    // 12:00 UTC on 10 Feb 2022
    return dayjs().utc().format('HH:mm UTC on D MMM YYYY');
  }
}

export { Tagger };
