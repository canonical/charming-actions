#!/bin/bash
set -euo pipefail
# Environment
## Part Environment
export CHARMCRAFT_ARCH_TRIPLET="aarch64-linux-gnu"
export CHARMCRAFT_TARGET_ARCH="arm64"
export CHARMCRAFT_PARALLEL_BUILD_COUNT="1"
export CHARMCRAFT_PART_NAME="bundle"
export CHARMCRAFT_PART_SRC="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/src"
export CHARMCRAFT_PART_BUILD="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/build"
export CHARMCRAFT_PART_BUILD_WORK="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/build"
export CHARMCRAFT_PART_INSTALL="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/install"
export CHARMCRAFT_OVERLAY="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/overlay/overlay"
export CHARMCRAFT_STAGE="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/stage"
export CHARMCRAFT_PRIME="/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/prime"
## Plugin Environment
## User Environment

set -x
mkdir -p "/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/install"
cp --archive --link --no-dereference * "/home/ubuntu/Canonical/charmhub-upload-action/test-bundle/build/parts/bundle/install"
