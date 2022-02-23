import core from '@actions/core';
import github from '@actions/github';
import process from 'process';

import { Tagger, Snap, Charmcraft, Bundle, Ref, Artifact } from './services';

(async () => {
  try {
    const charmPath = core.getInput('charm-path');
    const bundlePath = core.getInput('bundle-path');

    const token = core.getInput('github-token') || process.env['GITHUB_TOKEN'];
    if (!token) {
      throw new Error(
        `Input 'github-token' is missing, and not provided in environment`
      );
    }

    const channel = new Ref(github.context).channel();
    const snap = new Snap();
    await snap.install('charmcraft', core.getInput('charmcraft-channel'));

    // Publish a bundle or a charm, depending on if `bundle_path` or `charm_path` was set
    if (bundlePath) {
      await snap.install('juju-bundle');
      await new Bundle().publish(bundlePath, channel);
      // TODO: Needs to tag bundles as well
      return;
    }

    process.chdir(charmPath);

    const charmcraft = new Charmcraft();
    await charmcraft.pack();

    const { flags, resourceInfo } = await charmcraft.uploadResources();
    const charmRevisions = await charmcraft.upload(channel, flags);

    // TODO: Needs to prefix the tag with the charm name
    const tagger = new Tagger(token);
    await tagger.tag(charmRevisions[0], channel, resourceInfo);
  } catch (error: any) {
    core.setFailed(error.message);
    core.error(error.stack);
  }

  const result = await new Artifact().uploadLogs();
  core.info(result);
})();
