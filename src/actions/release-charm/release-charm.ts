import * as core from '@actions/core';

import { Tagger, Snap, Charmcraft, Artifact } from '../../services';
import { getResourcesInfoByRelease } from './helpers';

export class ReleaseCharmAction {
  private artifacts: Artifact;
  private snap: Snap;
  private tagger: Tagger;
  private charmcraft: Charmcraft;

  private destinationChannel: string;
  private originChannel: string;
  private revision: string;
  private charmcraftChannel: string;
  private token: string;
  private tagPrefix: string;

  constructor() {
    this.destinationChannel = core.getInput('destination-channel');
    this.originChannel = core.getInput('origin-channel');
    this.revision = core.getInput('revision');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.token = core.getInput('github-token');
    this.tagPrefix = core.getInput('tag-prefix');

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
      const { name: charmName, images: charmImages } =
        this.charmcraft.metadata();

      const [originTrack, originChannel] = this.originChannel.split('/');

      const revision = this.revision
        ? this.revision
        : await this.charmcraft.getRevisionFromChannel(
            charmName,
            originTrack,
            originChannel
          );

      const tagName = `${
        this.tagPrefix ? `${this.tagPrefix}-` : ''
      }rev${revision}`;
      const release = await this.tagger.getReleaseByTag(tagName);
      const resourceInfo =
        charmImages.length === 0 ? [] : getResourcesInfoByRelease(release);

      await this.charmcraft.release(
        charmName,
        revision,
        this.destinationChannel,
        resourceInfo
      );

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
