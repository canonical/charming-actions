import * as core from '@actions/core';
import { exec, ExecOptions, getExecOutput } from '@actions/exec';
import * as glob from '@actions/glob';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { Metadata } from '../../types';

/* eslint-disable camelcase */

class Charmcraft {
  private uploadImage: boolean;
  private token: string;
  private execOptions: ExecOptions;
  constructor(token?: string) {
    this.uploadImage = core.getInput('upload-image').toLowerCase() === 'true';
    this.token = token || core.getInput('credentials');
    this.execOptions = {
      env: {
        ...process.env,
        CHARMCRAFT_AUTH: this.token,
      },
    };
  }

  async uploadResources() {
    let resourceInfo = 'resources:\n';
    if (!this.uploadImage) {
      const msg =
        `No resources where uploaded as part of this build.\n` +
        `If you wish to upload the OCI image, set 'upload-image' to 'true'`;
      core.warning(msg);
      return { flags: [''], resourceInfo: '' };
    }

    const { name, images } = this.metadata();
    const flags = await Promise.all(
      images.map(async ([resource_name, resource_image]) => {
        await this.uploadResource(resource_image, name, resource_name);
        const { flag, info } = await this.buildResourceFlag(
          name,
          resource_name,
          resource_image
        );
        resourceInfo += info;
        return flag;
      })
    );
    return { flags, resourceInfo };
  }

  async uploadResource(
    resource_image: string,
    name: string,
    resource_name: string
  ) {
    const pullExitCode = await exec(
      'docker',
      ['pull', resource_image],
      this.execOptions
    );
    if (pullExitCode !== 0) {
      throw new Error('Could not pull the docker image.');
    }

    const args = [
      'upload-resource',
      '--quiet',
      name,
      resource_name,
      '--image',
      resource_image,
    ];
    await exec('charmcraft', args, this.execOptions);
  }

  async buildResourceFlag(
    name: string,
    resource_name: string,
    resource_image: string
  ) {
    const args = ['resource-revisions', name, resource_name];
    const result = await getExecOutput('charmcraft', args, this.execOptions);

    /*
    ❯ charmcraft resource-revisions prometheus-k8s prometheus-image
      Revision    Created at    Size                                                                                                                                                                                                                                                                
      1           2021-07-19    512B
      ^-- This value
    */
    const revision = result.stdout.split('\n')[1].split(' ')[0];

    return {
      flag: `--resource=${resource_name}:${revision}`,
      info:
        `    -  ${resource_name}: ${resource_image}\n` +
        `       resource-revision: ${revision}\n`,
    };
  }

  metadata() {
    const buff = fs.readFileSync('metadata.yaml');
    const metadata = yaml.load(buff.toString()) as Metadata;
    const charmName = metadata.name;

    const images = Object.entries(metadata.resources || {})
      .filter(([, res]) => res.type === 'oci-image')
      .map(([name, res]) => [name, res['upstream-source']]);
    return { images, name: charmName };
  }

  async pack() {
    const args = ['pack', '--destructive-mode', '--quiet'];
    await exec('charmcraft', args, this.execOptions);
  }

  async upload(channel: string, flags: string[]): Promise<string> {
    // as we don't know the name of the name of the charm file output, we'll need to glob for it.
    // however, we expect charmcraft pack to always output one charm file.
    const globber = await glob.create('./*.charm');
    const paths = await globber.glob();
    const args = [
      'upload',
      '--quiet',
      '--release',
      channel,
      paths[0],
      ...flags,
    ];
    const result = await getExecOutput('charmcraft', args, this.execOptions);
    const newRevision = result.stdout.split(' ')[1];
    return newRevision;
  }

  async hasDriftingLibs(): Promise<LibStatus> {
    const { name } = this.metadata();
    const args = ['fetch-lib'];
    const result = await getExecOutput('charmcraft', args, this.execOptions);
    const re = new RegExp(`${name}`);
    const lines = result.stderr
      .concat(result.stdout)
      .split('\n')
      .filter((x) => !re.test(x))
      .filter((x) =>
        /(updated to version|not found in Charmhub|has local changes)/.test(x)
      );

    const { stdout: out, stderr: err } = result;

    return { ok: lines.length <= 0, out, err };
  }
}

export interface LibStatus {
  ok: boolean;
  out: string;
  err: string;
}

export { Charmcraft };
