import { error, getInput, setFailed, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { GitHub } from '@actions/github/lib/utils';
import * as fs from 'fs';
import * as exec from '@actions/exec';

import { Charmcraft, LibInfo, Snap } from '../../services';
import { Outcomes, Tokens } from '../../types';

export class PublishLibrariesAction {
  private tokens: Tokens;
  private charmcraft: Charmcraft;
  private channel: string;
  private github: InstanceType<typeof GitHub>;
  private outcomes: Outcomes;
  private context: Context;
  private charmPath: string;
  private checkOnly: boolean;
  private charmName: string;
  private snap: Snap;

  constructor() {
    this.tokens = {
      github: getInput('github-token'),
      charmhub: getInput('credentials'),
    };
    if (!this.tokens.github) throw new Error(`Input 'github-token' is missing`);
    
    this.checkOnly = getInput('check-only'),
    this.charmPath = getInput('charm-path');
    this.channel = getInput('charmcraft-channel');

    this.outcomes = {
      fail: getInput('fail-build').toLowerCase() === 'true',
      comment: getInput('comment-on-pr').toLowerCase() === 'true',
    };

    this.context = context;
    this.github = getOctokit(this.tokens.github);
    this.charmcraft = new Charmcraft(this.tokens.charmhub);
    const { name: charmName } = this.charmcraft.metadata();
    this.charmName = charmName;
    this.snap = new Snap();
  }
  
  async getCharmLibs(): Promise<LibrariesStatus> {
    const err: string[] = [];
    const libsFound: LibInfo[] = [];
    let ok: boolean = true

    const versions: string[] = fs.readdirSync(`./lib/charms/${this.charmName}/`);
    versions.map((version: string) => {
      const versionInt = parseInt(version.slice(1)); // 'v1' --> 1
      const libs: string[] = fs.readdirSync(`./lib/charms/${this.charmName}/${version}/`);

      libs.map((libNamePy: string) => {
        const libName = libNamePy.slice(0, -3)
        const libFile = `./lib/charms/${this.charmName}/${version}/${libNamePy}`;
        
        fs.readFile(libFile, 'utf8', 
        (error: any, data: string) => {
          const v = data.match("LIBAPI[ ]?=[ ]?\d*")
          var LIBAPI: number | null = null;
          if (v) {
            LIBAPI = parseInt(v[1])
            if (LIBAPI != versionInt) {
              err.push(`lib ${libName} declares LIBAPI=${LIBAPI} but is 
              in ./lib/charms/${this.charmName}/${version}/. No good.`)
            }
            ok = false;
          } else {
            err.push(`could not find LIBAPI statement in ${libName}`)
          }
  
          const r = data.match("LIBPATCH[ ]?=[ ]?\d*")
          var LIBPATCH: number | null = null;
          if (r) {
            LIBPATCH = parseInt(r[1])
          } else {
            err.push(`could not find LIBPATCH statement in ${libName}`)
          }
          if (LIBPATCH && LIBAPI) {
            libsFound.push(
              {libName:libName, 
              version:LIBAPI, 
              revision:LIBPATCH})
          }
        })
      })
    })
    return {ok: ok, libs:libsFound, err:err};
  }

  async getLibStatus(old: LibInfo[]): Promise<LibrariesDiff> {
    var ok: boolean = true;
    var err: string[] = [];
    var changes: Change[] = [];

    // gather the libs that this charm has at the moment
    var current = await this.getCharmLibs(); 
    
    current.libs.map((currentLib:LibInfo) => {
      const oldLib: LibInfo | undefined = old.find(
        (value:LibInfo) => value.libName == currentLib.libName
        )
      var oldVersion: null | Version;

      if (oldLib == undefined) {
        changes.push({
          libName: currentLib.libName,
          old: null,
          new: {minor: currentLib.revision,
                major: currentLib.version}})
      } else if (
        (oldLib.revision > currentLib.revision) || 
        (oldLib.version > currentLib.version)
        ) {
        ok = false;
        err.push(`the local ${currentLib.libName} is at 
                  ${currentLib.version}.${currentLib.revision}, but 
                  ${oldLib.version}.${oldLib.revision} is present on 
                  charmhub.`);

      } else if (
        (oldLib.revision !== currentLib.revision) && 
        (oldLib.version !== currentLib.version)
        ) {
        changes.push({
          libName: currentLib.libName,
          old: {
            major: oldLib.version,
            minor: oldLib.revision},
          new: {minor: currentLib.revision,
                major: currentLib.version}});
        }
      }
    );
    return {ok, err, changes};    
  }

  async run() {
    try {
      process.chdir(this.charmPath!);
      if (!fs.existsSync('./lib')) {
        warning('No lib folder detected. Skipping action.');
        return;
      }
      if (!fs.existsSync('./lib/'+ this.charmName)) {
        warning('This charm has no libs. Skipping action.');
        return;
      }
      await this.snap.install('charmcraft', this.channel);

      // these are the most up-to-date libs as charmhub knows them
      const currentLibs = await this.charmcraft.listLib(this.charmName)
      const status = await this.getLibStatus(currentLibs);
      // we do this using includes to catch both `pull_request` and `pull_request_target`
      if (this.context.eventName.includes('pull_request')) {
        // on PR we do a check only and print a message
        this.github.rest.issues.createComment({
          issue_number: this.context.issue.number,
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          body: this.getCommentBody(status),
        });

        if (!status.ok && this.outcomes.fail) {
          setFailed('Something went wrong. Merging this PR will not update all libs.');
        } 
      } else if (this.context.eventName == 'push') {
        // We have merged: now we're not only checking, we're doing **business**.

        this.charmcraft.publishLib(this.charmName, )
      }

    } catch (e: any) {
      setFailed(e.message);
      error(e.stack);
    }
  }

  private getCommentBody = (diff: LibrariesDiff): string => {
    let msg: string = `Merging this PR will publish or bump the following libraries:`;
    diff.changes.map((change: Change) => {
      const fmtV = (v:Version|null): string => {
        if (v == null) {
          return `(new)`  // no previous version: lib is new.
        }
        return `${v.major}.${v.minor}`
      }
      msg = msg.concat(`\n ${change.libName} \t 
      (${fmtV(change.old)} + '-->' +${fmtV(change.new)} )`)
    });
    if (!diff.ok) {
      msg = msg.concat(`\n\nERRORS PRESENT: ${diff.err}\n on merge, nothing will be updated.`)
    }
    return msg;
  }
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
  ok: boolean;
  err: string[];
  changes: Change[]
}

export interface LibrariesStatus {
  ok: boolean;
  libs: LibInfo[]
  err: string[];
}