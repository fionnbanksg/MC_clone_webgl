// chunk.js - Minecraft-style chunk renderer with face culling optimization

class Chunk {
  constructor(size = 16) {
    this.size = size;
    this.blocks = new Uint8Array(size * size * size);
    this.blockTypes = {
      AIR: 0,
      GRASS: 1,
      DIRT: 2,
      STONE: 3,
      WATER: 4,
      SAND: 5
    };
    
    // Block colors based on type
    this.blockColors = [
      [0.0, 0.0, 0.0, 0.0],         // AIR (transparent)
      [0.4, 0.8, 0.2, 1.0],         // GRASS
      [0.6, 0.3, 0.1, 1.0],         // DIRT
      [0.5, 0.5, 0.5, 1.0],         // STONE
      [0.0, 0.0, 0.8, 0.6],         // WATER
      [0.8, 0.8, 0.2, 1.0]          // SAND
    ];
    
    // Slight color variations for different faces
    this.faceShading = [
      1.0,     // Top face (brightest)
      0.8,     // Front face 
      0.8,     // Right face
      0.6,     // Back face (darkest)
      0.6,     // Left face
      0.5      // Bottom face
    ];
    
    // Initialize with some test terrain
    this.generateTerrain();
  }
  
  // Get block at x,y,z position
  getBlock(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.size || y >= this.size || z >= this.size) {
      return this.blockTypes.AIR; // Air outside chunk boundaries
    }
    const index = x + (y * this.size) + (z * this.size * this.size);
    return this.blocks[index];
  }
  
  // Set block at x,y,z position
  setBlock(x, y, z, blockType) {
    if (x < 0 || y < 0 || z < 0 || x >= this.size || y >= this.size || z >= this.size) {
      return; // Out of bounds
    }
    const index = x + (y * this.size) + (z * this.size * this.size);
    this.blocks[index] = blockType;
  }
  
  // Generate simple test terrain
  generateTerrain() {
    // Fill with air first
    this.blocks.fill(this.blockTypes.AIR);
    
    // Create a basic heightmap
    const heightMap = [];
    for (let x = 0; x < this.size; x++) {
      heightMap[x] = [];
      for (let z = 0; z < this.size; z++) {
        // Generate a simple heightmap (can be changed to perlin noise for better terrain)
        const height = Math.floor(Math.sin(x/3) * 2 + Math.cos(z/3) * 2) + Math.floor(this.size/2);
        heightMap[x][z] = Math.max(1, Math.min(this.size-1, height));
      }
    }
    
    // Set blocks based on the heightmap
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const height = heightMap[x][z];
        
        // Fill below height with different blocks
        for (let y = 0; y < height; y++) {
          if (y === height - 1) {
            // Top layer is grass
            this.setBlock(x, y, z, this.blockTypes.GRASS);
          } else if (y > height - 4) {
            // Next 3 layers are dirt
            this.setBlock(x, y, z, this.blockTypes.DIRT);
          } else {
            // Below that is stone
            this.setBlock(x, y, z, this.blockTypes.STONE);
          }
        }
        
        // Add some water
        if (height < this.size/2 - 2) {
          for (let y = height; y < this.size/2 - 2; y++) {
            this.setBlock(x, y, z, this.blockTypes.WATER);
          }
        }
      }
    }
    
    // Add some caves
    for (let i = 0; i < 10; i++) {
      const caveX = Math.floor(Math.random() * this.size);
      const caveY = Math.floor(Math.random() * (this.size/2));
      const caveZ = Math.floor(Math.random() * this.size);
      const caveSize = Math.floor(Math.random() * 3) + 2;
      
      // Carve out a sphere
      for (let x = -caveSize; x <= caveSize; x++) {
        for (let y = -caveSize; y <= caveSize; y++) {
          for (let z = -caveSize; z <= caveSize; z++) {
            if (x*x + y*y + z*z <= caveSize*caveSize) {
              const bx = caveX + x;
              const by = caveY + y;
              const bz = caveZ + z;
              if (bx >= 0 && by >= 0 && bz >= 0 && bx < this.size && by < this.size && bz < this.size) {
                this.setBlock(bx, by, bz, this.blockTypes.AIR);
              }
            }
          }
        }
      }
    }
  }
  
  // Build the optimized mesh (only visible faces)
  buildMesh() {
    const positions = [];
    const colors = [];
    const indices = [];
    let vertexCount = 0;
    
    // Faces: top, front, right, back, left, bottom
    // Each face direction as [x, y, z]
    const faceDirections = [
      [0, 1, 0],   // top
      [0, 0, 1],   // front
      [1, 0, 0],   // right
      [0, 0, -1],  // back
      [-1, 0, 0],  // left
      [0, -1, 0]   // bottom
    ];
    
    // Loop through every block in the chunk
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        for (let z = 0; z < this.size; z++) {
          const blockType = this.getBlock(x, y, z);
          
          // Skip air blocks
          if (blockType === this.blockTypes.AIR) {
            continue;
          }
          
          // Check each face of the block
          for (let face = 0; face < 6; face++) {
            const dir = faceDirections[face];
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];
            
            // If adjacent block is air or transparent, add this face
            const neighbor = this.getBlock(nx, ny, nz);
            if (neighbor === this.blockTypes.AIR || (neighbor === this.blockTypes.WATER && blockType !== this.blockTypes.WATER)) {
              // Add face vertices
              // Get base color for this block type and apply face shading
              const baseColor = this.blockColors[blockType];
              const shade = this.faceShading[face];
              
              // Apply the vertex positions and colors for this face
              this.addBlockFace(positions, colors, indices, x, y, z, face, baseColor, shade, vertexCount);
              vertexCount += 4; // 4 vertices per face
            }
          }
        }
      }
    }
    
    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices)
    };
  }
  
  // Add a single block face to the mesh data
  addBlockFace(positions, colors, indices, x, y, z, face, baseColor, shade, vertexOffset) {
    // Adjust position to be in world space
    const worldX = x - this.size / 2;
    const worldY = y - this.size / 2;
    const worldZ = z - this.size / 2;
    
    // Vertex positions for each face
    // Each face has 4 vertices in counter-clockwise order
    let faceVertices;
    
    switch (face) {
      case 0: // top face
        faceVertices = [
          [worldX, worldY + 1, worldZ],
          [worldX + 1, worldY + 1, worldZ],
          [worldX + 1, worldY + 1, worldZ + 1],
          [worldX, worldY + 1, worldZ + 1]
        ];
        break;
        
      case 1: // front face
        faceVertices = [
          [worldX, worldY, worldZ + 1],
          [worldX + 1, worldY, worldZ + 1],
          [worldX + 1, worldY + 1, worldZ + 1],
          [worldX, worldY + 1, worldZ + 1]
        ];
        break;
        
      case 2: // right face
        faceVertices = [
          [worldX + 1, worldY, worldZ],
          [worldX + 1, worldY, worldZ + 1],
          [worldX + 1, worldY + 1, worldZ + 1],
          [worldX + 1, worldY + 1, worldZ]
        ];
        break;
        
      case 3: // back face
        faceVertices = [
          [worldX + 1, worldY, worldZ],
          [worldX, worldY, worldZ],
          [worldX, worldY + 1, worldZ],
          [worldX + 1, worldY + 1, worldZ]
        ];
        break;
        
      case 4: // left face
        faceVertices = [
          [worldX, worldY, worldZ],
          [worldX, worldY, worldZ + 1],
          [worldX, worldY + 1, worldZ + 1],
          [worldX, worldY + 1, worldZ]
        ];
        break;
        
      case 5: // bottom face
        faceVertices = [
          [worldX, worldY, worldZ],
          [worldX + 1, worldY, worldZ],
          [worldX + 1, worldY, worldZ + 1],
          [worldX, worldY, worldZ + 1]
        ];
        break;
    }
    
    // Add the vertices to the position array
    for (let i = 0; i < 4; i++) {
      positions.push(faceVertices[i][0], faceVertices[i][1], faceVertices[i][2]);
      
      // Apply shading to the color based on which face
      colors.push(
        baseColor[0] * shade,
        baseColor[1] * shade,
        baseColor[2] * shade,
        baseColor[3]
      );
    }
    
    // Add the face indices (two triangles make a face)
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3
    );
  }
}

