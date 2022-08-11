import { error, getInput, setFailed, warning } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { GitHub } from '@actions/github/lib/utils';
import * as fs from 'fs';
import * as exec from '@actions/exec';

import { Charmcraft, LibStatus, Snap } from '../../services';
import { Outcomes, Tokens } from '../../types';

export class CheckLibrariesAction {
  private tokens: Tokens;
  private charmcraft: Charmcraft;
  private channel: string;
  private github: InstanceType<typeof GitHub>;
  private outcomes: Outcomes;
  private context: Context;
  private charmPath: string;
  private snap: Snap;

  constructor() {
    this.tokens = {
      github: getInput('github-token'),
      charmhub: getInput('credentials'),
    };
    if (!this.tokens.github) throw new Error(`Input 'github-token' is missing`);

    this.charmPath = getInput('charm-path');
    this.channel = getInput('charmcraft-channel');

    this.outcomes = {
      fail: getInput('fail-build').toLowerCase() === 'true',
      comment: getInput('comment-on-pr').toLowerCase() === 'true',
    };

    this.context = context;
    this.github = getOctokit(this.tokens.github);
    this.charmcraft = new Charmcraft(this.tokens.charmhub);
    this.snap = new Snap();
  }

  async run() {
    try {
      process.chdir(this.charmPath!);
      if (!fs.existsSync('./lib')) {
        warning('No lib folder detected. Skipping action.');
        return;
      }
      await this.snap.install('charmcraft', this.channel);
      const status = await this.charmcraft.hasDriftingLibs();
      // we do this using includes to catch both `pull_request` and `pull_request_target`
      if (!status.ok && this.shouldPostComment) {
        this.github.rest.issues.createComment({
          issue_number: this.context.issue.number,
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          body: this.getCommentBody(status, this.charmPath),
        });
      }
      await exec.exec('git', ['checkout', 'HEAD', '--', 'lib']);

      if (!status.ok && this.outcomes.fail) {
        setFailed('Charmcraft libraries are not up to date.');
      }
    } catch (e: any) {
      setFailed(e.message);
      error(e.stack);
    }
  }

  private get shouldPostComment() {
    return (
      this.outcomes.comment && this.context.eventName.includes('pull_request')
    );
  }

  private getCommentBody = (status: LibStatus, charmPath: string): string =>
    `
Libraries at path '${charmPath}' are not up to date with their remote 
counterparts. If this was not intentional, run \`charmcraft fetch-lib\` 
and commit the updated libs to your PR branch.

<details>
  <summary>stdout</summary>\n
  \`\`\`
  ${status.out}
  \`\`\`\n
</details>\n

<details>
  <summary>stderr</summary>\n
  \`\`\`
  ${status.err}
  \`\`\`\n
</details>`;
}
