import * as core from '@actions/core';
import * as process from 'process';

import { Tagger } from '../tagging';
import { Snap } from '../snap';
import { Charmcraft } from '../charmcraft';
import { Bundle } from '../bundle';
import { Artifact } from '../artifact';

class UploadAction {
  private artifacts: Artifact;
  private snap: Snap;
  private tagger: Tagger;

  private bundlePath?: string;
  private channel: string;
  private charmcraftChannel: string;
  private charmPath: string;
  private tagPrefix?: string;
  private token: string;

  constructor() {
    this.bundlePath = core.getInput('bundle-path');
    this.channel = core.getInput('channel');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.charmPath = core.getInput('charm-path');
    this.tagPrefix = core.getInput('tag-prefix');
    this.token = core.getInput('github-token');

    if (!this.token) {
      throw new Error(
        `Input 'github-token' is missing, and not provided in environment`
      );
    }
    this.artifacts = new Artifact();
    this.snap = new Snap();
    this.tagger = new Tagger(this.token);
  }

  async run() {
    try {
      await this.snap.install('charmcraft', this.charmcraftChannel);
      if (this.bundlePath) {
        await this.uploadBundle();
      } else {
        await this.uploadCharm();
      }
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }

  private async uploadBundle() {
    await this.snap.install('juju-bundle');
    await new Bundle().publish(this.bundlePath!, this.channel);
  }

  private async uploadCharm() {
    process.chdir(this.charmPath!);
    const charmcraft = new Charmcraft();
    await charmcraft.pack();

    const { flags, resourceInfo } = await charmcraft.uploadResources();
    const rev = await charmcraft.upload(this.channel, flags);

    await this.tagger.tag(rev, this.channel, resourceInfo, this.tagPrefix);
  }
}

(async () => {
  await new UploadAction().run();
})();
