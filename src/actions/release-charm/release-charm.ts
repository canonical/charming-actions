import * as core from '@actions/core';

import { Tagger, Snap, Charmcraft, Artifact } from '../../services';

export class ReleaseCharmAction {
  private artifacts: Artifact;
  private snap: Snap;
  private tagger: Tagger;
  private charmcraft: Charmcraft;

  private destinationChannel: string;
  private originChannel: string;
  private baseName: string;
  private baseChannel: string;
  private baseArchitecture: string;

  private charmcraftChannel: string;
  private token: string;
  private tagPrefix: string;
  private charmPath: string;

  constructor() {
    this.destinationChannel = core.getInput('destination-channel');
    this.originChannel = core.getInput('origin-channel');
    this.baseName = core.getInput('base-name');
    this.baseChannel = core.getInput('base-channel');
    this.baseArchitecture = core.getInput('base-architecture');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.token = core.getInput('github-token');
    this.tagPrefix = core.getInput('tag-prefix');
    this.charmPath = core.getInput('charm-path');

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
      const { name: charmName } = await this.charmcraft.metadata();

      const [originTrack, originChannel] = this.originChannel.split('/');

      const base = {
        name: this.baseName,
        channel: this.baseChannel,
        architecture: this.baseArchitecture,
      };

      const { charmRev, resources } =
        await this.charmcraft.getRevisionInfoFromChannelJson(
          charmName,
          originTrack,
          originChannel,
          base,
        );

      await this.charmcraft.release(
        charmName,
        charmRev,
        this.destinationChannel,
        resources,
      );

      const tagName = `${
        this.tagPrefix ? `${this.tagPrefix}-` : ''
      }rev${charmRev}`;
      const release = await this.tagger.getReleaseByTag(tagName);

      const newReleaseString = `Released to '${
        this.destinationChannel
      }' at ${this.tagger.get_date_text()}\n`;

      // add release string between last release statement and generated release note (What's changed section)
      const generateNotesIndex = release.body?.indexOf("## What's Changed");
      const newReleaseBody = release.body
        ?.slice(0, generateNotesIndex)
        .concat(newReleaseString, release.body.slice(generateNotesIndex));

      await this.tagger.updateRelease(release.id, newReleaseBody);
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }
}
