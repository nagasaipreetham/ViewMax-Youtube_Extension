# 🎬 ViewMax - Premium YouTube Experience

---

## ✨ Overview

ViewMax is a sophisticated Chrome extension that revolutionizes YouTube viewing by providing an intelligent, distraction-free experience. With advanced responsive design and seamless toggle controls, it transforms any YouTube video into a cinematic full-web experience while maintaining all essential video functionality.

## 🚀 Key Features

### 🎯 **Intelligent Full Web Mode**
- **Immersive Experience**: Expands videos to fill the entire browser viewport
- **Aspect Ratio Preservation**: Maintains perfect video proportions across all screen sizes
- **Distraction Elimination**: Hides comments, recommendations, titles, and sidebar content
- **Control Preservation**: Keeps all video controls with enhanced responsiveness

### 🎛️ **Multi-Toggle System**
- **Main Toggle**: Full-featured UI with branding and status indicators
- **Micro Toggle**: Compact control that appears during ViewMax mode
- **Smart Positioning**: Automatically adapts to screen size and context
- **Seamless Transitions**: Smooth animations between different states

### 📱 **Advanced Responsive Design**
- **Desktop (>1000px)**: Main toggle positioned in sidebar with full branding
- **Mobile (≤1000px)**: Toggle repositioned below video with full-width layout
- **ViewMax Active**: Clean interface with only micro toggle visible
- **Dynamic Adaptation**: Real-time repositioning based on viewport changes

### ⌨️ **Enhanced User Experience**
- **Keyboard Shortcut**: `Ctrl+Shift+F` for instant toggle
- **Persistent Memory**: Remembers preferences across video navigation
- **Visual Feedback**: "Ready" and "Active" status indicators
- **Interactive Effects**: Mouse tracking with radial gradient hover effects

## 🎨 Design System

### **Color Palette**
```css
Primary Gradient: linear-gradient(145deg, #cc0000, #800000)
Accent Colors: #ff6666 → #cc0000
Text Colors: #ffffff with opacity variations
Status Colors: #ffcccc (ready) | #ffaaaa (active)
```

### **Typography**
- **Branding**: Galada (22px) - Elegant script font
- **UI Elements**: Poppins (10px) - Clean, modern sans-serif
- **Responsive Scaling**: 18px → 16px → 14px across breakpoints

### **Animation System**
- **Transitions**: 0.3s ease for smooth interactions
- **Hover Effects**: Scale(1.05) with glow shadows
- **Fade Animations**: 0.3s ease-out for state changes
- **Micro-interactions**: 0.15s for immediate feedback

## 📋 Installation

### **Method 1: Chrome Web Store** *(Coming Soon)*
1. Visit the Chrome Web Store
2. Search for "ViewMax"
3. Click "Add to Chrome"

### **Method 2: Developer Mode**
1. **Download**: Clone or download this repository
   ```bash
   git clone https://github.com/yourusername/viewmax.git
   ```

2. **Chrome Extensions**: Navigate to `chrome://extensions/`

3. **Developer Mode**: Enable "Developer mode" (top-right toggle)

4. **Load Extension**: Click "Load unpacked" and select the ViewMax folder

5. **Ready**: The extension is now installed and active on YouTube

## 🎮 Usage Guide

### **Basic Operation**
1. **Navigate** to any YouTube video
2. **Locate** the ViewMax toggle (sidebar or below video)
3. **Click** the toggle or press `Ctrl+Shift+F`
4. **Enjoy** distraction-free viewing
5. **Toggle again** to return to normal layout

### **Toggle Locations**
| Screen Size | Toggle Position | Features |
|-------------|----------------|----------|
| **Desktop (>1000px)** | Right sidebar | Full branding + status |
| **Mobile (≤1000px)** | Below video | Full-width + branding |
| **ViewMax Active** | Top-right corner | Micro toggle only |

### **Keyboard Shortcuts**
- `Ctrl+Shift+F` - Toggle ViewMax mode
- Works across all YouTube pages and video states

## 🏗️ Technical Architecture

### **File Structure**
```
ViewMax/
├── 📄 manifest.json          # Extension configuration (Manifest V3)
├── 🧠 content.js            # Core logic (962 lines, class-based)
├── ⚙️  background.js         # Service worker for shortcuts
├── 🎨 toggle.css            # Comprehensive styling system
├── 🖼️  icon.png             # Extension branding asset
├── 📖 README.md             # Documentation (this file)
└── 📝 description.txt       # Detailed project specifications
```

