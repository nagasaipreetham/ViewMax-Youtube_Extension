class ViewMax {
  constructor() {
    this.isFullWebMode = false;
    this.toggleElement = null;
    this.hiddenElements = [];
    this.originalStyles = new Map();
    this.init();
  }

  async init() {
    // Only run on video pages (URLs containing watch?v=)
    if (!this.isVideoPage()) {
      console.log('ViewMax: Not on video page, skipping initialization');
      return;
    }

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

  isVideoPage() {
    // Check if URL contains watch?v= which indicates a video is playing
    return window.location.href.includes('watch?v=');
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
      // Use debounced resize to prevent too many calls
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.maintainVideoAspectRatio();
        this.updateControlsResponsiveness();
      }, 150);
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
      
      // Force video to maintain aspect ratio and update controls
      setTimeout(() => {
        this.maintainVideoAspectRatio();
        this.updateControlsResponsiveness();
      }, 100);

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
    
    if (playerContainer && video) {
      // Remove CSS class first
      playerContainer.classList.remove('viewmax-fullscreen');
      
      // Restore original styles using stored values
      this.restoreOriginalStyles(playerContainer);
      this.restoreOriginalStyles(video);
      if (videoContainer) {
        this.restoreOriginalStyles(videoContainer);
      }
      
      // Reset all control elements completely
      this.resetAllControlStyles();
      
      // Force YouTube to recalculate video size properly
      setTimeout(() => {
        // Trigger YouTube's internal resize handler
        if (window.ytplayer && window.ytplayer.config) {
          const ytPlayer = document.querySelector('#movie_player');
          if (ytPlayer && ytPlayer.wrappedJSObject) {
            try {
              ytPlayer.wrappedJSObject.onResize();
            } catch (e) {
              // Fallback method
              const resizeEvent = new Event('resize', { bubbles: true });
              window.dispatchEvent(resizeEvent);
            }
          } else {
            // Standard fallback
            const resizeEvent = new Event('resize', { bubbles: true });
            window.dispatchEvent(resizeEvent);
          }
        } else {
          // Final fallback
          const resizeEvent = new Event('resize', { bubbles: true });
          window.dispatchEvent(resizeEvent);
        }
      }, 200);

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

  resetAllControlStyles() {
    // List of all control selectors that might have been modified
    const controlSelectors = [
      '.ytp-chrome-bottom',
      '.ytp-progress-bar-container',
      '.ytp-progress-bar',
      '.ytp-chrome-controls',
      '.ytp-left-controls',
      '.ytp-right-controls',
      '.ytp-progress-bar-padding',
      '.ytp-scrubber-container',
      '.ytp-play-progress',
      '.ytp-load-progress'
    ];

    // Reset all control elements
    controlSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.cssText = '';
        element.removeAttribute('style');
      });
    });
  }

  maintainVideoAspectRatio() {
    const video = document.querySelector('video');
    const playerContainer = document.querySelector('#movie_player');
    if (!video || !this.isFullWebMode || !playerContainer) return;

    const updateVideoSize = () => {
      if (!this.isFullWebMode) return;
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Account for controls height (approximately 80px)
      const availableHeight = windowHeight - 80;
      
      if (video.videoWidth && video.videoHeight) {
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const windowAspectRatio = windowWidth / availableHeight;

        if (videoAspectRatio > windowAspectRatio) {
          // Video is wider than available space - fit to width
          const calculatedHeight = windowWidth / videoAspectRatio;
          video.style.width = windowWidth + 'px';
          video.style.height = calculatedHeight + 'px';
        } else {
          // Video is taller than available space - fit to height
          const calculatedWidth = availableHeight * videoAspectRatio;
          video.style.width = calculatedWidth + 'px';
          video.style.height = availableHeight + 'px';
        }
      } else {
        // Fallback if video dimensions not available
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.objectFit = 'contain';
      }
      
      // Update controls responsiveness
      this.updateControlsResponsiveness();
    };

    // Update immediately
    updateVideoSize();

    // Listen for video metadata load
    video.addEventListener('loadedmetadata', updateVideoSize);
    
    // Listen for window resize with debouncing
    const resizeHandler = this.debounce(() => {
      if (this.isFullWebMode) {
        updateVideoSize();
      }
    }, 100);
    
    window.addEventListener('resize', resizeHandler);
    
    // Store the handler for cleanup
    this.resizeHandler = resizeHandler;
  }

  updateControlsResponsiveness() {
    if (!this.isFullWebMode) return;

    const controls = document.querySelector('.ytp-chrome-bottom');
    const progressBarContainer = document.querySelector('.ytp-progress-bar-container');
    const progressBarPadding = document.querySelector('.ytp-progress-bar-padding');
    const progressBar = document.querySelector('.ytp-progress-bar');
    
    if (controls) {
      // Calculate available width for timeline (accounting for padding)
      const windowWidth = window.innerWidth;
      const paddingWidth = windowWidth > 1000 ? 80 : 40; // 40px padding on each side for >1000px
      const availableWidth = windowWidth - paddingWidth;
      
      // Force controls to be responsive
      controls.style.setProperty('width', '100vw', 'important');
      controls.style.setProperty('max-width', 'none', 'important');
      
      // Aggressively fix timeline for screens above 1000px
      if (progressBarContainer) {
        progressBarContainer.style.setProperty('width', '100%', 'important');
        progressBarContainer.style.setProperty('max-width', 'none', 'important');
        progressBarContainer.style.setProperty('flex', '1', 'important');
        progressBarContainer.style.setProperty('min-width', '0', 'important');
      }
      
      if (progressBarPadding) {
        progressBarPadding.style.setProperty('width', '100%', 'important');
        progressBarPadding.style.setProperty('flex', '1', 'important');
        progressBarPadding.style.setProperty('min-width', '0', 'important');
        progressBarPadding.style.setProperty('max-width', 'none', 'important');
      }
      
      if (progressBar) {
        progressBar.style.setProperty('width', '100%', 'important');
        progressBar.style.setProperty('max-width', 'none', 'important');
      }
      
      // Use MutationObserver to continuously enforce timeline width
      this.enforceTimelineWidth();
      
      // Force multiple layout recalculations
      setTimeout(() => {
        this.forceTimelineReflow();
      }, 50);
      
      setTimeout(() => {
        this.forceTimelineReflow();
      }, 200);
    }
  }

  enforceTimelineWidth() {
    if (this.timelineObserver) {
      this.timelineObserver.disconnect();
    }

    const progressBarContainer = document.querySelector('.ytp-progress-bar-container');
    if (progressBarContainer && this.isFullWebMode) {
      this.timelineObserver = new MutationObserver(() => {
        if (this.isFullWebMode) {
          const currentWidth = progressBarContainer.style.width;
          if (currentWidth && currentWidth.includes('px') && !currentWidth.includes('100%')) {
            progressBarContainer.style.setProperty('width', '100%', 'important');
            progressBarContainer.style.setProperty('max-width', 'none', 'important');
          }
        }
      });

      this.timelineObserver.observe(progressBarContainer, {
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }

  forceTimelineReflow() {
    const elements = [
      '.ytp-progress-bar-container',
      '.ytp-progress-bar-padding',
      '.ytp-progress-bar',
      '.ytp-chrome-bottom'
    ];

    elements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && element.offsetParent) {
        element.style.display = 'none';
        element.offsetHeight; // Force reflow
        element.style.display = '';
      }
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
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
    
    // Clean up timeline observer
    if (this.timelineObserver) {
      this.timelineObserver.disconnect();
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
    // Only handle navigation if we're on a video page
    if (!this.isVideoPage()) {
      // If we're leaving a video page, clean up
      const existingToggle = document.getElementById('viewmax-toggle');
      if (existingToggle) {
        existingToggle.remove();
      }
      // Disable full web mode if it's active
      if (this.isFullWebMode) {
        this.isFullWebMode = false;
        this.disableFullWebMode();
      }
      return;
    }

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