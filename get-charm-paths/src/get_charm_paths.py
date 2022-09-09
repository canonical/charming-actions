#!/bin/env python
import argparse
from pathlib import Path


OUTPUT_VARIABLE_NAME = "charm_paths"


def find_charms_in_dir(base_dir: str, charms_subdir="charms"):
	"""Returns a list of paths to charm directories in base_dir.

	Searches for:
	* any subdirectories in base_dir/charms_subdir/ are charm directories
	* if no charm dirs are found, checks if base_dir is itself a charm directory
	* if still nothing is found, returns []

	Directories are identified as charm directories by the presence of a "metadata.yaml" file.
	Returned paths include base_dir and charms_subdir in their path, as applicable.
	"""
	base_dir = Path(base_dir)
	charms_dir = base_dir / charms_subdir
	metadata_files = list(charms_dir.glob("*/metadata.yaml"))
	if not metadata_files:
		# No nested charm directories found, check if the top level dir is a charm
		metadata_files = list(base_dir.glob("metadata.yaml"))

	# Return the parent directory of the relevant metadata_files
	charm_dirs = [metadata_file.parent for metadata_file in metadata_files]

	return charm_dirs


def stringify_paths(paths):
	"""Converts list of Paths to list of strings, appending a trailing slash just in case"""
	return [str(path) + "/" for path in paths]


def emit_to_github_action(name, data):
	"""Emits data to STDOUT as an output named name in a format that GitHub Actions consumes"""
	data = str(data)
	print(f"Found {name}: {data}")
	print(f"::set-output name={name}::{data}")


if __name__ == "__main__":
	parser = argparse.ArgumentParser(
		description="Find charm directories.  Searches for either nested charms or whether the "
					"directory is itself a charm, printing a Github Action compatible output of a "
					"JSON list of the found charm directories"
	)

	parser.add_argument("base_dir", help="Directory to search for charms")
	args = parser.parse_args()
	charm_dirs = find_charms_in_dir(args.base_dir)
	charm_dirs = stringify_paths(charm_dirs)
	emit_to_github_action(name=OUTPUT_VARIABLE_NAME, data=charm_dirs)
