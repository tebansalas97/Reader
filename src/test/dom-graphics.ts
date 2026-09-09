class MatrixStub {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m21 = 0;
  m22 = 1;
  m41 = 0;
  m42 = 0;
  is2D = true;
  isIdentity = true;

  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      this.m11 = this.a;
      this.m12 = this.b;
      this.m21 = this.c;
      this.m22 = this.d;
      this.m41 = this.e;
      this.m42 = this.f;
      this.isIdentity = false;
    }
  }

  multiply(): MatrixStub {
    return this;
  }

  translate(): MatrixStub {
    return this;
  }

  scale(): MatrixStub {
    return this;
  }

  inverse(): MatrixStub {
    return this;
  }

  transformPoint(point: { x: number; y: number }): { x: number; y: number } {
    return point;
  }

  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

class PathStub {
  addPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
  ellipse(): void {}
  rect(): void {}
}

class ImageDataStub {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

export function installGraphicsStubs(): void {
  const target = globalThis as Record<string, unknown>;
  if (!target.DOMMatrix) target.DOMMatrix = MatrixStub;
  if (!target.DOMMatrixReadOnly) target.DOMMatrixReadOnly = MatrixStub;
  if (!target.Path2D) target.Path2D = PathStub;
  if (!target.ImageData) target.ImageData = ImageDataStub;
  if (!target.DOMPoint) {
    target.DOMPoint = class {
      x: number;
      y: number;
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }
    };
  }
}