// Update the Renderer class to render the chunk
class ChunkRenderer extends Renderer {
  constructor(canvas) {
    super(canvas);
    this.chunk = new Chunk(16); // Create a 16x16x16 chunk
    this.initChunkBuffers();
    
    // Move camera back further to see the whole chunk
    this.camera.position = [0.0, 0.0, 30.0];
  }
  
  initChunkBuffers() {
    // Generate the optimized mesh
    const mesh = this.chunk.buildMesh();
    
    // Create position buffer
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.positions, this.gl.STATIC_DRAW);
    
    // Create color buffer
    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.colors, this.gl.STATIC_DRAW);
    
    // Create index buffer
    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, mesh.indices, this.gl.STATIC_DRAW);
    
    // Store buffers and index count
    this.chunkBuffers = {
      position: positionBuffer,
      color: colorBuffer,
      indices: indexBuffer,
      indexCount: mesh.indices.length
    };
  }
  
  render(currentTime) {
    currentTime *= 0.001;  // Convert to seconds
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Update camera based on keyboard and mouse inputs
    this.camera.update(deltaTime);
    
    this.resize();
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Create perspective matrix
    const fieldOfView = 45 * Math.PI / 180;
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    
    // Get the camera view matrix
    const viewMatrix = this.camera.getViewMatrix();
    
    // Set up model matrix for chunk
    const modelMatrix = mat4.create();
    // Chunk is already centered around origin
    // Just add a slow rotation for demo purposes
    mat4.rotate(modelMatrix, modelMatrix, currentTime * 0.1, [0, 1, 0]);
    
    // Combine model and view matrices
    const modelViewMatrix = mat4.create();
    // Start with view matrix
    for (let i = 0; i < 16; i++) {
      modelViewMatrix[i] = viewMatrix[i];
    }
    // Apply model transformations
    mat4.rotate(modelViewMatrix, modelViewMatrix, currentTime * 0.1, [0, 1, 0]);
    
    // Set vertex position
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.chunkBuffers.position);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexPosition,
      3,        // 3 components per vertex
      this.gl.FLOAT,
      false,
      0,
      0);
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
    
    // Set vertex color
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.chunkBuffers.color);
    this.gl.vertexAttribPointer(
      this.programInfo.attribLocations.vertexColor,
      4,        // 4 components per color
      this.gl.FLOAT,
      false,
      0,
      0);
    this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);
    
    // Bind indices
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.chunkBuffers.indices);
    
    // Use our shader program
    this.gl.useProgram(this.programInfo.program);
    
    // Set the uniforms
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);
    
    // Draw the chunk
    this.gl.drawElements(this.gl.TRIANGLES, this.chunkBuffers.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }
}