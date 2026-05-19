# AntiGravity WebGL Particles — Integration Guide

A modular, framework-free class to drop the high-performance, GPU-simulated WebGL **Google AntiGravity** particle background on *any* website in under 5 minutes.

It handles WebGL initialization, GPU shaders, simulation targets, touch/mouse raycasting, smart mobile viewport downscaling, and dynamic light/dark mode changes on its own.

---

## 1. Get the Script

The library has been packaged as a clean ES6 class in your directory:
📁 [antigravity-particles.js](file:///c:/Users/AdityaKatyayan/OneDrive%20-%20Valsoft%20Corporation/Documents/TEST/antigravity-particles.js)

---

## 2. Quick Start Integration

### Step A: Add Canvas to HTML
Place this element as a background wrapper on your page:
```html
<!-- Background WebGL Layer -->
<canvas id="webgl-canvas"></canvas>
```

### Step B: Apply CSS
Set the canvas to fill the screen and sit underneath the content layer:
```css
#webgl-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none; /* Let clicks pass through to content */
}
```

### Step C: Load Scripts & Initialize
Ensure **Three.js** is loaded first, then link your library script and initialize:
```html
<!-- Load Three.js (r134 highly recommended) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>

<!-- Load the AntiGravity library -->
<script src="./antigravity-particles.js"></script>

<script>
  // Instantiate the background
  const bgParticles = new AntiGravityParticles('#webgl-canvas');
</script>
```

---

## 3. Configuration API

The `AntiGravityParticles` constructor takes an options object to customize all performance parameters, dimensions, and theme palettes:

```javascript
const customParticles = new AntiGravityParticles('#webgl-canvas', {
  // Mobile breakpoint in pixels
  mobileBreakpoint: 768,

  // Density (number of Poisson disk points)
  densityDesktop: 230,
  densityMobile: 120, // Reduced automatically on small screens

  // Particle styling sizes
  particleScaleDesktop: 0.59,
  particleScaleMobile: 0.42,

  // Physics ring force options
  ringWidth: 0.006,
  ringWidth2: 0.107,
  ringDisplacement: 0.62,

  // Custom Colors for Dark Mode
  darkColors: {
    color1: '#7189ff', // Glowing light blue
    color2: '#3074f9', // Deep royal blue
    color3: '#000000'  // Blends into pure black background
  },

  // Custom Colors for Light Mode
  lightColors: {
    color1: '#2c64ed', // Google Blue
    color2: '#f84242', // Google Red
    color3: '#ffcf03'  // Google Yellow
  },

  // Start with Dark Theme
  isDarkInitial: true
});
```

---

## 4. Theme Hooking API

To seamlessly toggle between Dark and Light mode (e.g., when your UI's theme switcher button is clicked), call `.updateTheme(isDark)` on your instance:

```javascript
// Example UI theme toggle listener
function myThemeToggleHandler(isCurrentlyDark) {
  // Toggle the 3D particles system theme
  bgParticles.updateTheme(isCurrentlyDark);
}
```

---

## 5. Cleanup & Lifecycle (Optional)

If you are using this in single-page apps (like React, Vue, Svelte, or Next.js) where components mount and unmount, clean up standard events and GPU WebGL textures to prevent memory leaks:

```javascript
// Unmount/Destroy
customParticles.destroy();
```
