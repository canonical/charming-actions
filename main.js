'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
import { chdir } from 'process';
const glob = require('@actions/glob');
const artifact = require('@actions/artifact');


(async () => {
  try {
    const credentials = core.getInput('credentials');
    const charm_path = core.getInput('charm-path');
    const charmcraft_channel = core.getInput('charmcraft-channel');

    chdir(charm_path);

    await exec.exec('sudo', [
      'snap',
      'install',
      'charmcraft',
      '--classic',
      '--channel',
      charmcraft_channel,
    ]);

    await exec.exec('charmcraft', ['pack', '--destructive-mode', '-q']);

    const globber = await glob.create('./*.charm');
    const paths = await globber.glob();

    await Promise.all(
      paths.map((path) =>
        exec.exec(
          'charmcraft',
          ['upload', '-q', '--release=latest/edge', path],
          { env: { CHARMCRAFT_AUTH: credentials } }
        )
      )
    );

  } catch (error) {
    core.setFailed(error.message);

  } finally {
    const root = '/home/runner/snap/charmcraft/common/cache/charmcraft/log/';
    const globber = await glob.create(root + '*.log');
    const files = await globber.glob();
    const artifactClient = artifact.create();

    const result = await artifactClient.uploadArtifact('charmcraft-logs', files, root);
    core.info(`Artifact upload result: ${JSON.stringify(result)}`)
  }
})();
