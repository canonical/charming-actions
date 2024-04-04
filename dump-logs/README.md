## Summary

This action collects logs from juju models and k8s objects.

This action is relevant for workflows that run charm integration tests.

### Inputs
None

### Outputs
None

## Example usage

Example workflow:

```yaml
jobs:
  integration-test:
    steps:
      - name: Set up and run some tests
      - name: Dump logs
        if: failure()
        uses: canonical/charming-actions/dump-logs
```

## Known issues
- If pytest operator is not told to keep models (`--keep-models`) then some
  resources may be destroyed before the logs collection completes.
