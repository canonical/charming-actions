from pathlib import Path

import pytest

from src.get_charm_paths import find_charms_in_dir


@pytest.mark.parametrize(
    "base_dir, expected",
    [
        ("./single_charm_dir/", [Path("./single_charm_dir/")]),
        ("./multi_charm_with_charms/charms/", [Path("./multi_charm_with_charms/charms/charm0/"), Path("./multi_charm_with_charms/charms/charm1/")]),
        ("./multi_charm_without_charms/charms/", []),
    ]
)
def test_find_charms_in_subdirs(base_dir, expected):
    charm_dirs = find_charms_in_dir(base_dir)
    assert charm_dirs == expected
