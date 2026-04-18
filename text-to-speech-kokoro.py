import os
import sys

if sys.platform == "darwin":
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

import click
from kokoro import KPipeline
import soundfile as sf
import numpy as np


@click.command()
@click.argument("input_filename")
@click.option("--output_filename", default="output.wav", help="The name of the output file")
def readit(input_filename: str, output_filename: str) -> None:
    if not os.path.exists(input_filename):
        print(f"Input file {input_filename} doesn't exist, quitting.")
        sys.exit(1)
    print("Building pipeline...")
    # 🇺🇸 'a' => American English,
    # 🇬🇧 'b' => British English
    lang_code = "b"
    pipeline = KPipeline(lang_code=lang_code, repo_id="hexgrad/Kokoro-82M")
    print(f"Reading text from {input_filename}...")
    text = open(input_filename, encoding="utf-8").read()
    print("Generating audio...")
    # voice files are loaded from here: https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices
    audio = np.concatenate([a for _, _, a in pipeline(text, voice=f"{lang_code}f_isabella")])
    print(f"Writing to {output_filename}...")
    sf.write(output_filename, audio, 24000)
    print(f"Done! wrote to {output_filename}")


if __name__ == "__main__":
    readit()
