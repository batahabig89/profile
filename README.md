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
