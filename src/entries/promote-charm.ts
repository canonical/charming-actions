import { PromoteCharmAction } from '../actions/promote-charm/promote-charm';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new PromoteCharmAction().run();
})();
