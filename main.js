// Initialize WebGL when the page is loaded
window.onload = function() {
  const canvas = document.getElementById('webgl-canvas');
  
  // Use the WorldRenderer instead of the ChunkRenderer
  const renderer = new WorldRenderer(canvas);
  
  if (renderer.gl) {
    console.log('WebGL initialized successfully');
    renderer.start();
  } else {
    console.error('WebGL initialization failed');
    alert('Unable to initialize WebGL. Your browser may not support it.');
  }
};