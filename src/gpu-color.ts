import { LUT_SIZE } from './continuous-color';
import type { Preferences } from './types';

export class GpuColorizer {
  private surface = new OffscreenCanvas(1, 1);
  private gl = this.surface.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  private program?: WebGLProgram;
  private source?: WebGLTexture;
  private lookup?: WebGLTexture;
  private neutral?: WebGLTexture;
  private key = '';

  constructor() {
    const gl = this.gl;
    if (!gl) throw new Error('WebGL2 unavailable');
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Color shader failed');
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      void main() { vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0); }`);
    const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      precision highp sampler3D;
      uniform sampler2D source;
      uniform sampler3D lookup;
      uniform sampler2D neutral;
      uniform int mappingCount;
      uniform vec3 mappingFrom[12];
      uniform vec3 mappingTo[12];
      uniform vec3 paper;
      out vec4 color;
      void main() {
        vec4 inputColor = texelFetch(source, ivec2(gl_FragCoord.xy), 0);
        vec3 coordinate = (inputColor.rgb * ${LUT_SIZE - 1}.0 + 0.5) / ${LUT_SIZE}.0;
        vec3 mapped = texture(lookup, coordinate).rgb;
        if (max(max(inputColor.r, inputColor.g), inputColor.b) - min(min(inputColor.r, inputColor.g), inputColor.b) < 0.001) mapped = texelFetch(neutral, ivec2(int(round(inputColor.r * 255.0)), 0), 0).rgb;
        float depth = 1.0 - min(min(inputColor.r, inputColor.g), inputColor.b);
        if (depth > 0.000001) {
          vec3 ink = vec3(1.0) - (vec3(1.0) - inputColor.rgb) / depth;
          for (int index = 11; index >= 0; index--) {
            if (index >= mappingCount) continue;
            float sourceDepth = 1.0 - min(min(mappingFrom[index].r, mappingFrom[index].g), mappingFrom[index].b);
            if (sourceDepth < 0.000001) continue;
            vec3 ray = vec3(1.0) - (vec3(1.0) - mappingFrom[index]) / sourceDepth;
            vec3 delta = abs(ink - ray);
            float similarity = max(0.0, 1.0 - max(max(delta.r, delta.g), delta.b) / 0.08);
            float support = max(0.0, 1.0 - max(0.0, depth - sourceDepth) / 0.08);
            mapped = mix(mapped, mix(paper, mappingTo[index], min(1.0, depth / sourceDepth)), similarity * similarity * (3.0 - 2.0 * similarity) * support);
          }
        }
        color = vec4(mapped, inputColor.a);
      }`);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Color shader link failed');
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, 'source'), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, 'lookup'), 1);
    gl.uniform1i(gl.getUniformLocation(this.program, 'neutral'), 2);
    this.source = gl.createTexture()!; this.lookup = gl.createTexture()!;
    this.neutral = gl.createTexture()!;
    gl.disable(gl.DITHER);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  }

  render(pixels: Uint8ClampedArray, width: number, height: number, table: Uint8Array, neutral: Uint8Array, key: string, preferences: Preferences) {
    const gl = this.gl!;
    if (gl.isContextLost() || Math.max(width, height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('Color surface unavailable');
    if (this.surface.width !== width) this.surface.width = width;
    if (this.surface.height !== height) this.surface.height = height;
    const parse = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const paper = preferences.palette.find(entry => entry.from.toLowerCase() === '#ffffff')?.to || (preferences.recolor ? preferences.background : '#ffffff');
    const from = new Float32Array(36), to = new Float32Array(36);
    preferences.palette.slice(0, 12).forEach((entry, index) => { from.set(parse(entry.from), index * 3); to.set(parse(entry.to), index * 3); });
    gl.uniform1i(gl.getUniformLocation(this.program!, 'mappingCount'), Math.min(12, preferences.palette.length));
    gl.uniform3fv(gl.getUniformLocation(this.program!, 'mappingFrom[0]'), from);
    gl.uniform3fv(gl.getUniformLocation(this.program!, 'mappingTo[0]'), to);
    gl.uniform3fv(gl.getUniformLocation(this.program!, 'paper'), parse(paper));
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.source!);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.lookup!);
    if (this.key !== key) {
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const axis of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, axis, gl.CLAMP_TO_EDGE);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, LUT_SIZE, LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, table);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.neutral!);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, neutral);
      this.key = key;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const output = new Uint8ClampedArray(pixels.length);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, output);
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) throw new Error('Color rendering failed');
    return output;
  }
}
