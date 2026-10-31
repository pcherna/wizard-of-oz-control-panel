# The Wizard's Control Panel

Two animated, green steampunk control panels for the man behind the curtain. They are built to stand side by side, one on each laptop. Both share the same brass, pipes and gears, but each runs a different console with its own controls. The project is a static page with no build step and no network access at runtime. The fonts are bundled.

## Run

```sh
python3 -m http.server 8765
```

Open the URL that matches each laptop:

| URL | Screen | Console |
| --- | --- | --- |
| `http://localhost:8765/?size=16` | 16" MacBook Pro, portrait | Projection Console (default) |
| `http://localhost:8765/?size=14` | 14" MacBook Pro, portrait | Works Console |

You can also open `index.html` directly from disk.

## Setting up the laptops

The panels are tall and narrow, so each laptop stands on its side like a book. The display stays in normal landscape mode. The page rotates the panel 90° and stretches it to fill the screen.

1. Turn each laptop clockwise onto its side, so the hinge is on the left.
2. Open its URL and press `F` for fullscreen.
3. If the panel is upside down, press `R`. It cycles through the three rotations: hinge on the left, hinge on the right, then upright (no rotation). Each laptop remembers its choice.

No keyboard or mouse is needed after that. After 12 seconds without input, a phantom operator starts working a random control every 6–13 seconds. On the 16" it pulls levers. On the 14" it dispenses boons, flips switches and then flips them back, and now and then rings the alarm.

## The consoles

**Projection Console (16")** holds the Wizard's showmanship. It has a crystal ball, gauges, an oscilloscope, digit counters and a bank of six levers.

| Control | Key | Effect |
| --- | --- | --- |
| Thunder lever | `1` | Flash, shake, gauges spike |
| Lightning lever | `2` | Lightning storm in the crystal ball |
| Smoke lever | `3` | Steam bursts from every valve |
| Fire lever | `4` | Crystal ball flares, tubes surge |
| Voice lever | `5` | "OZ" appears in the ball, scope goes wild |
| Engines lever | `6` | Gears spin up |

**Works Console (14")** holds the machinery behind the curtain. It has a witch and monkey detector, two arc generators, a boon dispenser, a split-flap oracle board, toggle switches and an alarm.

| Control | Key | Effect |
| --- | --- | --- |
| Boon selector knob | `←` `→` | Selects Brains, Heart, Courage or Home. Click the left or right half of the knob to turn it. |
| Dispense plunger | `D`, `Space`, `Enter` | Dispenses one of the selected boon. Stock refills slowly. |
| Detector switch | `1` | Turns the detector on or off |
| Arcs switch | `2` | Turns the arc generators on or off |
| Clutch switch | `3` | Engages or stops the gears |
| Fog switch | `4` | Rolls fog along the bottom of the panel |
| Curtain switch | `5` | Draws velvet curtains across the detector |
| Alarm button | `A` | Witch sighted: red flashes, fast sweep, faster arcs |

The oracle board reports every action.

On both consoles, `F` or a double-click toggles fullscreen, and `R` cycles the rotation. The cursor hides after 2.5 seconds without movement.

## Options

| Param | Effect |
| --- | --- |
| `size=16` / `size=14` | Selects the screen size and its console. |
| `rotate=ccw` / `rotate=cw` / `rotate=none` | Sets the rotation and overrides the saved `R` choice. `ccw` (the default) suits the hinge on the left. `cw` suits the hinge on the right. `none` is for an upright portrait display. |
| `auto=0` | Turns off the phantom operator. By default it works a random control after 12 seconds without input. |

## Sizing

Each console is built at the portrait CSS-pixel size of its screen at the default "looks like" resolution. The 16" is 1117×1728 and the 14" is 982×1512. Both screens have the same pixel density, so shared parts such as plates, rivets and pipes appear at the same physical size side by side.

The page scales the whole panel to fit the window. When the window is proportionally taller than the design, for example in fullscreen on a notched MacBook, the panel grows taller and spreads the extra space between rows. That way it fills the screen with no black bars.

## Files

- `index.html`: page shell, shared SVG gradients, and one `<template>` per console
- `js/core.js`: profile selection, scaling, gears, pipes, steam and fog, ticker, input, frame loop
- `js/console-main.js`: Projection Console
- `js/console-works.js`: Works Console
- `css/style.css`: shared styles. `css/console-main.css` and `css/console-works.css` hold each console's styles and sizes.
- `fonts/`: Cinzel and Cinzel Decorative (SIL Open Font License)
