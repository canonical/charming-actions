'use strict';

const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const github = require('@actions/github');
const glob = require('@actions/glob');
const yaml = require('js-yaml');
import { chdir } from 'process';

(async () => {
  try {
    const credentials = core.getInput('credentials');
    const charm_path = core.getInput('charm-path');
    const charmcraft_channel = core.getInput('charmcraft-channel');

    await exec.exec('sudo', [
      'snap',
      'install',
      'charmcraft',
      '--classic',
      '--channel',
      charmcraft_channel,
    ]);

    chdir(charm_path);
    core.exportVariable('CHARMCRAFT_AUTH', credentials);

    const metadata = yaml.load(fs.readFileSync('metadata.yaml'));

    const name = metadata.name;
    const images = Object.entries(metadata.resources)
      .filter(([_, res]) => res.type === 'oci-image')
      .map(([name, res]) => [name, res['upstream-source']]);

    const ctx = github.context;
    const event = ctx.eventName;

    let channel;

    if (event == "push") {
      if (ctx.ref.startsWith('refs/heads/')) {
        let branch = ctx.ref.replace('refs/heads/', '');

        if (branch == ctx.payload.repository.master_branch) {
          channel = 'latest/edge';
        } else if (branch.startsWith('track/')) {
          channel = branch.replace('track/', '') + '/edge';
        } else {
          core.notice(`Unhandled branch name ${ctx.ref}`);
          return
        }
      } else {
        core.setFailed(`Unknown type of ref: ${github.context.ref}`);
        return
      }
    } else if (event == "pull_request") {
      const base_ref = ctx.payload.pull_request.base.ref;
      const head_ref = ctx.payload.pull_request.head.ref;

      if (head_ref.startsWith('branch/')) {
        const branch = head_ref.replace('branch/', '');

        if (base_ref == ctx.payload.pull_request.base.repo.default_branch) {
          channel = `latest/edge/${branch}`;
        } else if (base_ref.startsWith('track/')) {
          const track = base_ref.replace('track/', '');
          channel = `${track}/edge/${branch}`;
        } else {
          core.setFailed(`Unhandled PR base name ${base_ref}`);
          return
        }
      } else {
        core.setFailed(`Unhandled branch name: ${head_ref}`);
        return
      }
    } else {
      core.setFailed(`Unknown eventType ${event}.`)
      return;
    }

    await exec.exec('charmcraft', ['pack', '--destructive-mode', '--quiet']);

    const revisions = await Promise.all(
      images.map(async ([resource_name, resource_image]) => {
        await exec.exec('docker', ['pull', resource_image]);
        await exec.exec('charmcraft', [
          'upload-resource',
          '--quiet',
          name,
          resource_name,
          '--image',
          resource_image,
        ]);
        let result = await exec.getExecOutput('charmcraft', ['resource-revisions', name, resource_name]);
        let revision = result.stdout.split('\n')[1].split(' ')[0];

        return `--resource=${resource_name}:${revision}`;
      })
    );

    const globber = await glob.create('./*.charm');
    const paths = await globber.glob();

    await Promise.all(
      paths.map((path) =>
        exec.exec('charmcraft', ['upload', '--quiet', '--release', channel, path].concat(revisions))
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
    core.info(`Artifact upload result: ${JSON.stringify(result)}`);
  }
})();
