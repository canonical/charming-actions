# Charming Actions Collection

The Charming Actions Collection is a set of actions useful for Juju charm developers who
want to introduce automation into their release workflow. The collection currently consists
of the following actions:

- [canonical/charming-actions/check-libraries](check-libraries/README.md)
- [canonical/charming-actions/channel](channel/README.md)
- [canonical/charming-actions/upload-charm](upload-charm/README.md)
- [canonical/charming-actions/upload-bundle](upload-bundle/README.md)

## Usage

> #### ⚠️ Prerequisites
> 
> To use this action, start by adding a repository secret to your Github repository. In 
> the example below, it's called `CHARMCRAFT_TOKEN`, but can be anything you want. 
> See https://juju.is/docs/sdk/remote-env-auth for more information 
> on how to generate the appropriate credentials. `GITHUB_TOKEN` does not need to be explicitly
> added to the repository secrets as GitHub Actions will generate a context-bound token for
> each workflow execution.

The below snippet illustrates how to use all of the actions of the collection in the same
workflow:

```yaml

name: Pull Request

on: 
  pull_request:
    branches:
      - main

jobs:
  build:
    name: Release to edge
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
        with:
          fetch-depth: 0  
      - name: Check libraries
        uses: canonical/charming-actions/check-libraries@1.0.0
        with:
          credentials: "${{ secrets.CHARMHUB_TOKEN }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
      - name: Select charmhub channel
        uses: canonical/charming-actions/channel@1.0.0
        id: channel
      - name: Upload charm to charmhub
        uses: canonical/charming-actions/upload-charm@1.0.0
        with:
          credentials: "${{ secrets.CHARMHUB_TOKEN }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
          upload-image: "true"
          channel: "${{ steps.channel.outputs.name }}"
```

## Development

To be able to contribute to this repository, you first need to make sure you have 
`npm` and `nodejs` installed in your local development environment. This installation varies 
depending on the OS and distribution you are using. For more detailed instructions, see [the official NodeJS page](https://nodejs.org/).

Once that is done, start by cloning the repository:

```sh
$ git clone git@github.com:canonical/charming-actions.git
$ cd charming-actions
```

Then install the required packages:

```
$ npm install
```

Finally, build the actions by running:
```
$ npm run build
```
