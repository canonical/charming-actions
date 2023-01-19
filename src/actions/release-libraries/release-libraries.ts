import { error, getInput, info, setFailed, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { GitHub } from '@actions/github/lib/utils';
import * as fs from 'fs';

import { Charmcraft, LibInfo, Snap, VersionInfo } from '../../services';
import { Outcomes, Tokens } from '../../types';

export class ReleaseLibrariesAction {
  private tokens: Tokens;
  private charmcraft: Charmcraft;
  private channel: string;
  private github: InstanceType<typeof GitHub>;
  private outcomes: Outcomes;
  private context: Context;
  private charmPath: string;
  private charmName: string;
  private charmNamePy: string;
  private snap: Snap;

  constructor() {
    this.tokens = {
      github: getInput('github-token'),
      charmhub: getInput('credentials'),
    };
    if (!this.tokens.github) {
      throw new Error(`Input 'github-token' is missing`);
    }
    this.charmPath = getInput('charm-path');
    this.channel = getInput('charmcraft-channel');

    this.outcomes = {
      fail: getInput('fail-build').toLowerCase() === 'true',
      comment: getInput('comment-on-pr').toLowerCase() === 'true',
    };

    this.context = context;
    this.github = getOctokit(this.tokens.github);
    this.charmcraft = new Charmcraft(this.tokens.charmhub);
    this.charmName = this.charmcraft.metadata().name;
    this.charmNamePy = this.charmName.split('-').join('_'); // replace all
    this.snap = new Snap();
  }

  parseCharmLibFile(
    data: string,
    versionInt: Number,
    version: string,
    libName: string
  ): VersionInfo | Error {
    const v = data.match('LIBAPI[ ]?=[ ]?d*');
    let LIBAPI: number | null = null;
    if (v) {
      LIBAPI = parseInt(v[1], 10);
      if (LIBAPI !== versionInt) {
        return new Error(`lib ${libName} declares LIBAPI=${LIBAPI} but is 
      in ./lib/charms/${this.charmNamePy}/${version}/. No good.`);
      }
    } else {
      return new Error(`could not find LIBAPI statement in ${libName}`);
    }

    const r = data.match('LIBPATCH[ ]?=[ ]?d*');
    let LIBPATCH: number | null = null;
    if (r) {
      LIBPATCH = parseInt(r[1], 10);
    } else {
      return new Error(`could not find LIBPATCH statement in ${libName}`);
    }
    if (LIBPATCH && LIBAPI) {
      return {
        version: LIBAPI,
        revision: LIBPATCH,
      };
    }
    return new Error(`could not extract LIBPATCH and LIBAPI from ${libName} .`);
  }

  getVersionInfo(
    libFile: string,
    versionInt: Number,
    version: string,
    libName: string
  ): VersionInfo | Error {
    const data = fs.readFileSync(libFile, 'utf-8');
    return this.parseCharmLibFile(data, versionInt, version, libName);
  }

  async getCharmLibs(): Promise<LibInfo[]> {
    const libsFound: LibInfo[] = [];

    const versions: string[] = fs.readdirSync(
      `./lib/charms/${this.charmNamePy}/`
    );
    versions.forEach((version: string) => {
      const versionInt = parseInt(version.slice(1), 10); // 'v1' --> 1
      const libs: string[] = fs.readdirSync(
        `./lib/charms/${this.charmNamePy}/${version}/`
      );

      libs.forEach((libNamePy: string) => {
        const libName = libNamePy.slice(-3);
        const libFile = `./lib/charms/${this.charmNamePy}/${version}/${libNamePy}`;
        info(`found lib file: ${libFile}. Parsing...`);

        try {
          const vinfo = this.getVersionInfo(
            libFile,
            versionInt,
            version,
            libName
          );
          if (vinfo instanceof Error) {
            error(
              `lib file could not be parsed: error ${vinfo.name} with msg = ${vinfo.message}`
            );
          } else {
            // VersionInfo
            libsFound.push({ libName, ...vinfo });
            info(`lib file could be parsed: VersionInfo=${vinfo}`);
          }
        } catch (e: any) {
          setFailed(e.message);
          error(e.stack);
        }
      });
    });
    return libsFound;
  }

  async getLibStatus(old: LibInfo[]): Promise<LibrariesDiff> {
    const errors: string[] = [];
    const changes: Change[] = [];

    // gather the libs that this charm has at the moment
    const current = await this.getCharmLibs();

    current.forEach((currentLib: LibInfo) => {
      info(`checking status for ${currentLib}`);

      const oldLib: LibInfo | undefined = old.find(
        (value: LibInfo) => value.libName === currentLib.libName
      );

      if (oldLib === undefined) {
        changes.push({
          libName: currentLib.libName,
          old: null,
          new: { minor: currentLib.revision, major: currentLib.version },
        });
      } else if (
        oldLib.revision > currentLib.revision ||
        oldLib.version > currentLib.version
      ) {
        errors.push(`the local ${currentLib.libName} is at 
                  ${currentLib.version}.${currentLib.revision}, but 
                  ${oldLib.version}.${oldLib.revision} is present on 
                  charmhub.`);
      } else if (
        oldLib.revision !== currentLib.revision &&
        oldLib.version !== currentLib.version
      ) {
        changes.push({
          libName: currentLib.libName,
          old: {
            major: oldLib.version,
            minor: oldLib.revision,
          },
          new: { minor: currentLib.revision, major: currentLib.version },
        });
      }
    });
    return { errors, changes };
  }

  async run() {
    try {
      process.chdir(this.charmPath!);
      if (!fs.existsSync('./lib')) {
        warning('No lib folder detected. Skipping action.');
        return;
      }
      if (!fs.existsSync(`./lib/charms/${this.charmNamePy}`)) {
        warning(
          `Charm ${this.charmName} has no libs (not found in ./lib/charms/${this.charmNamePy}, where expected). Skipping action.`
        );
        return;
      }

      info('installing charmcraft...');
      await this.snap.install('charmcraft', this.channel);

      // these are the most up-to-date libs as charmhub knows them
      const currentLibs = await this.charmcraft.listLib(this.charmName);
      const status = await this.getLibStatus(currentLibs);

      // Add a pr comment that says what's going to be updated.
      this.github.rest.issues.createComment({
        issue_number: this.context.issue.number,
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        body: this.aboutToUpdateCommentBody(status),
      });

      if (!!status.errors && this.outcomes.fail) {
        setFailed(
          'Something went wrong. Please check the logs. Aborting: no changes committed.'
        );
        return;
      }

      const statusMsg = !!status.errors
        ? 'OK'
        : 'NOT OK (errors found: see logs)';

      if (!status.changes.length) {
        info(`Status ${statusMsg}; nothing to update. Exiting...`);
        return;
      }

      info(`status ${statusMsg}; publishing changes: ${status.changes}...`);

      const failures: string[] = [];

      // publish libs in parallel
      await Promise.all(
        status.changes.map(async (change: Change) => {
          const versionID: string = `v${change.new.major}`;
          info(`publishing ${change.libName}`);
          this.charmcraft
            .publishLib(this.charmNamePy, versionID, change.libName)
            .catch((reason) => {
              const msg: string = `publishing ${change.libName} (${change.new.major}.${change.new.major}) failures with reason=${reason}`;
              error(msg);
              failures.push(msg);
            });
        })
      );

      if (!!failures.length) {
        setFailed(
          `Failed to publish some libs: ${failures}. See the logs for more info.`
        );
      } else {
        info('All good. Changes are live.');
      }
    } catch (e: any) {
      setFailed(e.message);
      error(e.stack);
    }
  }

  private aboutToUpdateCommentBody = (diff: LibrariesDiff): string => {
    let msg: string = `Preparing to publish or bump the following libraries:`;
    diff.changes.forEach((change: Change) => {
      const fmtV = (v: Version | null): string => {
        if (v == null) {
          return `(new)`; // no previous version: lib is new.
        }
        return `${v.major}.${v.minor}`;
      };
      msg = msg.concat(`\n ${change.libName} \t 
      (${fmtV(change.old)} + '-->' +${fmtV(change.new)} )`);
    });
    if (!!diff.errors) {
      msg = msg.concat(
        `\n\nERRORS PRESENT: ${diff.errors}\n: nothing will be updated.`
      );
    }
    return msg;
  };
}

export interface Version {
  major: number;
  minor: number;
}

export interface Change {
  libName: string;
  old: Version | null;
  new: Version;
}

export interface LibrariesDiff {
  errors: string[];
  changes: Change[];
}
