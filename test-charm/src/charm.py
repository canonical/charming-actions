#!/usr/bin/env python3
# Copyright 2022 Ubuntu
# See LICENSE file for licensing details.


import logging
from ops.charm import CharmBase
from ops.framework import StoredState
from ops.main import main
from ops.model import ActiveStatus

logger = logging.getLogger(__name__)


class EdgeReleaseTestCharmCharm(CharmBase):
    """Charm the service."""

    def __init__(self, *args):
        super().__init__(*args)
        self.framework.observe(self.on.install, self.install)

    def install(self, event):
        self.model.unit.status = ActiveStatus()


if __name__ == "__main__":
    main(EdgeReleaseTestCharmCharm)
