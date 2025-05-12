// Enhanced Chunk class with better terrain generation
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
    
    // Fill with air by default
    this.blocks.fill(this.blockTypes.AIR);
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
  
  // Generate simple perlin noise (simplified version)
  noise(x, y, z, seed) {
    // Simple hash function for pseudo-randomness
    const hash = (x + seed) * 374761393 + y * 668265263 + z * 952531579;
    const value = Math.sin(hash) * 43758.5453123;
    return value - Math.floor(value);
  }
  
  // Generate 2D noise for terrain
  noise2D(x, z, seed) {
    // Use multiple octaves for more natural terrain
    let result = 0;
    let amplitude = 1.0;
    let frequency = 0.1;
    let maxValue = 0;
    
    for (let i = 0; i < 4; i++) {
      result += this.noise(x * frequency, 0, z * frequency, seed) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return result / maxValue;
  }
  
  // Generate terrain with better algorithms, using world chunk coordinates
  generateTerrain(chunkWorldX, chunkWorldZ, seed) {
    // Fill with air first
    this.blocks.fill(this.blockTypes.AIR);
    
    // Water level
    const waterLevel = Math.floor(this.size * 0.3); // 30% up from bottom
    
    // Create a heightmap using improved noise function
    const heightMap = [];
    for (let x = 0; x < this.size; x++) {
      heightMap[x] = [];
      for (let z = 0; z < this.size; z++) {
        // Calculate world coordinates
        const worldX = chunkWorldX * this.size + x;
        const worldZ = chunkWorldZ * this.size + z;
        
        // Generate height using noise
        // Scale height to be between 0 and size
        const noise = this.noise2D(worldX * 0.02, worldZ * 0.02, seed);
        
        // Add some variety to the terrain
        let height;
        
        // Create different biomes based on noise
        const biomeFactor = this.noise2D(worldX * 0.005, worldZ * 0.005, seed + 1000);
        
        if (biomeFactor > 0.6) {
          // Mountains
          height = Math.floor(noise * this.size * 0.7 + this.size * 0.3);
        } else if (biomeFactor < 0.3) {
          // Plains
          height = Math.floor(noise * this.size * 0.2 + this.size * 0.3);
        } else {
          // Hills
          height = Math.floor(noise * this.size * 0.4 + this.size * 0.3);
        }
        
        heightMap[x][z] = Math.max(1, Math.min(this.size - 1, height));
      }
    }
    
    // Set blocks based on the heightmap
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const height = heightMap[x][z];
        
        // Fill below height with different blocks
        for (let y = 0; y < height; y++) {
          if (y === height - 1) {
            // Top layer depends on height
            if (height < waterLevel + 2) {
              // Beach/shoreline
              this.setBlock(x, y, z, this.blockTypes.SAND);
            } else {
              // Normal grass
              this.setBlock(x, y, z, this.blockTypes.GRASS);
            }
          } else if (y > height - 4) {
            // Dirt layer
            this.setBlock(x, y, z, this.blockTypes.DIRT);
          } else {
            // Stone below
            this.setBlock(x, y, z, this.blockTypes.STONE);
          }
        }
        
        // Add water up to water level
        if (height < waterLevel) {
          for (let y = height; y < waterLevel; y++) {
            this.setBlock(x, y, z, this.blockTypes.WATER);
          }
        }
      }
    }
    
    // Add caves using 3D noise
    this.generateCaves(chunkWorldX, chunkWorldZ, seed);
  }
  
  // Generate cave systems with 3D noise
  generateCaves(chunkWorldX, chunkWorldZ, seed) {
    // Sample resolution (for performance)
    const resolution = 4;
    
    for (let x = 0; x < this.size; x += resolution) {
      for (let y = 0; y < this.size; y += resolution) {
        for (let z = 0; z < this.size; z += resolution) {
          // Skip near the top of the terrain
          if (y > this.size * 0.7) continue;
          
          // Calculate world coordinates
          const worldX = chunkWorldX * this.size + x;
          const worldY = y;
          const worldZ = chunkWorldZ * this.size + z;
          
          // Generate 3D noise
          const caveNoise = this.noise(worldX * 0.08, worldY * 0.08, worldZ * 0.08, seed + 500);
          
          // If noise value is above threshold, create a cave
          if (caveNoise > 0.7) {
            // Create a cave area
            const caveSize = Math.floor(resolution * 0.8);
            
            for (let cx = 0; cx < resolution; cx++) {
              for (let cy = 0; cy < resolution; cy++) {
                for (let cz = 0; cz < resolution; cz++) {
                  const bx = x + cx;
                  const by = y + cy;
                  const bz = z + cz;
                  
                  // Make sure we're within bounds
                  if (bx < 0 || by < 0 || bz < 0 || bx >= this.size || by >= this.size || bz >= this.size) {
                    continue;
                  }
                  
                  // Don't create caves in water or air
                  const currentBlock = this.getBlock(bx, by, bz);
                  if (currentBlock === this.blockTypes.AIR || currentBlock === this.blockTypes.WATER) {
                    continue;
                  }
                  
                  this.setBlock(bx, by, bz, this.blockTypes.AIR);
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Build mesh (only visible faces) - no changes needed from original
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
    // Block positions are local to the chunk, no need to offset by chunk size/2 anymore
    const worldX = x;
    const worldY = y;
    const worldZ = z;
    
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