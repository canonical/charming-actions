import { UploadBundleAction } from '../actions/upload-bundle/upload-bundle';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new UploadBundleAction().run();
})();
