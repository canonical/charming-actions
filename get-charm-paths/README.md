# Summary

This action searches this repo looking for Juju Charms, emitting a JSON list of the relative paths to any charms found.  This is useful to build a Github Workflow matrix for all charms in this repository, as well as to build Github Workflows that can run in both single- and multi-charm repositories.

This action is suitable for two styles of repository:
* single-charm repositories: repositories containing a single charm that is kept in the root directory (eg: the `metadata.yaml` file for the charm is in the root directory)
* multi-charm repositories: repositories containing one or more charms nested in a `./charms/` folder, such as [Kubeflow Pipelines](https://github.com/canonical/kfp-operators), where each charm's folder is a subfolder of `./charms/`.

The search logic is applied to find charms is:
* look in `./charms/` for any charm any subdirectories in base_dir/charms_subdir/ are charm directories.  If any are found, return only those that are nested in the `./charms/` folder (ex: `["./charms/charm1", "./charms/charm2"]`)
* if no charms are found in `./charms/`, check if the root directory of the repository is itself a charm.  If yes, return `["./"]`
* if still nothing is found, return `[]`

Directories are identified as charm directories by the presence of a "metadata.yaml" file.


# Example usage

Example workflow:

```yaml
name: Demo get-charm-paths

on:
  workflow_dispatch:

jobs:
  get-charm-paths:
    name: Generate the Charm Matrix content
    runs-on: ubuntu-latest
    outputs:
      charm_paths: ${{ steps.get-charm-paths.outputs.charm-paths }}
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - name: Get paths for all charms in this repo
        id: get-charm-paths
        uses: charming-actions/get-charm-paths@master  # Or, even better, pin to a release

  echo-charm-paths:
    name: Echo charm paths emitted
    runs-on: ubuntu-latest
    needs: get-charm-paths
    steps:
      - run: |
          echo "Got charm_paths: ${{ needs.get-charm-paths.outputs.charm_paths }}"

  use-charm-paths:
    name: Use charm paths in a matrix
    runs-on: ubuntu-latest
    needs: get-charm-paths
    strategy:
      fail-fast: false
      matrix:
        charm-path: ${{ fromJson(needs.get-charm-paths.outputs.charm_paths) }}
    steps:
      - run: |
          echo "Got charm path: ${{ matrix.charm-path }}"
```

# Todo

* [] Expose input to flexibly define the name of the charms directory