// Initialize WebGL when the page is loaded
window.onload = function() {
  const canvas = document.getElementById('webgl-canvas');
  
  // Use the ChunkRenderer instead of the regular Renderer
  const renderer = new ChunkRenderer(canvas);
  
  if (renderer.gl) {
    console.log('WebGL initialized successfully');
    renderer.start();
  } else {
    console.error('WebGL initialization failed');
    alert('Unable to initialize WebGL. Your browser may not support it.');
  }
};