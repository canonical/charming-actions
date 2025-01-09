import * as core from '@actions/core';

import { Snap, Charmcraft, Artifact } from '../../services';
import { Base } from '../../services/charmcraft/types';
import { RevisionResourceInfo } from '../../types';

export class PromoteCharmAction {
  private artifacts: Artifact;
  private snap: Snap;
  private charmcraft: Charmcraft;

  private destinationChannel: string;
  private originChannel: string;

  private charmcraftChannel: string;
  private charmPath: string;

  constructor() {
    this.destinationChannel = core.getInput('destination-channel');
    this.originChannel = core.getInput('origin-channel');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.charmPath = core.getInput('charm-path');

    this.artifacts = new Artifact();
    this.snap = new Snap();
    this.charmcraft = new Charmcraft();
  }

  async getRevisions(
    name: string,
    track: string,
    channel: string,
    bases: Base[],
  ): Promise<RevisionResourceInfo[]> {
    // Filter out bases with architecture "all"
    const filteredBases = bases.filter((base) => base.architecture !== 'all');

    // Map filtered bases to their revision information
    return Promise.all(
      filteredBases.map(async (base: Base) =>
        this.charmcraft.getRevisionInfoFromChannelJson(
          name,
          track,
          channel,
          base,
        ),
      ),
    );
  }

  async run() {
    try {
      await this.snap.install('charmcraft', this.charmcraftChannel);
      process.chdir(this.charmPath!);
      const charmName = this.charmcraft.charmName();

      const [originTrack, originChannel] = this.originChannel.split('/');

      const basesArray = await this.charmcraft.getBases(charmName, originTrack);
      const revisions = await this.getRevisions(
        charmName,
        originTrack,
        originChannel,
        basesArray,
      );
      await Promise.all(
        revisions.map(async ({ charmRev, resources }) =>
          this.charmcraft.release(
            charmName,
            charmRev,
            this.destinationChannel,
            resources,
          ),
        ),
      );
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }
}
