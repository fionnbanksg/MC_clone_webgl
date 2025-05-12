// WorldRenderer.js - Manages rendering the Minecraft-style world

class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }
    
    // Initialize
    this.initShaders();
    
    // Set clear color to light blue sky
    this.gl.clearColor(0.5, 0.7, 1.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    
    // Create the world with a render distance of 4 chunks
    this.world = new World(this.gl, 4);
    this.world.init(this.programInfo);
    
    // Set up camera
    this.camera = new Camera(canvas);
    
    // Set up animation
    this.lastFrameTime = 0;
    
    // Stats for debugging
    this.stats = {
      fps: 0,
      chunksRendered: 0
    };
    
    // UI elements
    this.createUI();
  }
  
  initShaders() {
    // Create shader program
    this.shaderProgram = createShaderProgram(this.gl, vertexShaderSource, fragmentShaderSource);
    
    // Set up program info
    this.programInfo = {
      program: this.shaderProgram,
      attribLocations: {
        vertexPosition: this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition'),
        vertexColor: this.gl.getAttribLocation(this.shaderProgram, 'aVertexColor'),
      },
      uniformLocations: {
        projectionMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: this.gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
      },
    };
    
    // Pass program info to the world
    if (this.world) {
      this.world.init(this.programInfo);
    }
  }
  
  createUI() {
    // Create stats display
    this.statsDisplay = document.createElement('div');
    this.statsDisplay.style.position = 'absolute';
    this.statsDisplay.style.top = '10px';
    this.statsDisplay.style.right = '10px';
    this.statsDisplay.style.color = 'white';
    this.statsDisplay.style.fontSize = '14px';
    this.statsDisplay.style.fontFamily = 'Arial, sans-serif';
    this.statsDisplay.style.padding = '5px';
    this.statsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    document.body.appendChild(this.statsDisplay);
    
    // Create render distance slider
    const renderDistanceControl = document.createElement('div');
    renderDistanceControl.style.position = 'absolute';
    renderDistanceControl.style.bottom = '10px';
    renderDistanceControl.style.right = '10px';
    renderDistanceControl.style.color = 'white';
    renderDistanceControl.style.fontSize = '14px';
    renderDistanceControl.style.fontFamily = 'Arial, sans-serif';
    renderDistanceControl.style.padding = '5px';
    renderDistanceControl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    
    const sliderLabel = document.createElement('div');
    sliderLabel.textContent = 'Render Distance: 4';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.value = '4';
    slider.style.width = '200px';
    
    slider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      sliderLabel.textContent = `Render Distance: ${value}`;
      this.world.setRenderDistance(value);
    });
    
    renderDistanceControl.appendChild(sliderLabel);
    renderDistanceControl.appendChild(slider);
    document.body.appendChild(renderDistanceControl);
    
    // Add block placement instructions
    const blockInstructions = document.createElement('div');
    blockInstructions.style.position = 'absolute';
    blockInstructions.style.bottom = '10px';
    blockInstructions.style.left = '10px';
    blockInstructions.style.color = 'white';
    blockInstructions.style.fontSize = '14px';
    blockInstructions.style.fontFamily = 'Arial, sans-serif';
    blockInstructions.style.padding = '5px';
    blockInstructions.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    blockInstructions.innerHTML = 'Left Click: Place Grass Block<br>Right Click: Remove Block';
    document.body.appendChild(blockInstructions);
    
    // Set up block placement handlers
    this.setupBlockPlacement();
  }
  
  setupBlockPlacement() {
    // Block placement distance
    const maxDistance = 6;
    
    // Left click to place block
    this.canvas.addEventListener('click', (e) => {
      if (document.pointerLockElement !== this.canvas || e.button !== 0) return;
      
      const pos = this.camera.position;
      const direction = this.camera.front;
      
      // Simple raycast to find block position
      for (let i = 1; i < maxDistance; i += 0.5) {
        const x = pos[0] + direction[0] * i;
        const y = pos[1] + direction[1] * i;
        const z = pos[2] + direction[2] * i;
        
        const blockType = this.world.getBlock(x, y, z);
        
        if (blockType !== 0) {  // If not air
          // Place block adjacent to the one we hit
          const nx = pos[0] + direction[0] * (i - 0.5);
          const ny = pos[1] + direction[1] * (i - 0.5);
          const nz = pos[2] + direction[2] * (i - 0.5);
          
          this.world.setBlock(nx, ny, nz, 1);  // Place grass block
          break;
        }
      }
    });
    
    // Right click to remove block
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();  // Prevent context menu
      
      if (document.pointerLockElement !== this.canvas) return;
      
      const pos = this.camera.position;
      const direction = this.camera.front;
      
      // Simple raycast to find block position
      for (let i = 1; i < maxDistance; i += 0.5) {
        const x = pos[0] + direction[0] * i;
        const y = pos[1] + direction[1] * i;
        const z = pos[2] + direction[2] * i;
        
        const blockType = this.world.getBlock(x, y, z);
        
        if (blockType !== 0) {  // If not air
          this.world.setBlock(x, y, z, 0);  // Set to air (remove block)
          break;
        }
      }
    });
  }
  
  render(currentTime) {
    currentTime *= 0.001;  // Convert to seconds
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Calculate FPS
    this.stats.fps = Math.round(1 / deltaTime);
    
    // Update camera based on keyboard and mouse inputs
    this.camera.update(deltaTime);
    
    // Update chunks based on camera position
    this.world.updateChunks(this.camera.position);
    
    // Capture stats
    this.stats.chunksRendered = this.world.loadedChunks.length;
    this.updateStats();
    
    // Resize canvas and clear
    this.resize();
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Create perspective matrix
    const fieldOfView = 70 * Math.PI / 180;   // Wider FOV for Minecraft-like feel
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 1000.0;
    const projectionMatrix = mat4.create();
    
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    
    // Get the camera view matrix
    const viewMatrix = this.camera.getViewMatrix();
    
    // Render the world
    this.world.render(viewMatrix, projectionMatrix);
  }
  
  resize() {
    // Handle canvas resize
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  updateStats() {
    this.statsDisplay.innerHTML = `FPS: ${this.stats.fps}<br>Chunks: ${this.stats.chunksRendered}`;
  }
  
  start() {
    const render = (time) => {
      this.render(time);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }
}