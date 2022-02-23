import { setOutput } from '@actions/core';
import { context } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { Ref } from '../../services';

export class ChannelSelection {
  private context: Context;
  private ref: Ref;

  constructor() {
    this.context = context;
    this.ref = new Ref(this.context);
  }

  run() {
    const channel = this.ref.channel();
    setOutput('name', channel);
  }
}
