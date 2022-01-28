'use strict';

const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const github = require('@actions/github');
const glob = require('@actions/glob');
const process = require('process');
const yaml = require('js-yaml');

(async () => {
  try {
    const credentials = core.getInput('credentials');
    const charm_path = core.getInput('charm-path');
    const bundle_path = core.getInput('bundle-path');
    const charmcraft_channel = core.getInput('charmcraft-channel');
    let upload_image = core.getInput('upload-image');
    if (!['false', 'true'].includes(upload_image.toLowerCase())) {
      core.error(
        `Valid values for upload-image are 'true', 'false'. Got ${upload_image}`
      );
      return;
    }
    upload_image = upload_image.toLowerCase() == 'true';

    await exec.exec('sudo', [
      'snap',
      'install',
      'charmcraft',
      '--classic',
      '--channel',
      charmcraft_channel,
    ]);

    if (bundle_path) {
      await exec.exec('sudo', ['snap', 'install', 'juju-bundle', '--classic']);
    }

    core.exportVariable('CHARMCRAFT_AUTH', credentials);

    const ctx = github.context;
    const event = ctx.eventName;

    let channel;

    if (event == 'push') {
      if (ctx.ref.startsWith('refs/heads/')) {
        let branch = ctx.ref.replace('refs/heads/', '');

        if (branch == ctx.payload.repository.master_branch) {
          channel = 'latest/edge';
        } else if (branch.startsWith('track/')) {
          channel = branch.replace('track/', '') + '/edge';
        } else {
          core.notice(`Unhandled branch name ${ctx.ref}`);
          return;
        }
      } else {
        core.setFailed(`Unknown type of ref: ${github.context.ref}`);
        return;
      }
    } else if (event == 'pull_request') {
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
          return;
        }
      } else {
        core.notice(`Unhandled branch name: ${head_ref}`);
        return;
      }
    } else {
      core.setFailed(`Unknown eventType ${event}.`);
      return;
    }

    // Publish a bundle or a charm, depending on if `bundle_path` or `charm_path` was set
    if (bundle_path) {
      process.chdir(bundle_path);
      await exec.exec('juju-bundle', [
        'publish',
        '--destructive-mode',
        '--serial',
        '--release',
        channel,
      ]);
    } else {
      process.chdir(charm_path);
      const metadata = yaml.load(fs.readFileSync('metadata.yaml'));

      const name = metadata.name;
      const images = Object.entries(metadata.resources || {})
        .filter(([_, res]) => res.type === 'oci-image')
        .map(([name, res]) => [name, res['upstream-source']]);

      await exec.exec('charmcraft', ['pack', '--destructive-mode', '--quiet']);

      const revisions = await Promise.all(
        images.map(async ([resource_name, resource_image]) => {
          if (upload_image) {
            await exec.exec('docker', ['pull', resource_image]);
            await exec.exec('charmcraft', [
              'upload-resource',
              '--quiet',
              name,
              resource_name,
              '--image',
              resource_image,
            ]);
          } else {
            core.warning(
              "No resources where uploaded as part of this build. \
              If you wish to upload the OCI image, set 'upload-image' to 'true'"
            );
          }
          let result = await exec.getExecOutput('charmcraft', [
            'resource-revisions',
            name,
            resource_name,
          ]);
          let revision = result.stdout.split('\n')[1].split(' ')[0];

          return `--resource=${resource_name}:${revision}`;
        })
      );

      const globber = await glob.create('./*.charm');
      const paths = await globber.glob();

      await Promise.all(
        paths.map((path) =>
          exec.exec(
            'charmcraft',
            ['upload', '--quiet', '--release', channel, path].concat(revisions)
          )
        )
      );
    }
  } catch (error) {
    core.setFailed(error.message);
    core.error(error.stack);
  } finally {
    const root = '/home/runner/snap/charmcraft/common/cache/charmcraft/log/';

    if (!fs.existsSync(root)) {
      core.info('No charmcraft logs generated, skipping artifact upload.');
      return;
    }

    const globber = await glob.create(root + '*.log');
    const files = await globber.glob();
    const artifactClient = artifact.create();

    const result = await artifactClient.uploadArtifact(
      'charmcraft-logs',
      files,
      root
    );
    core.info(`Artifact upload result: ${JSON.stringify(result)}`);
  }
})();
