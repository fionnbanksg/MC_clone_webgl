// world.js - Handles multiple chunks in a Minecraft-style world

class World {
  constructor(gl, renderDistance = 3) {
    this.gl = gl;
    this.chunks = new Map(); // Map of chunk coordinates to chunk objects
    this.chunkSize = 16;
    this.renderDistance = renderDistance; // Number of chunks in each direction
    this.loadedChunks = []; // List of currently rendered chunks
    this.chunkMeshes = new Map(); // Map of chunk coordinates to mesh data
    
    // Cache of buffers for each chunk to avoid re-creating WebGL buffers
    this.chunkBuffers = new Map();
    
    // Noise parameters for more interesting terrain
    this.seed = Math.random() * 10000;
    
    // Init shader program info
    this.programInfo = null;
  }
  
  // Initialize with shader program info
  init(programInfo) {
    this.programInfo = programInfo;
    
    if (!this.programInfo) {
      console.error('Program info is not available to initialize World');
    }
  }
  
  // Get chunk key from chunk coordinates
  getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }
  
  // Generate a chunk at the given chunk coordinates
  generateChunk(chunkX, chunkZ) {
    const key = this.getChunkKey(chunkX, chunkZ);
    
    // Create a new chunk if one doesn't exist
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(this.chunkSize);
      
      // Use world position to influence terrain generation
      chunk.generateTerrain(chunkX, chunkZ, this.seed);
      
      this.chunks.set(key, chunk);
      return chunk;
    }
    
    return this.chunks.get(key);
  }
  
  // Update chunks based on camera position
  updateChunks(cameraPosition) {
    if (!this.programInfo) {
      console.error('Cannot update chunks: programInfo is not initialized');
      return;
    }

    // Convert camera position to chunk coordinates
    const centerChunkX = Math.floor(cameraPosition[0] / this.chunkSize);
    const centerChunkZ = Math.floor(cameraPosition[2] / this.chunkSize);
    
    // Track which chunks should be visible
    const visibleChunkKeys = new Set();
    
    // Generate chunks within render distance
    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
        const chunkX = centerChunkX + x;
        const chunkZ = centerChunkZ + z;
        const key = this.getChunkKey(chunkX, chunkZ);
        
        // Skip chunks that are too far (use circular render distance)
        const distSq = x * x + z * z;
        if (distSq > this.renderDistance * this.renderDistance) {
          continue;
        }
        
        visibleChunkKeys.add(key);
        
        // Generate the chunk if it doesn't exist
        if (!this.chunks.has(key)) {
          this.generateChunk(chunkX, chunkZ);
        }
        
        // Build the mesh if needed
        if (!this.chunkMeshes.has(key)) {
          const chunk = this.chunks.get(key);
          const mesh = chunk.buildMesh();
          this.chunkMeshes.set(key, mesh);
          this.createChunkBuffers(key, mesh);
        }
      }
    }
    
    // Update the list of chunks that should be rendered
    this.loadedChunks = Array.from(visibleChunkKeys).map(key => {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      return { chunkX, chunkZ, key };
    });
    
    // Clean up chunks that are too far away (memory management)
    const chunksToRemove = [];
    for (const key of this.chunks.keys()) {
      if (!visibleChunkKeys.has(key)) {
        chunksToRemove.push(key);
      }
    }
    
    // Remove chunks, meshes, and buffers that are no longer visible
    for (const key of chunksToRemove) {
      this.chunks.delete(key);
      this.chunkMeshes.delete(key);
      
      // Delete WebGL buffers to free GPU memory
      if (this.chunkBuffers.has(key)) {
        const buffers = this.chunkBuffers.get(key);
        this.gl.deleteBuffer(buffers.position);
        this.gl.deleteBuffer(buffers.color);
        this.gl.deleteBuffer(buffers.indices);
        this.chunkBuffers.delete(key);
      }
    }
  }
  
  // Create WebGL buffers for a chunk
  createChunkBuffers(chunkKey, mesh) {
    if (!this.programInfo) {
      console.error('Cannot create chunk buffers: programInfo is not initialized');
      return;
    }

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
    this.chunkBuffers.set(chunkKey, {
      position: positionBuffer,
      color: colorBuffer,
      indices: indexBuffer,
      indexCount: mesh.indices.length
    });
  }
  
  // Render all visible chunks
  render(viewMatrix, projectionMatrix) {
    if (!this.programInfo) {
      console.error('Cannot render: programInfo is not initialized');
      return;
    }
    
    // Use our shader program
    this.gl.useProgram(this.programInfo.program);
    
    // Loop through all loaded chunks and render them
    for (const chunk of this.loadedChunks) {
      const { chunkX, chunkZ, key } = chunk;
      
      // Skip chunks that don't have buffers
      if (!this.chunkBuffers.has(key)) {
        continue;
      }
      
      const buffers = this.chunkBuffers.get(key);
      
      // Set up model matrix for the chunk
      const modelMatrix = mat4.create();
      const worldX = chunkX * this.chunkSize;
      const worldZ = chunkZ * this.chunkSize;
      
      // Translate the chunk to its world position
      mat4.translate(modelMatrix, modelMatrix, [worldX, 0, worldZ]);
      
      // Combine model and view matrices
      const modelViewMatrix = mat4.create();
      // Start with view matrix
      for (let i = 0; i < 16; i++) {
        modelViewMatrix[i] = viewMatrix[i];
      }
      // Apply model transformations
      mat4.translate(modelViewMatrix, modelViewMatrix, [worldX, 0, worldZ]);
      
      // Set vertex position
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.position);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexPosition,
        3,        // 3 components per vertex
        this.gl.FLOAT,
        false,
        0,
        0);
      this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
      
      // Set vertex color
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.color);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexColor,
        4,        // 4 components per color
        this.gl.FLOAT,
        false,
        0,
        0);
      this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexColor);
      
      // Bind indices
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
      
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
      this.gl.drawElements(this.gl.TRIANGLES, buffers.indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
  }
  
  // Get block at a specific world position
  getBlock(x, y, z) {
    // Convert world coordinates to chunk coordinates
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    
    // Calculate block coordinates within the chunk
    const blockX = Math.floor(x) - chunkX * this.chunkSize;
    const blockY = Math.floor(y);
    const blockZ = Math.floor(z) - chunkZ * this.chunkSize;
    
    // Get the chunk
    const key = this.getChunkKey(chunkX, chunkZ);
    if (!this.chunks.has(key)) {
      return 0; // Air if chunk doesn't exist
    }
    
    const chunk = this.chunks.get(key);
    return chunk.getBlock(blockX, blockY, blockZ);
  }
  
  // Set block at a specific world position
  setBlock(x, y, z, blockType) {
    // Convert world coordinates to chunk coordinates
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    
    // Calculate block coordinates within the chunk
    const blockX = Math.floor(x) - chunkX * this.chunkSize;
    const blockY = Math.floor(y);
    const blockZ = Math.floor(z) - chunkZ * this.chunkSize;
    
    // Get the chunk, generate if it doesn't exist
    const key = this.getChunkKey(chunkX, chunkZ);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(chunkX, chunkZ);
    }
    
    // Set the block
    chunk.setBlock(blockX, blockY, blockZ, blockType);
    
    // Update the mesh and buffers
    const mesh = chunk.buildMesh();
    this.chunkMeshes.set(key, mesh);
    
    // Delete old buffers if they exist
    if (this.chunkBuffers.has(key)) {
      const buffers = this.chunkBuffers.get(key);
      this.gl.deleteBuffer(buffers.position);
      this.gl.deleteBuffer(buffers.color);
      this.gl.deleteBuffer(buffers.indices);
    }
    
    // Create new buffers
    this.createChunkBuffers(key, mesh);
    
    // Also update neighboring chunks if the block is on the edge
    this.updateNeighboringChunks(chunkX, chunkZ, blockX, blockZ);
  }
  
  // Update neighboring chunks when a block on the edge is changed
  updateNeighboringChunks(chunkX, chunkZ, blockX, blockZ) {
    // Check if block is on the edge of the chunk
    const onXMinEdge = blockX === 0;
    const onXMaxEdge = blockX === this.chunkSize - 1;
    const onZMinEdge = blockZ === 0;
    const onZMaxEdge = blockZ === this.chunkSize - 1;
    
    // Update neighboring chunks if necessary
    if (onXMinEdge) {
      this.updateChunkMesh(chunkX - 1, chunkZ);
    }
    if (onXMaxEdge) {
      this.updateChunkMesh(chunkX + 1, chunkZ);
    }
    if (onZMinEdge) {
      this.updateChunkMesh(chunkX, chunkZ - 1);
    }
    if (onZMaxEdge) {
      this.updateChunkMesh(chunkX, chunkZ + 1);
    }
    
    // Update diagonal chunks if block is on a corner
    if (onXMinEdge && onZMinEdge) {
      this.updateChunkMesh(chunkX - 1, chunkZ - 1);
    }
    if (onXMinEdge && onZMaxEdge) {
      this.updateChunkMesh(chunkX - 1, chunkZ + 1);
    }
    if (onXMaxEdge && onZMinEdge) {
      this.updateChunkMesh(chunkX + 1, chunkZ - 1);
    }
    if (onXMaxEdge && onZMaxEdge) {
      this.updateChunkMesh(chunkX + 1, chunkZ + 1);
    }
  }
  
  // Update a chunk's mesh and buffers
  updateChunkMesh(chunkX, chunkZ) {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.chunks.get(key);
    
    if (chunk) {
      const mesh = chunk.buildMesh();
      this.chunkMeshes.set(key, mesh);
      
      // Delete old buffers if they exist
      if (this.chunkBuffers.has(key)) {
        const buffers = this.chunkBuffers.get(key);
        this.gl.deleteBuffer(buffers.position);
        this.gl.deleteBuffer(buffers.color);
        this.gl.deleteBuffer(buffers.indices);
      }
      
      // Create new buffers
      this.createChunkBuffers(key, mesh);
    }
  }
  
  // Change render distance (number of chunks visible)
  setRenderDistance(distance) {
    this.renderDistance = Math.max(1, Math.min(distance, 10));
  }
}