class ViewMax {
  constructor() {
    this.isFullWebMode = false;
    this.toggleElement = null;
    this.hiddenElements = [];
    this.originalStyles = new Map();
    this.init();
  }

  async init() {
    // Wait for YouTube to load
    await this.waitForYouTube();

    // Load saved state
    await this.loadState();

    // Create toggle
    this.createToggle();

    // Apply current state
    if (this.isFullWebMode) {
      this.enableFullWebMode();
    }

    // Listen for navigation changes
    this.observeNavigation();

    // Listen for window resize
    window.addEventListener('resize', () => this.handleResize());

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'toggle-viewmax') {
        this.toggleMode();
        sendResponse({ success: true });
      }
    });
  }

  waitForYouTube() {
    return new Promise((resolve) => {
      const checkForVideo = () => {
        const videoElement = document.querySelector('video');
        const playerContainer = document.querySelector('#movie_player, .html5-video-player');

        if (videoElement && playerContainer) {
          resolve();
        } else {
          setTimeout(checkForVideo, 500);
        }
      };
      checkForVideo();
    });
  }

  async loadState() {
    try {
      const result = await chrome.storage.sync.get(['viewmaxEnabled']);
      this.isFullWebMode = result.viewmaxEnabled || false;
    } catch (error) {
      console.log('ViewMax: Could not load state', error);
      this.isFullWebMode = false;
    }
  }

  async saveState() {
    try {
      await chrome.storage.sync.set({ viewmaxEnabled: this.isFullWebMode });
    } catch (error) {
      console.log('ViewMax: Could not save state', error);
    }
  }

  createToggle() {
    // Load fonts first like audio enhancer
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Galada&family=Poppins:ital,wght@0,300;0,400;1,300;1,400&display=swap";
    document.head.appendChild(fontLink);

    // Remove existing toggle if present
    const existingToggle = document.getElementById('viewmax-toggle');
    if (existingToggle) {
      existingToggle.remove();
    }

    // Find the sidebar exactly like the audio enhancer
    const sidebar = document.querySelector('#secondary');
    if (!sidebar) {
      console.log("ViewMax: Sidebar not found, retrying...");
      setTimeout(() => this.createToggle(), 500);
      return;
    }

    console.log("ViewMax: Injecting UI...");

    // Create toggle container exactly like audio enhancer
    const container = document.createElement("div");
    container.id = "viewmax-toggle";
    container.setAttribute('data-status', this.isFullWebMode ? 'active' : 'inactive');
    
    container.innerHTML = `
      <div class="viewmax-ui">
        <img src="${chrome.runtime.getURL('icon.png')}" class="viewmax-logo" />
        <span class="viewmax-label">ViewMax</span>
        <div class="viewmax-controls">
          <div class="viewmax-status-indicator" id="viewmaxStatus">${this.isFullWebMode ? 'Active' : 'Ready'}</div>
          <label class="viewmax-switch">
            <input type="checkbox" id="viewmax-checkbox" ${this.isFullWebMode ? 'checked' : ''}>
            <span class="viewmax-slider"></span>
          </label>
        </div>
      </div>
    `;

    // Insert at the top of sidebar like audio enhancer
    sidebar.prepend(container);

    // Add event listeners
    const toggle = document.getElementById("viewmax-checkbox");
    
    toggle.addEventListener("change", (e) => {
      console.log("ViewMax: Toggle changed:", e.target.checked);
      this.toggleMode();
    });

    // Add global mouse tracking for hover effect
    document.addEventListener('mousemove', (e) => {
      const overlay = document.getElementById('viewmax-toggle');
      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        overlay.style.setProperty('--mouse-x', `${x}px`);
        overlay.style.setProperty('--mouse-y', `${y}px`);
      }
    });

    this.toggleElement = container;
    console.log("✅ ViewMax UI injected successfully");
  }

  getToggleClass() {
    return 'viewmax-toggle-container';
  }

  handleResize() {
    // Handle video resizing in full web mode
    if (this.isFullWebMode) {
      this.maintainVideoAspectRatio();
    }
  }

  toggleMode() {
    console.log('ViewMax: Toggling mode from', this.isFullWebMode ? 'ON' : 'OFF');
    this.isFullWebMode = !this.isFullWebMode;

    if (this.isFullWebMode) {
      this.enableFullWebMode();
    } else {
      this.disableFullWebMode();
    }

    // Update checkbox state
    const checkbox = document.querySelector('#viewmax-checkbox');
    if (checkbox) {
      checkbox.checked = this.isFullWebMode;
    }

    this.saveState();
  }

  enableFullWebMode() {
    console.log('ViewMax: Enabling full web mode');

    // Hide all distracting elements first
    this.hideElements();

    // Get all the necessary elements
    const playerContainer = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    const videoContainer = document.querySelector('.html5-video-container');
    const pageContainer = document.querySelector('ytd-watch-flexy');
    
    if (playerContainer && video) {
      // Store original styles for all elements
      this.storeOriginalStyles(playerContainer);
      this.storeOriginalStyles(video);
      if (videoContainer) this.storeOriginalStyles(videoContainer);
      if (pageContainer) this.storeOriginalStyles(pageContainer);
      
      // Set body to prevent scrolling
      document.body.style.overflow = 'hidden';
      
      // Apply CSS class for full web mode
      playerContainer.classList.add('viewmax-fullscreen');
      
      // The CSS class handles the styling
      
      // Force video to maintain aspect ratio
      this.maintainVideoAspectRatio();

      // Update toggle status
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'active');
        this.toggleElement.style.zIndex = '10000';
        const statusIndicator = document.getElementById('viewmaxStatus');
        if (statusIndicator) {
          statusIndicator.textContent = 'Active';
        }
      }
    }
  }

  disableFullWebMode() {
    console.log('ViewMax: Disabling full web mode');

    // Restore body overflow
    document.body.style.overflow = '';

    // Show all hidden elements first
    this.showElements();

    // Get all the elements
    const playerContainer = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    const videoContainer = document.querySelector('.html5-video-container');
    const pageContainer = document.querySelector('ytd-watch-flexy');
    
    if (playerContainer && video) {
      // Remove CSS class
      playerContainer.classList.remove('viewmax-fullscreen');

      // Update toggle status
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'inactive');
        this.toggleElement.style.zIndex = '';
        const statusIndicator = document.getElementById('viewmaxStatus');
        if (statusIndicator) {
          statusIndicator.textContent = 'Ready';
        }
      }
    }
  }

  maintainVideoAspectRatio() {
    const video = document.querySelector('video');
    if (!video || !this.isFullWebMode) return;

    const updateVideoSize = () => {
      if (!this.isFullWebMode) return;
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const windowAspectRatio = windowWidth / windowHeight;

      if (videoAspectRatio > windowAspectRatio) {
        // Video is wider than window
        video.style.width = '100vw';
        video.style.height = 'auto';
      } else {
        // Video is taller than window
        video.style.width = 'auto';
        video.style.height = '100vh';
      }
    };

    // Update immediately
    if (video.videoWidth && video.videoHeight) {
      updateVideoSize();
    }

    // Listen for video metadata load
    video.addEventListener('loadedmetadata', updateVideoSize);
    
    // Listen for window resize
    const resizeHandler = () => {
      if (this.isFullWebMode) {
        updateVideoSize();
      }
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // Store the handler for cleanup
    this.resizeHandler = resizeHandler;
  }

  hideElements() {
    const selectorsToHide = [
      // Header and navigation
      '#masthead-container',
      'ytd-mini-guide-renderer',

      // Video metadata and info
      '#above-the-fold #top-row',
      '#below-the-fold',
      'ytd-watch-metadata',
      'ytd-video-primary-info-renderer',
      'ytd-video-secondary-info-renderer',
      '#info',
      '#meta',

      // Comments section
      '#comments',
      'ytd-comments',
      'ytd-comments-header-renderer',
      'ytd-comment-thread-renderer',

      // Sidebar and recommendations
      '#secondary',
      '#related',
      'ytd-watch-next-secondary-results-renderer',

      // Other distracting elements
      'ytd-merch-shelf-renderer',
      '#chips-wrapper',
      'ytd-rich-metadata-renderer'
    ];

    this.hiddenElements = [];

    selectorsToHide.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && !element.classList.contains('viewmax-hidden')) {
          // Store original display style
          const originalDisplay = window.getComputedStyle(element).display;
          this.hiddenElements.push({
            element: element,
            originalDisplay: originalDisplay
          });
          element.classList.add('viewmax-hidden');
        }
      });
    });

    console.log(`ViewMax: Hidden ${this.hiddenElements.length} elements`);
  }

  showElements() {
    this.hiddenElements.forEach(({ element, originalDisplay }) => {
      element.classList.remove('viewmax-hidden');
      // Don't set display style, let CSS handle it
    });
    this.hiddenElements = [];
    console.log('ViewMax: Restored all hidden elements');
  }

  storeOriginalStyles(element) {
    if (!element) return;
    
    const styles = [
      'position', 'top', 'left', 'width', 'height', 'zIndex', 'backgroundColor',
      'display', 'alignItems', 'justifyContent', 'objectFit', 'maxWidth', 'maxHeight'
    ];
    const originalStyles = {};

    styles.forEach(style => {
      originalStyles[style] = element.style[style] || '';
    });

    this.originalStyles.set(element, originalStyles);
  }

  restoreOriginalStyles(element) {
    if (!element) return;
    
    const originalStyles = this.originalStyles.get(element);
    if (originalStyles) {
      Object.keys(originalStyles).forEach(style => {
        element.style[style] = originalStyles[style];
      });
    }
  }

  cleanup() {
    // Clean up event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  handleKeyboard(e) {
    // Ctrl + Shift + F to toggle
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      e.stopPropagation();
      console.log('ViewMax: Keyboard shortcut triggered');
      this.toggleMode();
    }
  }

  observeNavigation() {
    // Watch for YouTube navigation changes
    let currentUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;

        // Delay to allow YouTube to load new content
        setTimeout(() => {
          this.handleNavigation();
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async handleNavigation() {
    // Wait for new video to load
    await this.waitForYouTube();

    // Recreate toggle if it doesn't exist
    if (!document.getElementById('viewmax-toggle')) {
      this.createToggle();
    }

    // Reapply current state
    if (this.isFullWebMode) {
      // Small delay to ensure elements are loaded
      setTimeout(() => {
        this.enableFullWebMode();
      }, 500);
    }
  }
}

// Initialize ViewMax when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ViewMax();
  });
} else {
  new ViewMax();
}