class Camera {
  constructor(canvas) {
    // Camera position and orientation
    this.position = [0.0, 0.0, 6.0];
    this.front = [0.0, 0.0, -1.0];
    this.up = [0.0, 1.0, 0.0];
    this.right = [1.0, 0.0, 0.0];
    this.worldUp = [0.0, 1.0, 0.0];
    
    // Euler angles
    this.yaw = -90.0;   // Initial direction: looking down negative z-axis
    this.pitch = 0.0;
    
    // Camera options
    this.movementSpeed = 5.0;
    this.mouseSensitivity = 0.1;
    
    // Key states
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false
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
      switch(e.key.toLowerCase()) {
        case 'w':
          this.keys.w = true;
          break;
        case 'a':
          this.keys.a = true;
          break;
        case 's':
          this.keys.s = true;
          break;
        case 'd':
          this.keys.d = true;
          break;
      }
    });
    
    document.addEventListener('keyup', (e) => {
      switch(e.key.toLowerCase()) {
        case 'w':
          this.keys.w = false;
          break;
        case 'a':
          this.keys.a = false;
          break;
        case 's':
          this.keys.s = false;
          break;
        case 'd':
          this.keys.d = false;
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
    instructions.textContent = 'Click to capture mouse. Use WASD to move and mouse to look around.';
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
    const velocity = this.movementSpeed * deltaTime;
    
    // Forward/backward
    if (this.keys.w) {
      this.position[0] += this.front[0] * velocity;
      this.position[1] += this.front[1] * velocity;
      this.position[2] += this.front[2] * velocity;
    }
    if (this.keys.s) {
      this.position[0] -= this.front[0] * velocity;
      this.position[1] -= this.front[1] * velocity;
      this.position[2] -= this.front[2] * velocity;
    }
    
    // Strafe left/right
    if (this.keys.a) {
      this.position[0] -= this.right[0] * velocity;
      this.position[1] -= this.right[1] * velocity;
      this.position[2] -= this.right[2] * velocity;
    }
    if (this.keys.d) {
      this.position[0] += this.right[0] * velocity;
      this.position[1] += this.right[1] * velocity;
      this.position[2] += this.right[2] * velocity;
    }
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