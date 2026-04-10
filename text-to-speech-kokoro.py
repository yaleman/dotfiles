#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
# "kokoro",
# "soundfile",
# "numpy",
# "click"
# ]
# ///

import click
from kokoro import KPipeline
import soundfile as sf
import numpy as np


@click.command()
@click.argument("input_filename")
def readit(input_filename: str) -> None:
    pipeline = KPipeline(lang_code="a")
    text = open(input_filename, encoding="utf-8").read()

    audio = np.concatenate([a for _, _, a in pipeline(text, voice="af_heart")])
    sf.write("output.wav", audio, 24000)
    print("Done! wrote to output.wav")


if __name__ == "__main__":
    readit()
