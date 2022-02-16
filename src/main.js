const core = require("@actions/core");
const github = require("@actions/github");
const process = require("process");

const Tagger = require("./tagging");
const Snap = require("./snap/snap");
const Charmcraft = require("./charmcraft");
const Bundle = require("./bundle");
const Ref = require("./ref/ref");
const Artifact = require("./artifact");

(async () => {
  try {
    const charmPath = core.getInput("charm-path");
    const bundlePath = core.getInput("bundle-path");
    const githubToken =
      core.getInput("github-token") || process.env.GITHUB_TOKEN;

    if (!githubToken) {
      throw Error(
        `Input 'github-token' is missing, and not provided in environment`
      );
    }

    const ref = Ref(github.context);
    const channel = ref.channel();
    const snap = new Snap();
    await snap.install("charmcraft", core.getInput("charmcraft-channel"));

    // Publish a bundle or a charm, depending on if `bundle_path` or `charm_path` was set
    if (bundlePath) {
      await snap.install("juju-bundle");
      await new Bundle().publish(bundlePath, channel);
      // TODO: Needs to tag bundles as well
      return;
    }

    process.chdir(charmPath);

    const charmcraft = new Charmcraft();
    await charmcraft.pack();

    const { flags, resourceInfo } = await charmcraft.uploadResources();
    const charmRevisions = await charmcraft.upload(channel, flags);

    // TODO: Needs to prefix the tag with the charm name
    const tagger = new Tagger(githubToken);
    await tagger.tag(charmRevisions, channel, resourceInfo);
  } catch (error) {
    core.setFailed(error.message);
    core.error(error.stack);
  }

  const result = await Artifact.uploadLogs();
  core.info(result);
})();
