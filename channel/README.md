# canonical/charming-actions/channel

This action allows you to, based on the github reference, decide which channel on Charmhub to release
a change to. In itself, this action does not mutate any state on either GitHub or CharmHub.

## Usage

```yaml
      - name: Select charmhub channel
        uses: canonical/charming-actions/channel@1.0.0
        id: channel
```

Do note the `id` of the channel step. This is vital to be able to use the output of the action
in a later step, using `${{ steps.<THE-ID-YOU-ENTERED>.outputs.name }}`

## API

### Inputs

None

### Outputs

| Key    | Description                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------- |
| `name` | The name of the channel the charm should be published on, using the branch selection matrix below. |


## Branch Selection

This action automatically selects a Charmhub channel based on the GitHub PR number. For `push`
events, a Charmhub channel is selected. For `pull_request` events, a `pr-<pr number>` is added to the 
channel, so that the PR can be tested. 

The Charmhub channel/branch selection logic looks like this:

| Event Type   | Head            | Base/Branch          | Channel                           |
|:------------:|:---------------:|:--------------------:|:---------------------------------:|
| push         |                 | `<default branch>`   | `latest/edge`                     |
| push         |                 | `track/<track-name>` | `<track-name>/edge`               |
| push         |                 | Any other name       | Ignored                           |
| pull_request | `<branch-name>` | `track/<track-name>` | `<track-name>/edge/pr-<pr number>`|
| pull_request | Any other name  | Any other name       | `latest/edge/pr-<pr number>`      |

If the action is unable to select a channel, the action will fail. If you for any reason want to ignore the failure
and continue running the CI, you should set the `continue-on-error` parameter to `true` for this CI step. This is
mainly useful if you have fallback logic in place that you'd like to use instead of failing.


