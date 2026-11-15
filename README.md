# Developer Profile Page

A modern, code-themed profile page that displays personal information, skills, experience, and projects in a syntax-highlighted format.

## 🚀 Quick Start

### Option 1: Direct File Opening (Recommended)
Simply open `index.html` in your browser. The profile data is embedded directly in the JavaScript file, so no server is needed.

### Option 2: Local HTTP Server
If you prefer to use the separate JSON file approach:

1. **Start the server:**
   ```bash
   python3 server.py
   ```

2. **Open your browser:**
   - The server will automatically open `http://localhost:8000`
   - Or manually navigate to `http://localhost:8000`

3. **To use JSON file approach:**
   - Replace `script.js` with `script-server.js` in `index.html`
   - The server will serve the JSON file without CORS issues

## 📁 File Structure

```
profile_page/
├── index.html              # Main HTML file
├── styles.css              # All CSS styling
├── script.js               # JavaScript with embedded data (default)
├── script-server.js        # JavaScript that loads from JSON file
├── profile-data.json       # Profile data in JSON format
├── server.py              # Python HTTP server
└── README.md              # This file
```

## 🎨 Features

- **Code Editor Aesthetic**: Syntax highlighting with dark theme
- **Responsive Design**: Works on desktop and mobile
- **Dynamic Content**: Easy to update profile information
- **Multiple Data Sources**: Can use embedded data or JSON file
- **Professional Sections**:
  - Personal Information
  - Work Skills (Frontend, Backend, Database, Cloud, Mobile, DevOps)
  - Programming Languages
  - Education
  - Work Experience
  - Certifications
  - Projects
  - Languages Spoken
  - Profile Traits

## 🎭 Templates

Pick a template with the switcher at the bottom of the page (the choice is remembered),
or link to one directly with `?template=code` / `?template=halloween` / `?template=chess-halloween`.
Every template renders the same `profile-data.json`.

- **Chess Halloween** (default, `templates/chess-halloween/`) — a green & white chess board where
  armoured Roman-style legions trade real chess moves: the white side (gods, angels, pegasi) at the
  bottom and the black side (Dracula, demons, witches) at the top. Idle black pieces hover and spin
  on brooms; idle white pieces get carried off on short flights by winged horses. Drag any piece
  onto any square — dropping it on an enemy piece fights and destroys it. Behind it all is a top-down
  strategy map: the light kingdom in daylight on the left, a ghost-ship island under night sky on the right.
- **Halloween** (`templates/halloween/`) — flying bats, Dracula, a pumpkin and a zombie.
  Sweep the cursor (or a finger) across the spider web in the top-right corner: each ring
  plays a bell note (Do Re Mi Fa Sol La Ti Do, from the corner outward) and the zombie and
  pumpkin dance.
  Sound is always on; browsers only start it after the first click/tap/key press on the page.
- **Code Editor** — the syntax-highlighted layout with the robot.

To add a template, register it in `TEMPLATES` in `script.js` and have its JS set
`window.ProfileTemplates.<name> = { render(data, rootElement) }`.

## 🔧 Customization

### To Update Profile Information:

**Method 1: Edit JavaScript file (script.js)**
- Open `script.js`
- Find the `profileData` object
- Update any information you want
- Save and refresh the browser

**Method 2: Edit JSON file (profile-data.json)**
- Open `profile-data.json`
- Update any information you want
- Save the file
- Use the server approach (`python3 server.py`)

### To Add New Sections:
1. Add the data structure to `profileData` (in script.js) or `profile-data.json`
2. Update the rendering functions in the JavaScript file
3. Add corresponding CSS styles if needed

## 🌐 Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 📱 Mobile Support

The profile page is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🛠️ Technical Details

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox
- **Vanilla JavaScript**: No external dependencies
- **JSON**: Structured data format
- **Python**: Optional HTTP server

## 🚨 Troubleshooting

### "Error loading profile data" message:
- **If opening directly**: Use the embedded data version (script.js)
- **If using server**: Make sure `profile-data.json` exists and server is running
- **Check browser console**: Look for specific error messages

### Styling issues:
- Make sure `styles.css` is in the same directory as `index.html`
- Check that the CSS file is properly linked in the HTML

### Server issues:
- Make sure Python 3 is installed
- Check that port 8000 is not already in use
- Try a different port by editing `PORT = 8000` in `server.py`

## New Year / Eiffel template

Open `index.html?template=new-year` or select **New Year ❄️** in the template switcher.
This dependency-free Canvas scene shows a snow-buried garden at night: a fixed,
perspective-projected 3D Eiffel Tower (curved legs, double arches, three decks with an arcade
frieze, lantern and antenna) carrying exactly 10,000 individually positioned bulbs, a snowman,
snow-laden pines, fence, bushes and a small ger camp, string lights, and an orange municipal
snowplow that clears the road and throws a snow spray. The tower never rotates.

Two searchlights sit on the top deck and shine **down** onto the snow; snowflakes that
cross a beam light up. The aurora in the sky and the five-pointed star on the summit are
always on, whatever the light program does. Every now and then a small flying saucer
(the Tetris Arcade saucer) drifts across the far sky.

### New Year countdown

Above the tower the sky shows the time left until 1 January 00:00 in the viewer's local
time (`46 өдөр 04:09:51`). The last ten seconds count down in large numbers with a tick and
a flash of the tower. At midnight the celebration starts automatically for 90 seconds:
`ШИНЭ ОНЫ МЭНД ХҮРГЭЕ` with the new year, rapid salute volleys (including red/blue/gold),
the tower in salute mode, and the year labels in the header update. Then the countdown to
the following year begins. Preview it with `?template=new-year&nytest=15` (starts 15 seconds
before midnight).

