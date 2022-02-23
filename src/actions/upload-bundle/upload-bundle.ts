import * as core from '@actions/core';
import { Snap, Bundle, Artifact } from '../../services';

export class UploadBundleAction {
  private artifacts: Artifact;
  private snap: Snap;
  private bundle: Bundle;

  private bundlePath?: string;
  private channel: string;
  private charmcraftChannel: string;
  private token: string;

  constructor() {
    this.bundle = new Bundle();
    this.bundlePath = core.getInput('bundle-path');
    this.channel = core.getInput('channel');
    this.charmcraftChannel = core.getInput('charmcraft-channel');
    this.token = core.getInput('github-token');

    if (!this.token) {
      throw new Error(
        `Input 'github-token' is missing, and not provided in environment`
      );
    }

    this.artifacts = new Artifact();
    this.snap = new Snap();
  }

  async run() {
    try {
      await this.snap.install('charmcraft', this.charmcraftChannel);
      await this.snap.install('juju-bundle');
      await this.bundle.publish(this.bundlePath!, this.channel);
      // TODO: add tagging of bundles -SA 2022-02-18
    } catch (error: any) {
      core.setFailed(error.message);
      core.error(error.stack);
    }

    const result = await this.artifacts.uploadLogs();
    core.info(result);
  }
}
