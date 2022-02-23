import * as core from '@actions/core';
import * as process from 'process';

import { Tagger, Snap, Charmcraft, Artifact } from '../../services';

export class UploadCharmAction {
  private artifacts: Artifact;
  private snap: Snap;
  private tagger: Tagger;
  private charmcraft: Charmcraft;

  private channel: string;
  private charmcraftChannel: string;
  private charmPath: string;
  private tagPrefix?: string;
  private token: string;

  constructor() {
    this.channel = core.getInput('channel');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.charmPath = core.getInput('charm-path');
    this.tagPrefix = core.getInput('tag-prefix');
    this.token = core.getInput('github-token');

    if (!this.token) {
      throw new Error(`Input 'github-token' is missing`);
    }
    this.artifacts = new Artifact();
    this.snap = new Snap();
    this.tagger = new Tagger(this.token);
    this.charmcraft = new Charmcraft();
  }

  async run() {
    try {
      await this.snap.install('charmcraft', this.charmcraftChannel);
      process.chdir(this.charmPath!);
      await this.charmcraft.pack();

      const { flags, resourceInfo } = await this.charmcraft.uploadResources();
      const rev = await this.charmcraft.upload(this.channel, flags);

      await this.tagger.tag(rev, this.channel, resourceInfo, this.tagPrefix);
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }
}
