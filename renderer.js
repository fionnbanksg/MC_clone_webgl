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
    
    // Set clear color to black
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    
    // Set up camera
    this.camera = new Camera(canvas);
    
    // Set up animation
    this.cubeRotation = 0.0;
    this.lastFrameTime = 0;
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
    
    // Store buffers
    this.buffers = {
      position: positionBuffer,
      color: colorBuffer,
      indices: indexBuffer,
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
    
    // Set up model matrix for cube
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [0.0, 0.0, 0.0]);
    mat4.rotate(modelMatrix, modelMatrix, this.cubeRotation, [0, 1, 0]);
    mat4.rotate(modelMatrix, modelMatrix, this.cubeRotation * 0.7, [1, 0, 0]);
    
    // Combine model and view matrices
    const modelViewMatrix = mat4.create();
    // Multiply view matrix with model matrix
    for (let i = 0; i < 16; i++) {
      modelViewMatrix[i] = viewMatrix[i];
    }
    mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, 0.0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, this.cubeRotation, [0, 1, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, this.cubeRotation * 0.7, [1, 0, 0]);
    
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
    
    // Set the uniforms
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);
    
    // Draw the cube
    this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_SHORT, 0);
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