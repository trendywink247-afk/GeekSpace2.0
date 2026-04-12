import '@testing-library/jest-dom/vitest';

// Mock HTMLCanvasElement.getContext — jsdom does not implement canvas rendering.
// This no-op mock prevents "Not implemented: HTMLCanvasElement's getContext()" errors
// and allows canvas-dependent modules (sprites, OfficeCanvasRenderer) to load without
// throwing when they call ctx.fillStyle, ctx.drawImage, etc.
const mockCtx: Partial<CanvasRenderingContext2D> = {
  fillStyle: '',
  strokeStyle: '',
  globalAlpha: 1,
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  clip: () => {},
  drawImage: () => {},
  createLinearGradient: () => ({
    addColorStop: () => {},
  } as CanvasGradient),
  createRadialGradient: () => ({
    addColorStop: () => {},
  } as CanvasGradient),
  measureText: () => ({ width: 0 } as TextMetrics),
  fillText: () => {},
  strokeText: () => {},
  setTransform: () => {},
  resetTransform: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData),
  putImageData: () => {},
  createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData),
  getLineDash: () => [],
  setLineDash: () => {},
  isPointInPath: () => false,
};

// Extend the mock so property assignments (ctx.fillStyle = 'red') don't throw
const mockCtxProxy = new Proxy(mockCtx, {
  set(_target, _prop, _value) {
    return true; // silently accept all property writes
  },
  get(target, prop) {
    if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
    // Return a no-op function for any unknown canvas method
    return () => {};
  },
});

HTMLCanvasElement.prototype.getContext = function () {
  return mockCtxProxy as unknown as CanvasRenderingContext2D;
};

// Mock window.matchMedia for component tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});
