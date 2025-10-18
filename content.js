class ViewMax {
  constructor() {
    this.isFullWebMode = false;
    this.toggleElement = null;
    this.microToggleElement = null;
    this.microToggleProcessing = false;
    this.microToggleEventHandler = null;
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

    // Create micro toggle (initially hidden)
    this.createMicroToggle();

    // Apply current state
    if (this.isFullWebMode) {
      this.enableFullWebMode();
      this.showMicroToggle();
    } else {
      this.hideMicroToggle();
      // Ensure main toggle is visible when ViewMax is not active
      if (this.toggleElement) {
        this.toggleElement.style.display = 'flex';
      }
    }

    // Listen for navigation changes
    this.observeNavigation();

    // Listen for window resize
    window.addEventListener('resize', () => {
      this.handleResize();
      this.handleResponsiveTogglePosition();
    });

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
    
    // Handle initial responsive positioning
    this.handleResponsiveTogglePosition();
    
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
      this.showMicroToggle();
    } else {
      this.disableFullWebMode();
      this.hideMicroToggle();
    }

    // Update checkbox state
    const checkbox = document.querySelector('#viewmax-checkbox');
    if (checkbox) {
      checkbox.checked = this.isFullWebMode;
    }

    // Update micro toggle state if it exists
    const microCheckbox = document.querySelector('#viewmax-micro-checkbox');
    if (microCheckbox) {
      microCheckbox.checked = this.isFullWebMode;
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

      // Update toggle status and hide main toggle during ViewMax mode
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'active');
        this.toggleElement.style.zIndex = '10000';
        // Hide main toggle during ViewMax mode - only show micro toggle
        this.toggleElement.style.display = 'none';
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

      // Update toggle status and show main toggle when ViewMax is disabled
      if (this.toggleElement) {
        this.toggleElement.setAttribute('data-status', 'inactive');
        this.toggleElement.style.zIndex = '';
        // Show main toggle when ViewMax is disabled
        this.toggleElement.style.display = 'flex';
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
    const chromeControls = document.querySelector('.ytp-chrome-controls');
    const progressBarContainer = document.querySelector('.ytp-progress-bar-container');
    const progressBarPadding = document.querySelector('.ytp-progress-bar-padding');
    const progressBar = document.querySelector('.ytp-progress-bar');
    const leftControls = document.querySelector('.ytp-left-controls');
    const rightControls = document.querySelector('.ytp-right-controls');
    
    if (controls) {
      // Force controls to be responsive and stretch full width
      controls.style.setProperty('width', '100%', 'important');
      controls.style.setProperty('max-width', '100vw', 'important');
      controls.style.setProperty('display', 'flex', 'important');
      controls.style.setProperty('align-items', 'center', 'important');
      controls.style.setProperty('box-sizing', 'border-box', 'important');
      
      // Ensure chrome controls container stretches full width
      if (chromeControls) {
        chromeControls.style.setProperty('width', '100%', 'important');
        chromeControls.style.setProperty('max-width', 'none', 'important');
        chromeControls.style.setProperty('display', 'flex', 'important');
        chromeControls.style.setProperty('align-items', 'center', 'important');
        chromeControls.style.setProperty('justify-content', 'space-between', 'important');
      }
      
      // Fix left and right controls to not shrink
      if (leftControls) {
        leftControls.style.setProperty('flex-shrink', '0', 'important');
        leftControls.style.setProperty('display', 'flex', 'important');
        leftControls.style.setProperty('align-items', 'center', 'important');
      }
      
      if (rightControls) {
        rightControls.style.setProperty('flex-shrink', '0', 'important');
        rightControls.style.setProperty('display', 'flex', 'important');
        rightControls.style.setProperty('align-items', 'center', 'important');
      }
      
      // Make timeline stretch to fill available space between left and right controls
      if (progressBarContainer) {
        progressBarContainer.style.setProperty('width', '100%', 'important');
        progressBarContainer.style.setProperty('max-width', '100%', 'important');
        progressBarContainer.style.setProperty('flex', '1', 'important');
        progressBarContainer.style.setProperty('min-width', '0', 'important');
        progressBarContainer.style.setProperty('margin', '0 12px', 'important');
        progressBarContainer.style.setProperty('box-sizing', 'border-box', 'important');
      }
      
      if (progressBarPadding) {
        progressBarPadding.style.setProperty('width', '100%', 'important');
        progressBarPadding.style.setProperty('max-width', '100%', 'important');
        progressBarPadding.style.setProperty('flex', '1', 'important');
        progressBarPadding.style.setProperty('min-width', '0', 'important');
        progressBarPadding.style.setProperty('box-sizing', 'border-box', 'important');
      }
      
      if (progressBar) {
        progressBar.style.setProperty('width', '100%', 'important');
        progressBar.style.setProperty('max-width', '100%', 'important');
        progressBar.style.setProperty('box-sizing', 'border-box', 'important');
      }
      
      // Simple timeline width enforcement
      setTimeout(() => {
        this.ensureTimelineWithinBounds();
      }, 100);
    }
  }

  ensureTimelineWithinBounds() {
    if (!this.isFullWebMode) return;

    const timelineElements = [
      '.ytp-progress-bar-container',
      '.ytp-progress-bar-padding',
      '.ytp-progress-bar',
      '.ytp-scrubber-container'
    ];

    timelineElements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.setProperty('width', '100%', 'important');
        element.style.setProperty('max-width', '100%', 'important');
        element.style.setProperty('box-sizing', 'border-box', 'important');
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

  createMicroToggle() {
    // Remove existing micro toggle if present
    const existingMicroToggle = document.getElementById('viewmax-micro-toggle');
    if (existingMicroToggle) {
      existingMicroToggle.remove();
    }

    // Create micro toggle container
    const microContainer = document.createElement("div");
    microContainer.id = "viewmax-micro-toggle";
    
    microContainer.innerHTML = `
      <label class="viewmax-micro-switch">
        <input type="checkbox" id="viewmax-micro-checkbox" ${this.isFullWebMode ? 'checked' : ''}>
        <span class="viewmax-micro-slider"></span>
      </label>
    `;

    // Add to document body (will be positioned in title bar area via CSS)
    document.body.appendChild(microContainer);
    
    // Apply dynamic positioning based on viewport and YouTube layout
    this.updateMicroTogglePosition(microContainer);

    // Add event listener with improved error handling
    const microCheckbox = document.getElementById("viewmax-micro-checkbox");
    if (microCheckbox) {
      microCheckbox.addEventListener("change", (e) => {
        console.log("ViewMax: Micro toggle changed:", e.target.checked);
        
        // Prevent rapid clicking issues
        if (this.microToggleProcessing) {
          e.preventDefault();
          return;
        }
        
        this.microToggleProcessing = true;
        
        try {
          // Only allow disabling through micro toggle (not enabling)
          if (!e.target.checked && this.isFullWebMode) {
            this.toggleMode();
          } else if (e.target.checked && !this.isFullWebMode) {
            // Prevent enabling through micro toggle - reset to unchecked
            e.target.checked = false;
            console.log("ViewMax: Micro toggle can only disable, not enable");
          }
        } catch (error) {
          console.error("ViewMax: Error handling micro toggle change:", error);
          // Reset to current state on error
          e.target.checked = this.isFullWebMode;
        } finally {
          // Reset processing flag after a short delay
          setTimeout(() => {
            this.microToggleProcessing = false;
          }, 100);
        }
      });
      
      // Store reference for cleanup
      this.microToggleEventHandler = microCheckbox;
    } else {
      console.error("ViewMax: Could not find micro toggle checkbox for event binding");
    }

    this.microToggleElement = microContainer;
    console.log("✅ ViewMax Micro Toggle created");
  }

  handleResponsiveTogglePosition() {
    if (!this.toggleElement) return;
    
    const viewportWidth = window.innerWidth;
    console.log(`ViewMax: Handling responsive toggle position for width: ${viewportWidth}px`);
    
    // Don't reposition if ViewMax is active (main toggle should be hidden)
    if (this.isFullWebMode) {
      console.log("ViewMax: Skipping toggle repositioning - ViewMax mode is active");
      return;
    }
    
    if (viewportWidth <= 1000) {
      // Small/Medium screens: Move toggle below player
      this.moveToggleBelowPlayer();
    } else {
      // Large screens: Move toggle back to sidebar
      this.moveToggleToSidebar();
    }
  }

  moveToggleBelowPlayer() {
    if (!this.toggleElement) return;
    
    // Find the player div
    const playerDiv = document.querySelector('#player');
    if (!playerDiv) {
      console.log("ViewMax: Player div not found, retrying...");
      setTimeout(() => this.moveToggleBelowPlayer(), 500);
      return;
    }
    
    // Remove from current parent
    this.toggleElement.remove();
    
    // Add responsive class for styling
    this.toggleElement.classList.add('viewmax-toggle-below-player');
    this.toggleElement.classList.remove('viewmax-toggle-sidebar');
    
    // Insert after the player div
    playerDiv.insertAdjacentElement('afterend', this.toggleElement);
    
    console.log("ViewMax: Toggle moved below player");
  }

  moveToggleToSidebar() {
    if (!this.toggleElement) return;
    
    // Find the sidebar
    const sidebar = document.querySelector('#secondary');
    if (!sidebar) {
      console.log("ViewMax: Sidebar not found, retrying...");
      setTimeout(() => this.moveToggleToSidebar(), 500);
      return;
    }
    
    // Remove from current parent
    this.toggleElement.remove();
    
    // Add sidebar class for styling
    this.toggleElement.classList.add('viewmax-toggle-sidebar');
    this.toggleElement.classList.remove('viewmax-toggle-below-player');
    
    // Insert at the top of sidebar
    sidebar.prepend(this.toggleElement);
    
    console.log("ViewMax: Toggle moved to sidebar");
  }



  updateMicroTogglePosition(microContainer) {
    if (!microContainer) return;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate safe positioning to avoid YouTube UI conflicts
    let topPosition = 20;
    let rightPosition = 20;
    
    // Check for YouTube header elements that might interfere
    const youtubeHeader = document.querySelector('#masthead-container');
    if (youtubeHeader) {
      const headerRect = youtubeHeader.getBoundingClientRect();
      if (headerRect.height > 0) {
        topPosition = Math.max(20, headerRect.height + 10);
      }
    }
    
    // Adjust for smaller screens
    if (viewportWidth <= 768) {
      topPosition = Math.min(topPosition, 10);
      rightPosition = 10;
    } else if (viewportWidth <= 1200) {
      topPosition = Math.min(topPosition, 15);
      rightPosition = 15;
    }
    
    // Apply positioning with fallback
    try {
      microContainer.style.setProperty('top', `${topPosition}px`, 'important');
      microContainer.style.setProperty('right', `${rightPosition}px`, 'important');
      
      // Ensure it's above all YouTube elements
      microContainer.style.setProperty('z-index', '10001', 'important');
      microContainer.style.setProperty('position', 'fixed', 'important');
    } catch (error) {
      console.log('ViewMax: Could not set micro toggle position', error);
      // Fallback to CSS-only positioning
    }
  }

  showMicroToggle() {
    if (!this.microToggleElement) {
      this.createMicroToggle();
    }
    
    if (this.microToggleElement) {
      // Update position before showing
      this.updateMicroTogglePosition(this.microToggleElement);
      
      // Show with animation
      this.microToggleElement.classList.remove('viewmax-micro-hide');
      this.microToggleElement.classList.add('viewmax-micro-show');
      this.microToggleElement.style.display = 'block';
      console.log("ViewMax: Micro toggle shown");
    }
  }

  hideMicroToggle() {
    if (this.microToggleElement) {
      // Hide with animation
      this.microToggleElement.classList.remove('viewmax-micro-show');
      this.microToggleElement.classList.add('viewmax-micro-hide');
      
      // Hide after animation completes
      setTimeout(() => {
        if (this.microToggleElement) {
          this.microToggleElement.style.display = 'none';
          this.microToggleElement.classList.remove('viewmax-micro-hide');
        }
      }, 300);
      
      console.log("ViewMax: Micro toggle hidden");
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

    // Clean up micro toggle and its event listeners
    if (this.microToggleEventHandler) {
      try {
        // Remove event listeners if they exist
        const microCheckbox = document.getElementById("viewmax-micro-checkbox");
        if (microCheckbox) {
          microCheckbox.removeEventListener("change", this.microToggleEventHandler);
        }
      } catch (error) {
        console.log("ViewMax: Error cleaning up micro toggle event listeners:", error);
      }
      this.microToggleEventHandler = null;
    }
    
    if (this.microToggleElement) {
      this.microToggleElement.remove();
      this.microToggleElement = null;
    }


    
    // Reset processing flags
    this.microToggleProcessing = false;
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

    // Recreate toggles if they don't exist
    if (!document.getElementById('viewmax-toggle')) {
      this.createToggle();
    }
    
    // Handle responsive toggle positioning
    this.handleResponsiveTogglePosition();

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