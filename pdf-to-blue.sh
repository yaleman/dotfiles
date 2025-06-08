#!/bin/bash

# Convert a PDF to a series of JPG images, change everything not-white to dark blue, then reassemble it
rm "*.jpg"

magick -density 200 input.pdf -quality 90 output-%03d.jpg

for f in output*.jpg; do
  magick "$f" \
    -fuzz 10% \
    -fill darkblue +opaque white \
    "darkblue-${f%.jpg}.jpg"
done

# shellcheck disable=SC2046
magick $(ls "darkblue-*.jpg" | sort -V) output.pdf