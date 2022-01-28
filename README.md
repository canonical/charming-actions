# charmhub-upload

This action allows you to easily upload a charmed operator or bundle of charmed operators to
[charmhub.io][charmhub].

[charmhub]: https://charmhub.io/


## Usage

### Workflow

To use this action, start by adding a repository secret to your Github repository. In the example
below, it's called `CHARMCRAFT_AUTH`, but can be anything you want. Then, add a step like this to
your Github Workflow:

```yaml
- uses: canonical/charmhub-upload-action@0.2.0
  with:
    credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
```

[See here][auth] for how to generate the appropriate credentials.

[auth]: https://juju.is/docs/sdk/remote-env-auth

If you're uploading a single charm that exists in the current directory, that's all you need.

If you don't want to upload the OCI image, add `upload-image` config and set it to `"false"`. This would be useful for charms whose image does not change often. Default behavior is set to `"true"`:
```yaml
- uses: canonical/charmhub-upload-action@0.2.0
  with:
    credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
    upload-image: "false"
```

If you've got a charm at a different path, you can upload the charm like this:


```yaml
- uses: canonical/charmhub-upload-action@0.2.0
  with:
    credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
    charm-path: my-charm/
```

If you'd like to upload a bundle instead of a charm, you can do so like this:


```yaml
- uses: canonical/charmhub-upload-action@0.2.0
  with:
    credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
    bundle-path: my-bundle/
```

### Branch Selection

This action automatically selects a Charmhub channel based on the Github branch naming. For `push`
events, a Charmhub channel is selected. For `pull_request` events, a Charmhub branch is selected, so
that the PR can be tested.

The Charmhub channel/branch selection logic looks like this:

| Event Type   | Head                   | Base/Branch          | Channel                           |
|:------------:|:----------------------:|:--------------------:|:---------------------------------:|
| push         |                        | `<default branch>`   | `latest/edge`                     |
| push         |                        | `track/<track-name>` | `<track-name>/edge`               |
| push         |                        | Any other name       | Ignored                           |
| pull_request | `branch/<branch-name>` | `<default branch>`   | `latest/edge/<branch-name>`       |
| pull_request | `branch/<branch-name>` | `track/<track-name>` | `<track-name>/edge/<branch-name>` |
| pull_request | Any other name         | Any other name       | Ignored                           |

### Available Inputs

The list of available inputs for this action are:

 - `bundle-path`
   - Path to the bundle to be uploaded. Optional; If set, `charm-path` will be ignored.
 - `charm-path`
   - Path to the charm to be uploaded. Optional, defaults to `'.'`.
 - `charmcraft-channel`
   - Which channel to use when installing `charmcraft`. Optional, defaults to `latest/edge` at the
     moment as that's what supports the `CHARMCRAFT_AUTH` environment variable. Will be updated to
     have a default of `latest/stable` when that channel supports the `CHARMCRAFT_AUTH` environment
     variable.
 - `credentials`
   - Required, must be set to the credentials generated from `charmcraft login --export`.
 - `upload-image`
   - Set to false if you don't want to upload the OCI image. (Default true)
## Developing

Start by cloning the repository:

```sh
git clone git@github.com:canonical/charmhub-upload-action.git
cd charmhub-upload-action
```

Then, run this command to ensure you don't forget to build `dist/index.js`:

    ln -s ../../hooks/pre-commit .git/hooks/pre-commit

Finally, install node.js and install dependencies:

    # Use apt instead of snap due to:
    # https://bugs.launchpad.net/ubuntu/+source/snapd/+bug/1849753
    sudo apt install npm
    npm install
    npm run-script build
    
