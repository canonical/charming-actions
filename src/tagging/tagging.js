const github = require("@actions/github");
const utc = require("dayjs/plugin/utc");
const dayjs = require("dayjs");

dayjs.extend(utc);

class Tagger {
  constructor(token) {
    this.kit = github.getOctokit(token);
  }

  async tag(revision, channel, resources) {
    const { owner, repo } = github.context.repo;

    const content = this._build(
      owner,
      repo,
      process.env.GITHUB_SHA,
      revision,
      channel,
      resources
    );

    await this.kit.rest.repos.createRelease(content);
  }

  _build(owner, repo, hash, revision, channel, resources) {
    const name = `rev${revision}`;
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
    return dayjs().utc().format("HH:mm UTC on D MMM YYYY");
  }
}

module.exports = Tagger;
