import { UploadBundleAction } from '../actions/upload-bundle/upload-bundle';

(async () => {
  await new UploadBundleAction().run();
})();
