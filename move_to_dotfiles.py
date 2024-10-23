#!python3

import argparse
import os

parser = argparse.ArgumentParser(
    description="Move things to my dotfiles dirs, you need to set DOTFILE_DIR and DOTFILE_DIR_PUBLIC env vars",
    epilog="Example: move_to_dotfiles.py ~/.bashrc --public",
)
parser.add_argument("file", help="File to move")
parser.add_argument("--debug", action="store_true", help="Enable debug mode")
parser.add_argument("--public", action="store_true", help="Move to public dotfiles")
args = parser.parse_args()

if args.public:
    dest_dir = os.getenv("DOTFILE_DIR_PUBLIC")
    if dest_dir is None:
        print("DOTFILE_DIR_PUBLIC env var not set, bailing!")
        exit(1)
    dir_flag = "public"
else:
    dest_dir = os.getenv("DOTFILE_DIR")
    if dest_dir is None:
        print("DOTFILE_DIR env var not set, bailing!")
        exit(1)
    dir_flag = "private"

if not os.path.exists(dest_dir):
    print(f"Destination dir {dir_flag} {dest_dir} does not exist, bailing!")
    exit(1)

source_file = os.path.expanduser(args.file)

if os.path.islink(source_file):
    print(f"File {args.file} is already a symlink to {os.path.realpath(source_file)}, bailing!")
    exit(1)

# ok let's do the thing
filename = os.path.basename(args.file)
file_destination = os.path.join(dest_dir, filename)

if os.path.exists(file_destination):
    print(f"File {args.file} already exists in {dir_flag} dotfiles at {file_destination} bailing!")
    exit(1)

print(f"Moving {args.file} to {file_destination}")
try:
    os.rename(source_file, file_destination)
except Exception as error:
    print(f"Error moving file: {error}")
    exit(1)

print(f"Creating symlink from {source_file} to {file_destination}")
try:
    os.symlink(file_destination, source_file, target_is_directory=os.path.isdir(file_destination))
except Exception as error:
    print(f"Error creating symlink: {error}")
    print("Cleaning up by moving it back...")
    os.rename(file_destination, source_file)
    exit(1)

print("Done!")
