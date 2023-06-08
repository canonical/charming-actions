import * as core from '@actions/core';
import { debug } from '@actions/core';
import { exec, ExecOptions, getExecOutput } from '@actions/exec';
import * as glob from '@actions/glob';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { Metadata, ResourceInfo } from '../../types';
import { getImageDigest } from '../docker';
import { Base, Mapping, Status, Track } from './types';

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

  async uploadResources(overrides?: { [key: string]: string }) {
    let resourceInfo = 'resources:\n';
    if (!this.uploadImage) {
      const msg =
        `No resources were uploaded as part of this build.\n` +
        `If you wish to upload the OCI image, set 'upload-image' to 'true'`;
      core.warning(msg);
    }

    const { name: charmName, images } = this.metadata();
    const flags: string[] = [];

    await Promise.all(
      images
        // If an image resource has been overridden in the action input,
        // we don't want to upload a new version of it either.
        .filter(
          ([name]) => !overrides || !Object.keys(overrides).includes(name)
        )
        .map(async ([name, image]) => {
          if (this.uploadImage) {
            await this.uploadResource(image, charmName, name);
          }
          const resourceFlag = await this.buildResourceFlag(
            charmName,
            name,
            image
          );

          if (!resourceFlag) return;

          flags.push(resourceFlag.flag);
          resourceInfo += resourceFlag.info;
        })
    );
    return { flags, resourceInfo };
  }

  async fetchFileFlags(overrides: { [key: string]: string }) {
    const { name: charmName, files } = this.metadata();
    // If an image resource has been overridden in the action input,
    // we don't want to upload a new version of it either.
    const filtered = files.filter(
      ([name]) => !overrides || !Object.keys(overrides).includes(name)
    );
    const result = { flags: [] as string[], resourceInfo: '' };
    await Promise.all(
      filtered.map(async (item) => {
        const flag = await this.buildResourceFlag(charmName, item, '');
        result.flags.push(flag.flag);
        result.resourceInfo += flag.info;
      })
    );

    return result;
  }

  buildStaticFlags(overrides: { [key: string]: string }) {
    if (!overrides) {
      return { flags: [] };
    }

    const flags = Object.entries(overrides!).map(
      ([key, value]) => `--resource=${key}:${value}`
    );

    const resourceInfo = [
      'Static resources:\n',
      ...Object.entries(overrides).map(
        ([key, val]) => `  - ${key}\n    resource-revision: ${val}\n`
      ),
    ].join('\n');

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

    const resourceDigest = await getImageDigest(resource_image);

    const args = [
      'upload-resource',
      '--quiet',
      name,
      resource_name,
      '--image',
      resourceDigest,
    ];
    await exec('charmcraft', args, this.execOptions);
  }

  async buildResourceFlag(charmName: string, name: string, image: string) {
    const args = ['resource-revisions', charmName, name];
    const result = await getExecOutput('charmcraft', args, this.execOptions);

    /*
    ❯ charmcraft resource-revisions prometheus-k8s prometheus-image
      Revision    Created at    Size
      2 <- This   2022-01-20    1024B
      1           2021-07-19    512B
      
    */

    if (result.stdout.trim().split('\n').length <= 1) {
      throw new Error(
        `Resource '${name}' does not have any uploaded revisions.`
      );
    }

    // Always pick the topmost resource revision, but skip the headers
    const revision = result.stdout.split('\n')[1].split(' ')[0];

    return {
      flag: `--resource=${name}:${revision}`,
      info:
        `    -  ${name}: ${image}\n` +
        `       resource-revision: ${revision}\n`,
    };
  }

  metadata() {
    const buffer = fs.readFileSync('metadata.yaml');
    const metadata = yaml.load(buffer.toString()) as Metadata;
    const resources = Object.entries(metadata.resources || {});

    const files = resources
      .filter(([, res]) => res.type === 'file')
      .map(([name]) => name);

    const images = resources
      .filter(([, res]) => res.type === 'oci-image')
      .map(([name, res]) => [name, res['upstream-source']]);

    return {
      images,
      files,
      name: metadata.name,
    };
  }

  async pack(destructive?: boolean) {
    const args = ['charmcraft', 'pack', '--quiet'];

    if (destructive) args.push('--destructive-mode');

    await exec('sudo', args, this.execOptions);
    // as we don't know the name of the name of the charm file output, we'll need to glob for it.
    // however, we expect charmcraft pack to always output one charm file.
    const globber = await glob.create('./*.charm');
    const paths = await globber.glob();
    return paths[0];
  }

  async upload(
    charm: string,
    channel: string,
    flags: string[]
  ): Promise<string> {
    const args = [
      'upload',
      '--format',
      'json',
      '--release',
      channel,
      charm,
      ...flags,
    ];
    const result = await getExecOutput('charmcraft', args, this.execOptions);
    const newRevision = JSON.parse(result.stdout).revision;
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

  async status(charm: string): Promise<string> {
    const result = await getExecOutput(
      'charmcraft',
      ['status', charm],
      this.execOptions
    );
    return result.stdout;
  }

  async statusJson(charm: string): Promise<Status> {
    const result = await getExecOutput(
      'charmcraft',
      ['status', charm, '--format', 'json'],
      this.execOptions
    );
    const parsedObj = JSON.parse(result.stdout);
    return parsedObj;
  }

  async getRevisionInfoFromChannel(
    charm: string,
    track: string,
    channel: string
  ): Promise<{ charmRev: string; resources: Array<ResourceInfo> }> {
    // For now we have to parse the `charmcraft status` output this will soon be fixed
    // when we can get json output from charmcraft.
    // Issue tracked here: https://github.com/canonical/charmcraft/issues/183
    const acceptedChannels = ['stable', 'candidate', 'beta', 'edge'];
    if (!acceptedChannels.includes(channel)) {
      throw new Error(
        `Provided channel ${channel} is not supported. This actions currently only works with one of the following default channels: edge, beta, candidate, stable`
      );
    }
    const charmcraftStatus = await this.status(charm);
    const channelLine: Record<string, number> = {
      stable: 0,
      candidate: 1,
      beta: 2,
      edge: 3,
    };
    const lines = charmcraftStatus.split('\n');
    for (let i = 1; i < lines.length; i += 4) {
      // find line with track name
      if (lines[i].includes(track)) {
        i += channelLine[channel];
        const targetLine =
          channel === 'stable'
            ? lines[i].slice(lines[i].search(/stable/g))
            : lines[i];
        const splitLine = targetLine.trim().split(/\s{2,}/);
        const revision = splitLine[2];
        if (revision === '-') {
          throw new Error(`No revision available in ${track}/${channel}`);
        }
        const resources = splitLine[3].split(',').reduce((acc, res) => {
          if (res === '-') {
            return acc;
          }
          const [resName, resRev] = res.trim().split(' ');
          const revisionNum = resRev.replace(/\D/g, '');
          acc.push({ resourceName: resName, resourceRev: revisionNum });
          return acc;
        }, [] as Array<ResourceInfo>);
        return { charmRev: revision, resources };
      }
    }
    throw new Error(`No track with name ${track}`);
  }

  async getRevisionInfoFromChannelJson(
    charm: string,
    targetTrack: string,
    targetChannel: string,
    targetBase: Base
  ): Promise<{ charmRev: string; resources: Array<ResourceInfo> }> {
    const acceptedChannels = ['stable', 'candidate', 'beta', 'edge'];
    if (!acceptedChannels.includes(targetChannel)) {
      throw new Error(
        `Provided channel ${targetChannel} is not supported. This actions currently only works with one of the following default channels: edge, beta, candidate, stable`
      );
    }

    // Get status of this charm as a structured object
    const charmcraftStatus = await this.statusJson(charm);

    const trackIndex = charmcraftStatus.findIndex(
      (track: Track) => track.track === targetTrack
    );

    if (trackIndex === -1) {
      throw new Error(`No track with name ${targetTrack}`);
    }

    const mappingIndex = charmcraftStatus[trackIndex].mappings.findIndex(
      (channel: Mapping) =>
        channel.base &&
        channel.base.name === targetBase.name &&
        channel.base.channel === targetBase.channel &&
        channel.base.architecture === targetBase.architecture
    );

    if (mappingIndex === -1) {
      throw new Error(
        `No channel with base name ${targetBase.name}, base channel ${targetBase.channel} and base architecture ${targetBase.architecture}`
      );
    }

    const releaseIndex = charmcraftStatus[trackIndex].mappings[
      mappingIndex
    ].releases.findIndex(
      (release: any) => release.channel === `${targetTrack}/${targetChannel}`
    );

    if (releaseIndex === -1) {
      throw new Error(
        `Cannot find release with channel name ${targetChannel}, with base`
      );
    }

    const releaseObj =
      charmcraftStatus[trackIndex].mappings[mappingIndex].releases[
        releaseIndex
      ];

    if (releaseObj.status !== 'open') {
      throw new Error(
        'Channel is not open. Make sure there was a release made to this channel previously.'
      );
    }

    const { revision, resources } = releaseObj;

    const resourceInfoArray = [] as Array<ResourceInfo>;

    for (let i = 0; i < resources.length; i += 1) {
      resourceInfoArray.push({
        resourceName: resources[i].name,
        resourceRev: resources[i].revision.toString(),
      });
    }

    return { charmRev: revision.toString(), resources: resourceInfoArray };
  }

  async release(
    charm: string,
    charmRevision: string,
    destinationChannel: string,
    resourceInfo: Array<ResourceInfo>
  ) {
    const resourceArgs: Array<string> = [];
    resourceInfo.forEach((resource) => {
      resourceArgs.push('--resource');
      resourceArgs.push(`${resource.resourceName}:${resource.resourceRev}`);
    });
    const args = [
      'release',
      charm,
      '--revision',
      charmRevision,
      '--channel',
      destinationChannel,
      ...resourceArgs,
    ];
    await exec('charmcraft', args, this.execOptions);
  }

  async listLib(charm: string): Promise<LibInfo[]> {
    const args = ['list-lib', charm, '--format=json'];
    const getLibs = await getExecOutput('charmcraft', args, this.execOptions);

    return JSON.parse(getLibs.stdout).map((l: any) => ({
      libName: l.library_name,
      version: l.api,
      revision: l.patch,
    }));
  }

  async publishLib(charm: string, majorVersion: string, libName: string) {
    const args = ['publish-lib', `charms.${charm}.${majorVersion}.${libName}`];
    debug(`about to publish lib with ${args}`);
    await exec('charmcraft', args, this.execOptions).catch((reason: any) => {
      const msg: string = `charmcraft ${args} ${this.execOptions} failed with ${reason}`;
      debug(msg);
      core.setFailed(msg);
      return false;
    });
    return true;
  }
}

export interface LibStatus {
  ok: boolean;
  out: string;
  err: string;
}

export interface VersionInfo {
  version: number;
  revision: number;
}

export interface LibInfo extends VersionInfo {
  libName: string;
}

export { Charmcraft };