### **Core Technologies**
- **Manifest V3**: Latest Chrome extension standard
- **ES6+ JavaScript**: Modern async/await patterns
- **Advanced CSS**: Flexbox, Grid, Custom Properties
- **Chrome APIs**: Storage, Scripting, Commands

### **JavaScript Features**
```javascript
// Class-based architecture
class ViewMax {
  constructor() { /* Initialize components */ }
  async init() { /* Setup with async patterns */ }
  handleResponsiveTogglePosition() { /* Dynamic positioning */ }
  maintainVideoAspectRatio() { /* Responsive video sizing */ }
}

// Advanced DOM manipulation
const observer = new MutationObserver(/* YouTube SPA handling */);
const debounced = this.debounce(handler, 150); // Performance optimization
```

### **CSS Engineering**
```css
/* Dynamic mouse tracking */
#viewmax-toggle {
  background-image: radial-gradient(
    circle at var(--mouse-x, 50%) var(--mouse-y, 50%), 
    rgba(255,0,0,0.3), transparent 40%
  );
}

/* Responsive positioning */
@media (max-width: 1000px) {
  #viewmax-toggle {
    width: calc(100% - 40px);
    margin: 12px 20px;
  }
}
```

## 🔧 Configuration

### **Permissions Required**
- `activeTab` - Access current YouTube tab
- `scripting` - Inject content scripts
- `storage` - Persist user preferences

### **Supported URLs**
- `*://www.youtube.com/*` - All YouTube pages
- Automatically detects video pages (`watch?v=`)

## 🎯 Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| **Chrome** | ✅ Full | Primary target (Manifest V3) |
| **Edge** | ✅ Full | Chromium-based compatibility |
| **Brave** | ✅ Full | Chromium-based compatibility |
| **Opera** | ✅ Partial | Most features supported |
| **Firefox** | ❌ No | Manifest V3 not fully supported |

## 🚀 Performance Features

### **Optimizations**
- **Debounced Events**: Resize handlers optimized to 150ms
- **Efficient DOM Queries**: Cached selectors and minimal reflows
- **Lazy Loading**: Components initialized only when needed
- **Memory Management**: Proper cleanup of event listeners

### **Error Handling**
- **Graceful Degradation**: Continues working despite YouTube updates
- **Retry Mechanisms**: Automatic fallbacks for DOM queries
- **Console Logging**: Detailed debugging information
- **Fallback Strategies**: Multiple positioning approaches

## 🎨 Customization

### **CSS Variables**
```css
:root {
  --viewmax-primary: #cc0000;
  --viewmax-secondary: #800000;
  --viewmax-text: #ffffff;
  --viewmax-transition: 0.3s ease;
}
```

### **Responsive Breakpoints**
- **Desktop**: 1001px and above
- **Tablet**: 768px - 1000px
- **Mobile**: 480px - 767px
- **Small Mobile**: Below 480px

## 🐛 Troubleshooting

### **Common Issues**

**Toggle not appearing?**
- Ensure you're on a YouTube video page (`watch?v=`)
- Check if extension is enabled in `chrome://extensions/`
- Refresh the page and wait for YouTube to fully load

**ViewMax not activating?**
- Try the keyboard shortcut `Ctrl+Shift+F`
- Check browser console for error messages
- Disable other YouTube extensions temporarily

**Responsive issues?**
- Clear browser cache and cookies
- Disable browser zoom (set to 100%)
- Check if other extensions are interfering

### **Debug Mode**
Open browser console (F12) to see ViewMax debug logs:
```
ViewMax: Injecting UI...
ViewMax: Toggle moved to sidebar
ViewMax: Enabling full web mode
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Setup**
```bash
# Clone the repository
git clone https://github.com/yourusername/viewmax.git

# Navigate to directory
cd viewmax

# Load in Chrome for testing
# Go to chrome://extensions/ → Developer mode → Load unpacked
```

## 🙏 Acknowledgments

- **YouTube** for providing an amazing platform
- **Chrome Extensions Team** for excellent documentation
- **Open Source Community** for inspiration and best practices

---

<div align="center">

**Made with ❤️ for YouTube enthusiasts**

</div>