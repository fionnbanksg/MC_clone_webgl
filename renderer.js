class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      console.error('WebGL not supported');
      return;
    }
    
    // Initialize
    this.initShaders();
    this.initBuffers();
    
    // Set clear color to sky blue
    this.gl.clearColor(0.5, 0.7, 1.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    
    // Generate voxel terrain
    this.generateTerrain();
    
    // Set up camera
    this.camera = new Camera(canvas);
    
    // Set up animation
    this.cubeRotation = 0.0;
    this.lastFrameTime = 0;
  }
  
  generateTerrain() {
    // Minecraft-like chunk settings
    this.chunkSize = 16;  // 16x16 blocks horizontally (standard Minecraft chunk size)
    this.chunkHeight = 32; // Vertical height of the chunk
    this.blockSize = 2.0;  // Size of each block
    
    // Array to hold block types (0 = air, 1 = grass, 2 = dirt, 3 = stone, 4 = water, etc.)
    this.blocks = new Array(this.chunkSize * this.chunkSize * this.chunkHeight).fill(0);
    
    // Generate terrain using a simple heightmap
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        // Simple terrain height function (you can replace with more complex noise)
        const height = Math.floor(
          Math.sin(x * 0.4) * 2 + 
          Math.cos(z * 0.3) * 2 + 
          Math.sin((x + z) * 0.5) * 3 + 
          8
        );
        
        for (let y = 0; y < this.chunkHeight; y++) {
          const index = this.getBlockIndex(x, y, z);
          
          if (y === 0) {
            // Bedrock layer
            this.blocks[index] = 5;
          } else if (y < height - 4) {
            // Stone layer
            this.blocks[index] = 3;
          } else if (y < height - 1) {
            // Dirt layer
            this.blocks[index] = 2;
          } else if (y === height - 1) {
            // Grass layer (top)
            this.blocks[index] = 1;
          } else if (y < 6 && height < 6) {
            // Water in low areas
            this.blocks[index] = 4;
          }
          // Everything else stays 0 (air)
        }
        
        // Randomly add some stone outcroppings
        if (Math.random() < 0.05) {
          const stoneHeight = Math.floor(height + 1 + Math.random() * 3);
          for (let y = height; y < stoneHeight && y < this.chunkHeight; y++) {
            this.blocks[this.getBlockIndex(x, y, z)] = 3;
          }
        }
        
        // Randomly add trees
        if (Math.random() < 0.02 && height > 6) {
          this.generateTree(x, height, z);
        }
      }
    }
  }
  
  generateTree(x, y, z) {
    // Tree trunk
    const trunkHeight = 4 + Math.floor(Math.random() * 3);
    for (let treeY = 0; treeY < trunkHeight; treeY++) {
      if (y + treeY < this.chunkHeight) {
        this.blocks[this.getBlockIndex(x, y + treeY, z)] = 6; // Wood
      }
    }
    
    // Tree leaves
    const leafStart = y + trunkHeight - 2;
    const leafSize = 2;
    
    for (let lx = -leafSize; lx <= leafSize; lx++) {
      for (let ly = 0; ly <= leafSize + 1; ly++) {
        for (let lz = -leafSize; lz <= leafSize; lz++) {
          const leafX = x + lx;
          const leafY = leafStart + ly;
          const leafZ = z + lz;
          
          // Skip if outside chunk boundaries
          if (leafX < 0 || leafX >= this.chunkSize || 
              leafY < 0 || leafY >= this.chunkHeight || 
              leafZ < 0 || leafZ >= this.chunkSize) {
            continue;
          }
          
          // Make round-ish leaf clusters
          const distance = Math.sqrt(lx*lx + ly*ly + lz*lz);
          if (distance <= leafSize + 0.5) {
            // Don't overwrite existing blocks (like the trunk)
            const index = this.getBlockIndex(leafX, leafY, leafZ);
            if (this.blocks[index] === 0) {
              this.blocks[index] = 7; // Leaves
            }
          }
        }
      }
    }
  }
  
  getBlockIndex(x, y, z) {
    return (y * this.chunkSize * this.chunkSize) + (z * this.chunkSize) + x;
  }
  
  getVisibleFaces(x, y, z) {
    // Check each of the 6 directions to see if that face is visible
    // (i.e., if it's adjacent to an air block or the edge of the chunk)
    const faces = {
      px: false, // positive x face
      nx: false, // negative x face
      py: false, // positive y face
      ny: false, // negative y face
      pz: false, // positive z face
      nz: false  // negative z face
    };
    
    // Check +X face
    if (x === this.chunkSize - 1 || this.getBlock(x + 1, y, z) === 0 || this.getBlock(x + 1, y, z) === 4) {
      faces.px = true;
    }
    
    // Check -X face
    if (x === 0 || this.getBlock(x - 1, y, z) === 0 || this.getBlock(x - 1, y, z) === 4) {
      faces.nx = true;
    }
    
    // Check +Y face
    if (y === this.chunkHeight - 1 || this.getBlock(x, y + 1, z) === 0 || this.getBlock(x, y + 1, z) === 4) {
      faces.py = true;
    }
    
    // Check -Y face
    if (y === 0 || this.getBlock(x, y - 1, z) === 0 || this.getBlock(x, y - 1, z) === 4) {
      faces.ny = true;
    }
    
    // Check +Z face
    if (z === this.chunkSize - 1 || this.getBlock(x, y, z + 1) === 0 || this.getBlock(x, y, z + 1) === 4) {
      faces.pz = true;
    }
    
    // Check -Z face
    if (z === 0 || this.getBlock(x, y, z - 1) === 0 || this.getBlock(x, y, z - 1) === 4) {
      faces.nz = true;
    }
    
    return faces;
  }
  
  getBlock(x, y, z) {
    if (x < 0 || x >= this.chunkSize || 
        y < 0 || y >= this.chunkHeight || 
        z < 0 || z >= this.chunkSize) {
      return 0; // Treat out-of-bounds as air
    }
    
    return this.blocks[this.getBlockIndex(x, y, z)];
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
  }
  
  initBuffers() {
    // Create position buffer for cube
    const positions = [
      // Front face
      -1.0, -1.0,  1.0,
       1.0, -1.0,  1.0,
       1.0,  1.0,  1.0,
      -1.0,  1.0,  1.0,
      
      // Back face
      -1.0, -1.0, -1.0,
      -1.0,  1.0, -1.0,
       1.0,  1.0, -1.0,
       1.0, -1.0, -1.0,
      
      // Top face
      -1.0,  1.0, -1.0,
      -1.0,  1.0,  1.0,
       1.0,  1.0,  1.0,
       1.0,  1.0, -1.0,
      
      // Bottom face
      -1.0, -1.0, -1.0,
       1.0, -1.0, -1.0,
       1.0, -1.0,  1.0,
      -1.0, -1.0,  1.0,
      
      // Right face
       1.0, -1.0, -1.0,
       1.0,  1.0, -1.0,
       1.0,  1.0,  1.0,
       1.0, -1.0,  1.0,
      
      // Left face
      -1.0, -1.0, -1.0,
      -1.0, -1.0,  1.0,
      -1.0,  1.0,  1.0,
      -1.0,  1.0, -1.0,
    ];
    
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    
    // Create color buffer for cube
    const faceColors = [
      [1.0, 0.0, 0.0, 1.0],    // Front: red
      [0.0, 1.0, 0.0, 1.0],    // Back: green
      [0.0, 0.0, 1.0, 1.0],    // Top: blue
      [1.0, 1.0, 0.0, 1.0],    // Bottom: yellow
      [1.0, 0.0, 1.0, 1.0],    // Right: purple
      [0.0, 1.0, 1.0, 1.0],    // Left: cyan
    ];
    
    let colors = [];
    
    for (let j = 0; j < faceColors.length; ++j) {
      const c = faceColors[j];
      
      // Add the same color for each vertex of the face
      colors = colors.concat(c, c, c, c);
    }
    
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
    
    // Create index buffer for cube
    const indices = [
      0,  1,  2,      0,  2,  3,    // front
      4,  5,  6,      4,  6,  7,    // back
      8,  9,  10,     8,  10, 11,   // top
      12, 13, 14,     12, 14, 15,   // bottom
      16, 17, 18,     16, 18, 19,   // right
      20, 21, 22,     20, 22, 23,   // left
    ];
    
    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
    
    // Initialize ground plane
    this.initGroundPlane();
    
    // Store buffers
    this.buffers = {
      position: positionBuffer,
      color: colorBuffer,
      indices: indexBuffer,
    };
  }
  
  initGroundPlane() {
    // Create a large ground plane for orientation
    const groundSize = 50.0;
    const groundY = -3.0;
    
    // Positions for ground plane vertices
    const groundPositions = [
      -groundSize, groundY, -groundSize,
       groundSize, groundY, -groundSize,
       groundSize, groundY,  groundSize,
      -groundSize, groundY,  groundSize,
    ];
    
    const groundPositionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, groundPositionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(groundPositions), this.gl.STATIC_DRAW);
    
    // Color for ground (checkerboard pattern will be applied in shader)
    const groundColor = [0.5, 0.5, 0.5, 1.0];
    const groundColors = Array(4).fill(groundColor).flat();
    
    const groundColorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, groundColorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(groundColors), this.gl.STATIC_DRAW);
    
    // Indices for ground plane
    const groundIndices = [
      0, 1, 2,
      0, 2, 3,
    ];
    
    const groundIndexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, groundIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(groundIndices), this.gl.STATIC_DRAW);
    
    // Store ground buffers
    this.groundBuffers = {
      position: groundPositionBuffer,
      color: groundColorBuffer,
      indices: groundIndexBuffer,
      count: groundIndices.length,
    };
  }
  
  render(currentTime) {
    currentTime *= 0.001;  // Convert to seconds
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Update camera based on keyboard and mouse inputs
    this.camera.update(deltaTime);
    
    // Update cube rotation
    this.cubeRotation += deltaTime * 0.5; // Slow down rotation a bit
    
    this.resize();
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Create perspective matrix
    const fieldOfView = 45 * Math.PI / 180;   // in radians
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    
    // Get the camera view matrix
    const viewMatrix = this.camera.getViewMatrix();
    
    // Define cube positions
    const cubePositions = [
      [0.0, 0.0, 0.0],
      [2.0, 5.0, -15.0],
      [-1.5, -2.2, -2.5],
      [-3.8, -2.0, -12.3],
      [2.4, -0.4, -3.5],
      [-1.7, 3.0, -7.5],
      [1.3, -2.0, -2.5],
      [1.5, 2.0, -2.5],
      [1.5, 0.2, -1.5],
      [-1.3, 1.0, -1.5]
    ];
    
    // Set vertex position
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexPosition,
      3,        // 3 components per vertex
      this.gl.FLOAT,
      false,
      0,
      0);
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
    
    // Set vertex color
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexColor,
      4,        // 4 components per color
      this.gl.FLOAT,
      false,
      0,
      0);
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);
    
    // Bind indices
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
    
    // Use our shader program
    this.gl.useProgram(this.programInfo.program);
    
    // Set projection matrix uniform (same for all cubes)
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
    
    // Draw ground plane first
    {
      const groundModelViewMatrix = mat4.create();
      
      // Start with camera view matrix
      for (let j = 0; j < 16; j++) {
        groundModelViewMatrix[j] = viewMatrix[j];
      }
      
      // Set the model-view matrix for ground
      this.gl.uniformMatrix4fv(
        this.programInfo.uniformLocations.modelViewMatrix,
        false,
        groundModelViewMatrix);
      
      // Set up ground position buffer
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.groundBuffers.position);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexPosition,
        3,        // 3 components per vertex
        this.gl.FLOAT,
        false,
        0,
        0);
      
      // Set up ground color buffer
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.groundBuffers.color);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexColor,
        4,        // 4 components per color
        this.gl.FLOAT,
        false,
        0,
        0);
      
      // Bind ground indices
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.groundBuffers.indices);
      
      // Draw the ground
      this.gl.drawElements(this.gl.TRIANGLES, this.groundBuffers.count, this.gl.UNSIGNED_SHORT, 0);
    }
    
    // Set up cube position buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexPosition,
      3,
      this.gl.FLOAT,
      false,
      0,
      0);
    
    // Set up cube color buffer
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexColor,
      4,
      this.gl.FLOAT,
      false,
      0,
      0);
    
    // Bind cube indices
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
    
    // Draw each cube with its own model-view matrix
    for (let i = 0; i < cubePositions.length; i++) {
      // Create a new model-view matrix for each cube
      const modelViewMatrix = mat4.create();
      
      // Start with camera view matrix
      for (let j = 0; j < 16; j++) {
        modelViewMatrix[j] = viewMatrix[j];
      }
      
      // Apply unique position
      mat4.translate(modelViewMatrix, modelViewMatrix, cubePositions[i]);
      
      // Apply unique rotation
      const angle = this.cubeRotation * (i * 0.3 + 1.0);
      mat4.rotate(modelViewMatrix, modelViewMatrix, angle, [1.0, 0.3, 0.5]);
      
      // Set the model-view matrix for this cube
      this.gl.uniformMatrix4fv(
        this.programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);
      
      // Draw the cube
      this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_SHORT, 0);
    }
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
  
  start() {
    const render = (time) => {
      this.render(time);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }
}