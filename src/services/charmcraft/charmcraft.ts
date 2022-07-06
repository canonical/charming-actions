import * as core from '@actions/core';
import { exec, ExecOptions, getExecOutput } from '@actions/exec';
import * as glob from '@actions/glob';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import { Base, Metadata, ResourceInfo } from '../../types';

/* eslint-disable camelcase */

function checkIfIsBase(baseRelease: any, base: any): boolean {
  const { name, channel: baseChannel, architecture } = base;

  if (baseRelease.base === null) {
    // This release has no base.  Nothing is here
    return false;
  }

  return (
    baseRelease.base.name === name &&
    baseRelease.base.channel === baseChannel &&
    baseRelease.base.architecture === architecture
  );
}

function getSaferChannel(channel: string) {
  // Returns name of the next less risky channel, or an empty string if none exist

  // standard channel names, from least to most risk
  const orderedChannels = ['stable', 'candidate', 'beta', 'edge'];

  const iLessRisky = orderedChannels.findIndex((c) => c === channel) - 1;

  if (iLessRisky >= 0) {
    return orderedChannels[iLessRisky];
  }
  return '';
}

function getTrackByName(trackArray: any, track: string) {
  const i = trackArray.findIndex(
    (trackStatus: any) => trackStatus.track === track
  );
  if (i === -1) {
    throw new Error(`No track with name ${track}`);
  }
  const trackObj = trackArray[i];

  return { i, track: trackObj };
}

function getReleasesFromReleaseBaseArrayByBase(
  baseReleaseArray: any,
  base: Base
) {
  // Accepts an array of {base: base_spec, releases: [releaseOnChannelA, releaseOnChannelB, ...]} objects,
  // returning the releasOnChannelX releases array corresponding to the specified base
  //
  // base should be of format {name: 'ubuntu', channel: '20.04', architecture: 'amd64'}
  const i = baseReleaseArray.findIndex((baseRelease: any) =>
    checkIfIsBase(baseRelease, base)
  );
  const releasesArray = baseReleaseArray[i].releases;

  return { i, releases: releasesArray };
}

function getReleaseFromReleaseArrayByChannel(releases: any, channel: string) {
  const i = releases.findIndex((release: any) => release.channel === channel);
  const releaseObj = releases[i];

  return { i, release: releaseObj };
}

function getReleaseFromReleaseArrayByChannelHandlingNull(
  releases: any,
  channel: string
): any {
  // Returns the release in an array of releases for a given channel, handling any null releases
  //
  // Some charmhub releases "point" to another release, for example:
  //    `charmcraft status metacontroller-operator`:
  //        Track    Base                  Channel                    Version    Revision    Expires at
  //        latest   ubuntu 20.04 (amd64)  stable                      2          2
  //                                       candidate                   5          5
  //                                       beta                        ↑          ↑
  //                                       edge                       13         13
  //                                       edge/add-charming-actions   9          9           2022-06-30T01:00:00Z
  //                                       edge/resources-removal     12         12           2022-07-09T01:00:00Z
  //        0.3      -                     stable                      -          -
  //                                       candidate                   -          -
  //                                       beta                        -          -
  //                                       edge                        -          -
  // where we see latest/ubuntu-amd64/beta points to candidate, eg they have the same release.
  // `charmcraft status charmName --format json` returns these pointer releases with
  // `release.status == tracking` and `release.revision == null`.
  // This function handles this case, recursively looking for a "safer" release (eg: if beta is null,
  // check candidate).
  //
  // This function also handles the case where a track has no release (eg: for track 0.3 above), throwing
  // an error for this case.  This situation is identified by `release.status == closed`.

  const { i, release } = getReleaseFromReleaseArrayByChannel(releases, channel);

  if (release.status === 'open') {
    // Release exists.  Return it
    return { i, release };
  }
  if (release.status === 'tracking') {
    // Pointer to a safer channel.  Return that instead
    const saferChannel = getSaferChannel(channel);
    if (saferChannel === '') {
      // no safer channel exists.  Should we throw?
      throw new Error(
        `release.status == tracking for channel ${channel}, but no safer channel exists`
      );
    }
    return getReleaseFromReleaseArrayByChannelHandlingNull(
      releases,
      saferChannel
    );
  }
  if (release.status === 'closed') {
    // No release exists.  Throw
    throw new Error(`No revision available in risk level ${channel}`);
  }
  throw new Error(
    `Found unknown release status ${release.status} in charmcraft status results`
  );
}

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
        `No resources where uploaded as part of this build.\n` +
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

  async pack() {
    const args = ['charmcraft', 'pack', '--destructive-mode', '--quiet'];
    await exec('sudo', args, this.execOptions);
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

  async status(charm: string): Promise<string> {
    const result = await getExecOutput(
      'charmcraft',
      ['status', charm],
      this.execOptions
    );
    return result.stdout;
  }

  async statusJson(charm: string) {
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
    track: string,
    channel: string,
    base: Base
  ): Promise<{ charmRev: string; resources: Array<ResourceInfo> }> {
    const acceptedChannels = ['stable', 'candidate', 'beta', 'edge'];
    if (!acceptedChannels.includes(channel)) {
      throw new Error(
        `Provided channel ${channel} is not supported. This actions currently only works with one of the following default channels: edge, beta, candidate, stable`
      );
    }

    // Get status of this charm as a structured object
    const charmcraftStatus = await this.statusJson(charm);

    const { track: trackObj } = getTrackByName(charmcraftStatus, track);

    // const trackObj = charmcraftStatus.filter((obj: any) => obj.track === track)

    // const channelWithSpecifiedBase = trackObj.filter((releaseChannel: any) => releaseChannel.base.name === base.name && releaseChannel.base.channel === base.channel && releaseChannel.base.architecture === base.architecture)

    // const targetRelease = channelWithSpecifiedBase.releases.filter((release: any) => release.channel === channel)

    const { releases: releasesArray } = getReleasesFromReleaseBaseArrayByBase(
      trackObj.channels,
      base
    );

    if (releasesArray === null) {
      throw new Error(
        `Cannot find release for charm ${charm}, track ${track}, channel ${channel}, with base ${JSON.stringify(
          base
        )}`
      );
    }

    // console.log(`releasesArray in main: ${JSON.stringify(releasesArray)}`);

    const { release: releaseObj } =
      getReleaseFromReleaseArrayByChannelHandlingNull(releasesArray, channel);

    const { revision } = releaseObj;
    const { resources } = releaseObj;

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
}

export interface LibStatus {
  ok: boolean;
  out: string;
  err: string;
}

export { Charmcraft };
