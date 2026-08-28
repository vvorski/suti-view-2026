// Fullscreen quad. The geometry is already in clip space (PlaneGeometry(2, 2)),
// so there is nothing to transform — skipping the matrices keeps this honest
// about being a 2D effect wearing a 3D engine.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
