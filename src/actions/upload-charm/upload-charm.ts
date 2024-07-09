import * as core from '@actions/core';
import * as process from 'process';

import { Tagger, Snap, Charmcraft, Artifact } from '../../services';

export class UploadCharmAction {
  private artifacts: Artifact;
  private snap: Snap;
  private tagger: Tagger;
  private charmcraft: Charmcraft;

  private channel: string;
  private destructive: boolean;
  private charmcraftChannel: string;
  private builtCharmPath: string;
  private charmPath: string;
  private tagPrefix?: string;
  private token: string;
  private githubTag: boolean;

  constructor() {
    this.channel = core.getInput('channel');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.builtCharmPath = core.getInput('built-charm-path');
    this.charmPath = core.getInput('charm-path');
    this.tagPrefix = core.getInput('tag-prefix');
    this.token = core.getInput('github-token');
    this.destructive = core.getBooleanInput('destructive-mode');
    this.githubTag = core.getBooleanInput('github-tag');

    if (!this.token) {
      throw new Error(`Input 'github-token' is missing`);
    }
    this.artifacts = new Artifact();
    this.snap = new Snap();
    this.tagger = new Tagger(this.token);
    this.charmcraft = new Charmcraft();
  }

  get overrides(): { [key: string]: string } {
    const raw = core.getInput('resource-overrides');

    return !raw
      ? {}
      : raw.split(',').reduce((a, e) => {
          const [name, rev] = e.split(':');
          return {
            ...a,
            [name]: rev,
          };
        }, {});
  }

  async run() {
    try {
      await this.snap.install('charmcraft', this.charmcraftChannel);
      process.chdir(this.charmPath!);

      const charms = this.builtCharmPath
        ? [this.builtCharmPath]
        : await this.charmcraft.pack(this.destructive);

      const overrides = this.overrides!;

      const imageResults = await this.charmcraft.uploadResources(overrides);
      // const fileResults = await this.charmcraft.fetchFileFlags(overrides);
      // const staticResults = this.charmcraft.buildStaticFlags(overrides);

      const resourceInfo = [
        imageResults.resourceInfo,
        // fileResults.resourceInfo,
        // staticResults.resourceInfo,
      ].join('\n');

      const flags = [
        ...imageResults.flags,
        // ...fileResults.flags,
        // ...staticResults.flags,
      ];

      // If there are multiple charm files, we upload them one by one, so that the file
      // released at last(which determines the version under 'platform' shown on Charmhub UI)
      // is consistent for a charm.
      await charms.reduce(async (previousUpload, charm) => {
        await previousUpload;
        const rev = await this.charmcraft.upload(charm, this.channel, flags);
        if (this.githubTag) {
          await this.tagger.tag(
            rev,
            this.channel,
            resourceInfo,
            this.tagPrefix,
          );
        }
      }, Promise.resolve());
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }
}
