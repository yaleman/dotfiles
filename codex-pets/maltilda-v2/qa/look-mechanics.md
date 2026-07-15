# Maltilda look mechanics

Maltilda stays seated with her paws, rump, and lower torso anchored. Her dark eyes lead the gaze, followed by a small, natural head and neck turn; her silky ears and facial coat follow subtly without changing length, volume, or identity. Her body remains nearly fixed, with only restrained upper-chest follow-through. There are no props.

The motion budget is even across every 22.5-degree step: small eye movement, then a modest head yaw or pitch, with stable scale and baseline. No whole-sprite rotation, raster warping, lateral sliding, or silhouette popping.

- 000 up: chin lifts slightly, pupils and nose aim upward; lower body stays front-facing.
- 090 screen-right: head turns toward the image's right edge; the right-facing muzzle projection is clear, the far eye and far ear are slightly occluded, and more of the left side of the head is visible.
- 180 down: chin lowers, eyes and nose aim down; forehead and crown become a little more visible while the seated base stays fixed.
- 270 screen-left: head turns toward the image's left edge; the left-facing muzzle projection is clear, the far eye and far ear are slightly occluded, and more of the right side of the head is visible.

Diagonals interpolate those four families continuously. The nose tip, pupils, eyelids, head angle, ear overlap, and facial-coat overlap must advance gradually with no flip, snap, or neutral/front-facing look cell.
