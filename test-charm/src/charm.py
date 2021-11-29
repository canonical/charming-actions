#!/usr/bin/env python3
# Copyright 2021 Canonical Ltd.
# See LICENSE file for licensing details.

from ops.charm import CharmBase
from ops.main import main
from ops.model import ActiveStatus


class Operator(CharmBase):
    def __init__(self, *args):
        super().__init__(*args)

        self.framework.observe(self.on.install, self.install)

    def install(self, event):
        self.model.unit.status = ActiveStatus()


if __name__ == "__main__":
    main(Operator)
