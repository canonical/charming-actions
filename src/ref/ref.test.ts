import { Context } from '@actions/github/lib/context';
import { Ref } from './ref';

function createContext(
  eventName: string,
  ref: string,
  main: string,
  prRefs: { base?: string; head?: string } = {}
) {
  return {
    eventName,
    ref,
    payload: {
      repository: {
        master_branch: main,
      },
      pull_request: {
        base: {
          ref: prRefs.base,
          repo: {
            default_branch: main,
          },
        },
        head: {
          ref: prRefs.head,
        },
      },
    },
  } as unknown as Context;
}

describe('the ref helper', () => {
  describe('the channel function', () => {
    it('should throw when called with an invalid event type', () => {
      const context = createContext('invalid-type', 'na', 'main');
      const ref = new Ref(context);
      expect(() => ref.channel()).toThrow(
        new Error('Invalid event type: invalid-type')
      );
    });
    it('should return latest/edge when pushing to main', () => {
      const context = createContext('push', 'refs/heads/main', 'main');
      const ref = new Ref(context);
      expect(ref.channel()).toEqual('latest/edge');
    });
    it('should return some-track/edge when pushing to a track branch', () => {
      const context = createContext(
        'push',
        'refs/heads/track/some-track',
        'main'
      );
      const ref = new Ref(context);
      expect(ref.channel()).toEqual('some-track/edge');
    });
    it('should return latest/edge/whatever when creating a PR towards main', () => {
      const context = createContext('pull_request', '', 'main', {
        base: 'main',
        head: 'branch/PR-123',
      });
      const ref = new Ref(context);
      expect(ref.channel()).toEqual('latest/edge/PR-123');
    });
    it('should return some-track/edge/whatever when creating a PR towards main', () => {
      const context = createContext('pull_request', '', 'main', {
        base: 'track/some-track',
        head: 'branch/PR-123',
      });
      const ref = new Ref(context);
      expect(ref.channel()).toEqual('some-track/edge/PR-123');
    });
  });
});
