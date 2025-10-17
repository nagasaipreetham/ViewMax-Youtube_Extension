# ViewMax - Chrome Extension

ViewMax is a Chrome extension that provides a distraction-free YouTube viewing experience by expanding videos to fill the entire webpage while hiding all distractions like comments, recommendations, and sidebar content.

## Features

- **Full Web Mode**: Toggle to expand YouTube videos to fill the entire browser viewport
- **Distraction-Free**: Hides comments, recommendations, titles, channel info, and sidebar
- **Responsive Design**: Adapts toggle UI based on screen size (large/compact versions)
- **Persistent State**: Remembers your preference across video navigation
- **Smooth Animations**: Fade transitions and hover effects
- **Keyboard Shortcut**: Use Ctrl+Shift+F to quickly toggle modes
- **Modern UI**: Red gradient theme with smooth interactions

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the ViewMax folder
5. The extension will be installed and ready to use

## Generating Icons

1. Open `icons/create_icons.html` in your browser
2. Click the download buttons to generate the required icon files
3. Save them in the `icons/` folder as `icon16.png`, `icon48.png`, and `icon128.png`

## Usage

1. Navigate to any YouTube video
2. Look for the ViewMax toggle in the top-right corner of the page
3. Click the toggle or use Ctrl+Shift+F to enable Full Web Mode
4. The video will expand to fill the entire webpage
5. Toggle again to return to normal YouTube layout

## Toggle Layouts

- **Large Version** (screens > 900px): Shows logo, "ViewMax" text, and toggle switch
- **Compact Version** (screens ≤ 900px): Shows only logo and toggle switch

## Technical Details

- **Manifest Version**: 3
- **Permissions**: activeTab, scripting, storage
- **Content Script**: Runs on all YouTube pages
- **Storage**: Uses Chrome sync storage to persist toggle state
- **Responsive**: CSS media queries for different screen sizes

## Files Structure

```
ViewMax/
├── manifest.json          # Extension configuration
├── content.js            # Main logic and YouTube integration
├── toggle.css           # Styling for the toggle UI
├── icons/               # Extension icons
│   ├── create_icons.html # Icon generator
│   ├── icon16.png       # 16x16 icon
│   ├── icon48.png       # 48x48 icon
│   └── icon128.png      # 128x128 icon
└── README.md           # This file
```

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers