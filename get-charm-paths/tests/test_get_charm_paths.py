import os.path
from pathlib import Path
from unittest import mock

import pytest

from src.get_charm_paths import find_charms_in_dir, main, stringify_paths

TEST_ROOT_DIR = os.path.dirname(os.path.realpath(__file__))


@pytest.mark.parametrize(
    "base_dir, expected",
    [
        (
            f"{TEST_ROOT_DIR}/single_charm_dir/",
            [Path(f"{TEST_ROOT_DIR}/single_charm_dir/")],
        ),
        (
            f"{TEST_ROOT_DIR}/multi_charm_with_charms/",
            [
                Path(f"{TEST_ROOT_DIR}/multi_charm_with_charms/charms/charm0/"),
                Path(f"{TEST_ROOT_DIR}/multi_charm_with_charms/charms/charm1/"),
            ],
        ),
        (f"{TEST_ROOT_DIR}/multi_charm_without_charms/charms/", []),
    ],
)
def test_find_charms_in_subdirs(base_dir, expected):
    charm_dirs = find_charms_in_dir(base_dir)
    # Compare, without guaranteeing order
    assert sorted(charm_dirs) == sorted(expected)


@pytest.mark.parametrize(
    "charm_dirs, expected",
    [
        ([], []),
        ([Path("a/b/c"), Path("d/e/f")], ["a/b/c/", "d/e/f/"]),
    ],
)
def test_stringify_paths(charm_dirs, expected):
    assert expected == stringify_paths(charm_dirs)


@pytest.mark.parametrize(
    "base_dir, n_expected_emissions",
    [
        (f"{TEST_ROOT_DIR}/single_charm_dir/", 1),
        (
            f"{TEST_ROOT_DIR}/multi_charm_with_charms/",
            2,
        ),
        (f"{TEST_ROOT_DIR}/multi_charm_without_charms/charms/", 0),
    ],
)
def test_main(base_dir, n_expected_emissions):
    emit_to_github_action_mocker = mock.patch(
        "src.get_charm_paths.emit_to_github_action"
    )
    with emit_to_github_action_mocker as mocked_emit:
        main(base_dir)
        _, kwargs = mocked_emit.call_args
        assert len(kwargs["data"]) == n_expected_emissions
