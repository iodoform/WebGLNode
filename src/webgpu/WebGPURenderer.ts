export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  
  private startTime: number = performance.now();
  private mouseX: number = 0.5;
  private mouseY: number = 0.5;
  private animationId: number = 0;
  private isRunning: boolean = false;
  
  private currentShaderCode: string = '';
  private onError?: (error: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupMouseTracking();
  }

  private setupMouseTracking(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
    });
  }

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU is not supported');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error('No GPU adapter found');
      return false;
    }

    this.device = await adapter.requestDevice();
    
    const context = this.canvas.getContext('webgpu');
    if (!context) {
      console.error('Could not get WebGPU context');
      return false;
    }
    this.context = context;

    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format,
      alphaMode: 'premultiplied',
    });

    // Create uniform buffer (24 bytes for proper alignment)
    this.uniformBuffer = this.device.createBuffer({
      size: 24,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    return true;
  }

  setErrorCallback(callback: (error: string) => void): void {
    this.onError = callback;
  }

  updateShader(shaderCode: string): boolean {
    if (shaderCode === this.currentShaderCode) {
      return true;
    }

    try {
      const shaderModule = this.device.createShaderModule({
        code: shaderCode,
      });

      // Check for compilation errors
      shaderModule.getCompilationInfo().then(info => {
        for (const message of info.messages) {
          if (message.type === 'error') {
            console.error('Shader error:', message.message);
            this.onError?.(message.message);
          }
        }
      });

      const format = navigator.gpu.getPreferredCanvasFormat();

      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        }],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fragmentMain',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      this.uniformBindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        }],
      });

      this.currentShaderCode = shaderCode;
      return true;
    } catch (error) {
      console.error('Failed to compile shader:', error);
      this.onError?.(String(error));
      return false;
    }
  }

  private render = (): void => {
    if (!this.isRunning) return;

    const time = (performance.now() - this.startTime) / 1000;
    
    // Update uniforms - WGSL struct alignment:
    // struct Uniforms {
    //   time: f32,        // offset 0, size 4
    //   resolution: vec2f,  // offset 8 (vec2f needs 8-byte alignment), size 8
    //   mouse: vec2f,     // offset 16, size 8
    // }
    // Total: 24 bytes
    const uniformData = new Float32Array([
      time, 0,  // time (4 bytes) + padding (4 bytes for vec2f alignment)
      this.canvas.width, this.canvas.height,  // resolution (8 bytes)
      this.mouseX, this.mouseY,  // mouse (8 bytes)
    ]);
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const commandEncoder = this.device.createCommandEncoder();
    
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    if (this.pipeline) {
      renderPass.setPipeline(this.pipeline);
      renderPass.setBindGroup(0, this.uniformBindGroup);
      renderPass.draw(6);
    }

    renderPass.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
    
    this.animationId = requestAnimationFrame(this.render);
  };

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.render();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getTime(): number {
    return (performance.now() - this.startTime) / 1000;
  }

  resetTime(): void {
    this.startTime = performance.now();
  }
}

