class Ref {
  constructor(context) {
    this.ctx = context;
    this.event = this.ctx.eventName;
  }

  channel() {
    if (this.event === "push") {
      return this._getChannelForPush();
    }
    if (this.event === "pull_request") {
      return this._getChannelForPr();
    }

    throw Error(`Invalid event type: ${this.event}`);
  }

  _getChannelForPush() {
    if (!this.ctx.ref.startsWith("refs/heads/")) {
      throw Error(`Invalid git reference: ${this.context.ref}`);
    }

    const branch = this.ctx.ref.replace("refs/heads/", "");

    if (branch === this.ctx.payload.repository.master_branch) {
      return "latest/edge";
    }
    if (branch.startsWith("track/")) {
      return `${branch.replace("track/", "")}/edge`;
    }

    throw Error(`Unsupported branch name ${this.ctx.ref}`);
  }

  _getChannelForPr() {
    const { base, head } = this.ctx.payload.pull_request;

    if (!head.ref.startsWith("branch/")) {
      throw Error(`Unsupported branch name: ${head.ref}`);
    }

    const branch = head.ref.replace("branch/", "");

    if (base.ref === base.repo.default_branch) {
      return `latest/edge/${branch}`;
    }
    if (base.ref.startsWith("track/")) {
      return `${base.ref.replace("track/", "")}/edge/${branch}`;
    }

    throw Error(`Unhandled PR base name ${base.ref}`);
  }
}

module.exports = Ref;
