class Camera {
  constructor(canvas) {
    // Camera position and orientation
    this.position = [0.0, 10.0, 0.0]; // Start on top of the chunk
    this.front = [0.0, 0.0, -1.0];
    this.up = [0.0, 1.0, 0.0];
    this.right = [1.0, 0.0, 0.0];
    this.worldUp = [0.0, 1.0, 0.0];
    
    // Euler angles
    this.yaw = -90.0;   // Initial direction: looking down negative z-axis
    this.pitch = -15.0; // Look slightly downward
    
    // Camera options
    this.movementSpeed = 8.0; // Faster movement
    this.mouseSensitivity = 0.1;
    
    // For smooth movement
    this.movementSmoothing = 0.8; // 0 = no smoothing, 1 = infinite smoothing
    this.velocity = [0.0, 0.0, 0.0];
    
    // Key states
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false, // For up movement
      shift: false  // For down movement
    };
    
    // Mouse control
    this.lastX = canvas.width / 2;
    this.lastY = canvas.height / 2;
    this.firstMouse = true;
    
    // Bind event handlers
    this.setupEventHandlers(canvas);
    
    // Initialize the camera vectors
    this.updateCameraVectors();
  }
  
  setupEventHandlers(canvas) {
    // Keyboard event handlers
    document.addEventListener('keydown', (e) => {
      // Using e.code which is more reliable for physical key positions
      switch(e.code) {
        case 'KeyW':
          this.keys.w = true;
          break;
        case 'KeyA':
          this.keys.a = true;
          break;
        case 'KeyS':
          this.keys.s = true;
          break;
        case 'KeyD':
          this.keys.d = true;
          break;
        case 'Space': // Space key
          this.keys.space = true;
          break;
        case 'ShiftLeft': // Left Shift key
        case 'ShiftRight': // Right Shift key
          this.keys.shift = true;
          break;
      }
    });
    
    document.addEventListener('keyup', (e) => {
      // Using e.code which is more reliable for physical key positions
      switch(e.code) {
        case 'KeyW':
          this.keys.w = false;
          break;
        case 'KeyA':
          this.keys.a = false;
          break;
        case 'KeyS':
          this.keys.s = false;
          break;
        case 'KeyD':
          this.keys.d = false;
          break;
        case 'Space': // Space key
          this.keys.space = false;
          break;
        case 'ShiftLeft': // Left Shift key
        case 'ShiftRight': // Right Shift key
          this.keys.shift = false;
          break;
      }
    });
    
    // Mouse event handlers
    canvas.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        const xOffset = e.movementX * this.mouseSensitivity;
        // Reverse Y direction so moving mouse up rotates camera to look up
        const yOffset = -e.movementY * this.mouseSensitivity;
        
        this.yaw += xOffset;
        this.pitch += yOffset;
        
        // Constrain pitch to avoid camera flipping
        if (this.pitch > 89.0) this.pitch = 89.0;
        if (this.pitch < -89.0) this.pitch = -89.0;
        
        this.updateCameraVectors();
      }
    });
    
    // Click to capture mouse
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });
    
    // Instructions overlay
    const instructions = document.createElement('div');
    instructions.style.position = 'absolute';
    instructions.style.top = '10px';
    instructions.style.left = '10px';
    instructions.style.color = 'white';
    instructions.style.fontSize = '14px';
    instructions.style.fontFamily = 'Arial, sans-serif';
    instructions.style.padding = '5px';
    instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    instructions.innerHTML = 'Click to capture mouse.<br>' + 
                           'WASD: Move horizontally<br>' +
                           'SPACE: Move up<br>' + 
                           'SHIFT: Move down<br>' +
                           'Mouse: Look around<br>' +
                           'ESC: Release mouse';
    document.body.appendChild(instructions);
    
    // Hide instructions when pointer is locked
    document.addEventListener('pointerlockchange', () => {
      instructions.style.display = document.pointerLockElement === canvas ? 'none' : 'block';
    });
  }
  
  updateCameraVectors() {
    // Calculate the front vector from the Camera's Euler Angles
    this.front[0] = Math.cos(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180);
    this.front[1] = Math.sin(this.pitch * Math.PI / 180);
    this.front[2] = Math.sin(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180);
    
    // Normalize the vectors
    vec3.normalize(this.front, this.front);
    
    // Re-calculate the Right and Up vector
    vec3.cross(this.right, this.front, this.worldUp);
    vec3.normalize(this.right, this.right);
    
    vec3.cross(this.up, this.right, this.front);
    vec3.normalize(this.up, this.up);
  }
  
  update(deltaTime) {
    const speed = this.movementSpeed * deltaTime;
    const smoothing = this.movementSmoothing;
    
    // Target velocity based on inputs
    const targetVelocity = [0, 0, 0];
    
    // Forward/backward
    if (this.keys.w) {
      targetVelocity[0] += this.front[0] * speed;
      // Remove Y component to keep movement horizontal
      targetVelocity[2] += this.front[2] * speed;
    }
    if (this.keys.s) {
      targetVelocity[0] -= this.front[0] * speed;
      // Remove Y component to keep movement horizontal
      targetVelocity[2] -= this.front[2] * speed;
    }
    
    // Strafe left/right
    if (this.keys.a) {
      targetVelocity[0] -= this.right[0] * speed;
      targetVelocity[2] -= this.right[2] * speed;
    }
    if (this.keys.d) {
      targetVelocity[0] += this.right[0] * speed;
      targetVelocity[2] += this.right[2] * speed;
    }
    
    // Up/down movement using space and shift
    if (this.keys.space) {
      targetVelocity[1] += speed; // Move up
    }
    if (this.keys.shift) {
      targetVelocity[1] -= speed; // Move down
    }
    
    // Apply smoothing to velocity
    this.velocity[0] = this.velocity[0] * smoothing + targetVelocity[0] * (1 - smoothing);
    this.velocity[1] = this.velocity[1] * smoothing + targetVelocity[1] * (1 - smoothing);
    this.velocity[2] = this.velocity[2] * smoothing + targetVelocity[2] * (1 - smoothing);
    
    // Apply velocity to position
    this.position[0] += this.velocity[0];
    this.position[1] += this.velocity[1];
    this.position[2] += this.velocity[2];
    
    // No gravity effect - we want to be able to fly
  }
  
  getViewMatrix() {
    // Calculate the camera's view matrix
    const target = vec3.create();
    vec3.add(target, this.position, this.front);
    
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, this.position, target, this.up);
    
    return viewMatrix;
  }
}