### Snowball game

The snowman wears a Mongolian юүдэн малгай (funnel-shaped upturned brim, pointed blue silk
crown with gold seams, red knot and tassels). A pile of snowballs sits beside him and on the
right stands a Mongolian archery target (сур): a low wall of leather cylinders, three rows
high, with red cylinders in the middle. Press on the pile, pull back like a slingshot (a dotted
line shows the arc) and release. A short tap on the pile, or the `B` key with the scene focused,
lobs a snowball at the target. A hit knocks the struck cylinders (and those stacked above them)
flying; the column is restacked a few seconds later. Red cylinders score 50 with an
`УУХАЙ!` call, leather ones 25; a ball through a gap keeps flying. The snowman's head knocks
his hat off (+15), his body +5 and the reindeer +20 (it bolts away). The best score is kept per browser (`winterSnowballBest.v1`).

### Light program

Edit commands and press **Ажиллуулах** or Ctrl/Cmd+Enter. Commands are parsed, never
evaluated as JavaScript. Errors show (and highlight) their line and keep the last working
scene. Valid programs are saved locally under `winterEiffelLights.v2`.

```text
// Default show: effects play in order, the last one holds
effect tree salute gold aurora flag
duration 8          // seconds per effect, 2–60
loop off            // on = start again after the last effect
speed 1             // 0–5
brightness 1        // 0–2
snow 0.8            // 0–1
beams sweep         // sweep | fan | still | follow | off
beamcolor #cfe8ff
color auto          // or 1–8 hex colours, e.g. color #ffd58a #ff727d
```

Effects:

| effect | look |
| --- | --- |
| `tree` | New Year tree: green body, a gold garland spiralling around the 3D shaft, ornaments, a star on top |
| `salute` (`fireworks`) | ceremonial salute: rhythmic firework volleys from the tower and the plaza, the tower flashes on each burst |
| `gold` | golden tower with the hourly white sparkle |
| `aurora` | aurora curtains in the sky, the tower ripples green–blue–violet |
| `olympic` | 24-second Paris 2024 inspired show with luminous rings |
| `steady`, `twinkle`, `wave`, `pulse`, `chase`, `rainbow` | classic patterns |
| `flag` | Mongolian flag ceremony: a flagpole rises from the snow, the state flag (red–blue–red with a gold Soyombo) is hoisted while the tower fills with the flag colours from the ground up; the searchlights follow the flag and a red/blue/gold salute fires when it reaches the top |

`flag` ignores `color` so the flag colours stay correct; `rainbow` uses its own palette.
`beams follow` points one light at the snowplow and the other at the reindeer.
Each effect change crossfades over about a second. Presets apply immediately.

### Mongolian reindeer and music

A Mongolian reindeer (grey-brown coat, pale neck mane, palmate brow tine, felt saddle over
the shoulders and a red halter) never hangs still for long: it gently gallops from one patch
of sky to another. **Click the reindeer** and sleigh bells ring, aurora sprays from its hooves,
the reindeer melts into the light and reappears somewhere else a moment later.
Click/tap empty sky to send it galloping there. Arrow keys move it toward a nearby
destination; Enter/Space crosses the scene. Swiping to scroll on mobile does not trigger a flight.

During a user-directed flight the chorus of "Jingle Bells" (J. L. Pierpont, 1857, public
domain) plays at 108 BPM with sleigh bells, synthesized with Web Audio, and the tower
switches to `wave`, `chase`, `twinkle`, `pulse` on successive beats. Arrival stops the
music and restores the program. The music button mutes audio while keeping the rhythm.
Pause and hidden tabs stop sound and movement; reduced-motion preferences start paused.
No external images, sound files or autoplay are used.

Rendering notes: static scenery and ironwork are cached per resize; the 10,000 bulbs are
written into one pixel buffer per frame and bloomed with a downscaled copy.

### Profile introduction

Under the scene a profile introduction (a Цасан өвгөн / Grandfather Frost avatar in a blue
Mongolian deel with white-grey hair and beard, wearing a Mongolian юүдэн малгай (upturned black
brim with gold edge, pointed blue silk crown, red knot and tassels), holding a snowflake staff,
drawn as inline SVG; nickname, title, summary, location, years of
experience, experience timeline, skills, projects, education, certifications, languages and
tools) sits on frosted-glass cards. A small herd of reindeer gallops across the section on
two canvases, some behind the cards (seen through the glass) and some in front of them.
The nickname turns into the full name when the pointer is on it; the surname stays
blurred until the pointer comes close to it (on touch: first tap shows the name, second tap the
surname, both hide again after 8 seconds). Keyboard focus shows the name with the surname blurred.
Email and phone stay blurred until hovered (first tap reveals them on touch screens).

Behind the cards the section is painted as a night valley: snowy mountains, a steaming hot
spring (`♨ ХАЛУУН РАШААН`) and the river flowing from it that never freezes (moving water
streaks and steam), spruces along both edges, and at the bottom an open snow field with a
red sleigh full of gifts and a lantern, decorated spruces and the galloping reindeer.
The spring and the sleigh are placed from the measured card layout so they stay visible.
The herd and the valley only animate while the section is on screen.

The "Paris 2024" preset button was removed; `effect olympic` still works from the editor.

Validation: `node --test tests/new-year.test.cjs`.
