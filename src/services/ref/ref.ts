import { Context } from '@actions/github/lib/context';
import { PullRequestMetadata } from '../../types';

export class Ref {
  ctx: Context;
  event: string;

  constructor(context: Context) {
    this.ctx = context;
    this.event = this.ctx.eventName;
  }

  channel() {
    if (this.event === 'push') {
      return this._getChannelForPush();
    }
    if (this.event === 'pull_request') {
      return this._getChannelForPr();
    }

    throw new Error(`Invalid event type: ${this.event}`);
  }

  _getChannelForPush() {
    if (!this.ctx.ref.startsWith('refs/heads/')) {
      throw new Error(`Invalid git reference: ${this.ctx.ref}`);
    }

    const branch = this.ctx.ref.replace('refs/heads/', '');

    if (
      this.ctx.payload.repository &&
      this.ctx.payload.repository['master_branch'] === branch
    ) {
      return 'latest/edge';
    }
    if (branch.startsWith('track/')) {
      return `${branch.replace('track/', '')}/edge`;
    }

    throw new Error(`Unsupported branch name ${this.ctx.ref}`);
  }

  _getChannelForPr() {
    const metadata = this.ctx.payload.pull_request as PullRequestMetadata;

    if (!metadata) {
      throw new Error('Pull request metadata missing in the actions context');
    }

    const { base, head } = metadata;
    const branch = head.ref.replace('branch/', '');

    if (base.ref === base.repo.default_branch) {
      return `latest/edge/${branch}`;
    }
    if (base.ref.startsWith('track/')) {
      return `${base.ref.replace('track/', '')}/edge/${branch}`;
    }

    throw new Error(`Unhandled PR base name ${base.ref}`);
  }
}
