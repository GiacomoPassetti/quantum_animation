import type { RenderSettings } from '../types';

export class QuantumRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly extractProgram: WebGLProgram;
  private readonly blurProgram: WebGLProgram;
  private readonly compositeProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly densityTexture: WebGLTexture;
  private readonly bloomTextureA: WebGLTexture;
  private readonly bloomTextureB: WebGLTexture;
  private readonly bloomFramebufferA: WebGLFramebuffer;
  private readonly bloomFramebufferB: WebGLFramebuffer;
  private readonly dimensions: { densityWidth: number; densityHeight: number; bloomWidth: number; bloomHeight: number };
  private readonly floatLinearSupported: boolean;
  private readonly extractUniforms: {
    density: WebGLUniformLocation;
    colormap: WebGLUniformLocation;
  };
  private readonly blurUniforms: {
    source: WebGLUniformLocation;
    texel: WebGLUniformLocation;
    direction: WebGLUniformLocation;
  };
  private readonly compositeUniforms: {
    density: WebGLUniformLocation;
    bloom: WebGLUniformLocation;
    colormap: WebGLUniformLocation;
    glow: WebGLUniformLocation;
    alpha: WebGLUniformLocation;
  };

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this.dimensions = {
      densityWidth: width,
      densityHeight: height,
      bloomWidth: Math.max(1, Math.floor(width / 2)),
      bloomHeight: Math.max(1, Math.floor(height / 2)),
    };
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is required for rendering.');
    }
    this.gl = gl;
    // Required for LINEAR filtering on R32F textures; fall back to NEAREST if unavailable
    this.floatLinearSupported = !!gl.getExtension('OES_texture_float_linear');
    this.extractProgram = createProgram(gl, vertexShaderSource, extractFragmentShaderSource);
    this.blurProgram = createProgram(gl, vertexShaderSource, blurFragmentShaderSource);
    this.compositeProgram = createProgram(gl, vertexShaderSource, compositeFragmentShaderSource);
    this.vao = createScreenQuad(gl);
    this.densityTexture = createDensityTexture(gl, this.dimensions.densityWidth, this.dimensions.densityHeight, this.floatLinearSupported);
    this.bloomTextureA = createColorTexture(gl, this.dimensions.bloomWidth, this.dimensions.bloomHeight);
    this.bloomTextureB = createColorTexture(gl, this.dimensions.bloomWidth, this.dimensions.bloomHeight);
    this.bloomFramebufferA = createFramebuffer(gl, this.bloomTextureA);
    this.bloomFramebufferB = createFramebuffer(gl, this.bloomTextureB);

    this.extractUniforms = {
      density: requireUniform(gl, this.extractProgram, 'u_density'),
      colormap: requireUniform(gl, this.extractProgram, 'u_colormap'),
    };
    this.blurUniforms = {
      source: requireUniform(gl, this.blurProgram, 'u_source'),
      texel: requireUniform(gl, this.blurProgram, 'u_texel'),
      direction: requireUniform(gl, this.blurProgram, 'u_direction'),
    };
    this.compositeUniforms = {
      density: requireUniform(gl, this.compositeProgram, 'u_density'),
      bloom: requireUniform(gl, this.compositeProgram, 'u_bloom'),
      colormap: requireUniform(gl, this.compositeProgram, 'u_colormap'),
      glow: requireUniform(gl, this.compositeProgram, 'u_glow'),
      alpha: requireUniform(gl, this.compositeProgram, 'u_alpha'),
    };

    this.resize();
  }

  resize(): void {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(density: Float32Array, settings: RenderSettings): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.dimensions.densityWidth,
      this.dimensions.densityHeight,
      gl.RED,
      gl.FLOAT,
      density,
    );

    this.renderBloomExtract(settings.colormap);
    this.renderBloomBlur();
    this.renderComposite(settings);
  }

  private renderBloomExtract(colormap: RenderSettings['colormap']): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFramebufferA);
    gl.viewport(0, 0, this.dimensions.bloomWidth, this.dimensions.bloomHeight);
    gl.useProgram(this.extractProgram);
    gl.uniform1i(this.extractUniforms.density, 0);
    gl.uniform1i(this.extractUniforms.colormap, colormapToIndex(colormap));
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderBloomBlur(): void {
    const gl = this.gl;
    gl.useProgram(this.blurProgram);
    gl.uniform1i(this.blurUniforms.source, 0);
    gl.uniform2f(this.blurUniforms.texel, 1 / this.dimensions.bloomWidth, 1 / this.dimensions.bloomHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFramebufferB);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTextureA);
    gl.viewport(0, 0, this.dimensions.bloomWidth, this.dimensions.bloomHeight);
    gl.uniform2f(this.blurUniforms.direction, 1, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFramebufferA);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTextureB);
    gl.uniform2f(this.blurUniforms.direction, 0, 1);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderComposite(settings: RenderSettings): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compositeProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTextureA);

    gl.uniform1i(this.compositeUniforms.density, 0);
    gl.uniform1i(this.compositeUniforms.bloom, 1);
    gl.uniform1i(this.compositeUniforms.colormap, colormapToIndex(settings.colormap));
    gl.uniform1f(this.compositeUniforms.glow, settings.glow);
    gl.uniform1f(this.compositeUniforms.alpha, settings.alpha);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function colormapToIndex(colormap: RenderSettings['colormap']): number {
  switch (colormap) {
    case 'plasma':
      return 1;
    case 'viridis':
      return 2;
    case 'ember':
    default:
      return 0;
  }
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create WebGL program.');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Failed to link program: ${info ?? 'Unknown error'}`);
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw new Error(`Shader compilation failed: ${info ?? 'Unknown error'}`);
  }
  return shader;
}

function createScreenQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) {
    throw new Error('Failed to create buffers for fullscreen quad.');
  }

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function createDensityTexture(gl: WebGL2RenderingContext, width: number, height: number, linearSupported: boolean): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create density texture.');
  }
  const filter = linearSupported ? gl.LINEAR : gl.NEAREST;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
  return texture;
}

function createColorTexture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create bloom texture.');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return texture;
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture): WebGLFramebuffer {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error('Failed to create framebuffer.');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer setup is incomplete.');
  }
  return framebuffer;
}

function requireUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Uniform ${name} is missing.`);
  }
  return location;
}

const vertexShaderSource = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const colormapShader = `
vec3 ember(float t) {
  vec3 low = vec3(0.24, 0.04, 0.01);
  vec3 mid = vec3(0.94, 0.32, 0.07);
  vec3 high = vec3(1.0, 0.78, 0.35);
  return t < 0.6 ? mix(low, mid, t / 0.6) : mix(mid, high, (t - 0.6) / 0.4);
}

vec3 plasma(float t) {
  vec3 low = vec3(0.08, 0.02, 0.37);
  vec3 mid = vec3(0.75, 0.19, 0.61);
  vec3 high = vec3(0.98, 0.84, 0.17);
  return t < 0.55 ? mix(low, mid, t / 0.55) : mix(mid, high, (t - 0.55) / 0.45);
}

vec3 viridis(float t) {
  vec3 low = vec3(0.16, 0.01, 0.33);
  vec3 mid = vec3(0.13, 0.56, 0.55);
  vec3 high = vec3(0.99, 0.90, 0.14);
  return t < 0.52 ? mix(low, mid, t / 0.52) : mix(mid, high, (t - 0.52) / 0.48);
}

vec3 mapColor(float t, int colormap) {
  if (colormap == 1) {
    return plasma(t);
  }
  if (colormap == 2) {
    return viridis(t);
  }
  return ember(t);
}
`;

const extractFragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_density;
uniform int u_colormap;

${colormapShader}

void main() {
  float density = texture(u_density, v_uv).r;
  float tone = pow(clamp(density, 0.0, 1.0), 0.45);
  vec3 color = mapColor(tone, u_colormap);
  float threshold = smoothstep(0.06, 1.0, density);
  outColor = vec4(color * threshold * density, 1.0);
}
`;

const blurFragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_source;
uniform vec2 u_texel;
uniform vec2 u_direction;

void main() {
  vec2 axis = u_direction * u_texel;
  vec3 color = texture(u_source, v_uv).rgb * 0.227027;
  color += texture(u_source, v_uv + axis * 1.384615).rgb * 0.316216;
  color += texture(u_source, v_uv - axis * 1.384615).rgb * 0.316216;
  color += texture(u_source, v_uv + axis * 3.230769).rgb * 0.070270;
  color += texture(u_source, v_uv - axis * 3.230769).rgb * 0.070270;
  outColor = vec4(color, 1.0);
}
`;

const compositeFragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_density;
uniform sampler2D u_bloom;
uniform int u_colormap;
uniform float u_glow;
uniform float u_alpha;

${colormapShader}

void main() {
  float density = texture(u_density, v_uv).r;
  float tone = pow(clamp(density, 0.0, 1.0), 0.45);
  vec3 baseColor = mapColor(tone, u_colormap);
  float baseAlpha = clamp(density * u_alpha, 0.0, 1.0);
  vec3 bloom = texture(u_bloom, v_uv).rgb * u_glow;
  vec3 color = baseColor * baseAlpha + bloom;
  outColor = vec4(color, 1.0);
}
`;
