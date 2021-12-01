# charmhub-upload

This action allows you to easily upload a charmed operator to [charmhub.io][charmhub].

[charmhub]: https://charmhub.io/


## Usage

To use this action, start by adding a repository secret to your Github repository. In the example
below, it's called `CHARMCRAFT_AUTH`, but can be anything you want. Then, add a step like this to
your Github Workflow:

```yaml
- uses: canonical/charmhub-upload-action@0.1.0
  with:
    credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
```

[See here][auth] for how to generate the appropriate credentials.

[auth]: https://juju.is/docs/sdk/remote-env-auth

The list of available inputs for this action are:

 - `charm-path`
   - Path to the charm to be uploaded. Optional, defaults to `'.'`.
 - `charmcraft-channel`
   - Which channel to use when installing `charmcraft`. Optional, defaults to `latest/edge` at the
     moment as that's what supports the `CHARMCRAFT_AUTH` environment variable. Will be updated to
     have a default of `latest/stable` when that channel supports the `CHARMCRAFT_AUTH` environment
     variable.
 - `credentials`
   - Required, must be set to the credentials generated from `charmcraft login --export`.

## Developing

Start by cloning the repository:

```sh
git clone git@github.com:canonical/charmhub-upload-action.git
cd charmhub-upload-action
```

Then, run this command to ensure you don't forget to build `dist/index.js`:

    ln -s ../../hooks/pre-commit .git/hooks/pre-commit

Finally, install node.js and install dependencies:

    sudo snap install node --classic --channel 12/stable
    npm install
    npm run-script build
