// Quadtree spatial indexing for fast object lookup and viewport culling

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadTreeNode<T> {
  bounds: Bounds;
  items: T[];
  children: QuadTreeNode<T>[] | null;
}

export class QuadTree<T extends { id: string } & Bounds> {
  private root: QuadTreeNode<T>;
  private maxItems: number;
  private maxDepth: number;

  constructor(bounds: Bounds, maxItems = 10, maxDepth = 8) {
    this.root = { bounds, items: [], children: null };
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
  }

  insert(item: T): void {
    this.insertIntoNode(this.root, item, 0);
  }

  private insertIntoNode(node: QuadTreeNode<T>, item: T, depth: number): void {
    if (node.children) {
      // Find appropriate child
      const childIndex = this.getChildIndex(node.bounds, item);
      if (childIndex !== -1) {
        this.insertIntoNode(node.children[childIndex], item, depth + 1);
        return;
      }
    }

    node.items.push(item);

    // Subdivide if needed
    if (!node.children && node.items.length > this.maxItems && depth < this.maxDepth) {
      this.subdivide(node);

      // Redistribute items
      const items = [...node.items];
      node.items = [];
      items.forEach(i => this.insertIntoNode(node, i, depth));
    }
  }

  private subdivide(node: QuadTreeNode<T>): void {
    const { x, y, width, height } = node.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    node.children = [
      // Top-left
      { bounds: { x, y, width: halfWidth, height: halfHeight }, items: [], children: null },
      // Top-right
      { bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight }, items: [], children: null },
      // Bottom-left
      { bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight }, items: [], children: null },
      // Bottom-right
      { bounds: { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }, items: [], children: null },
    ];
  }

  private getChildIndex(nodeBounds: Bounds, item: Bounds): number {
    const midX = nodeBounds.x + nodeBounds.width / 2;
    const midY = nodeBounds.y + nodeBounds.height / 2;

    const inLeft = item.x + item.width <= midX;
    const inRight = item.x >= midX;
    const inTop = item.y + item.height <= midY;
    const inBottom = item.y >= midY;

    if (inTop && inLeft) return 0;
    if (inTop && inRight) return 1;
    if (inBottom && inLeft) return 2;
    if (inBottom && inRight) return 3;

    return -1; // Item spans multiple quadrants, stays in parent
  }

  query(bounds: Bounds): T[] {
    const results: T[] = [];
    this.queryNode(this.root, bounds, results);
    return results;
  }

  private queryNode(node: QuadTreeNode<T>, bounds: Bounds, results: T[]): void {
    if (!this.intersects(node.bounds, bounds)) return;

    node.items.forEach(item => {
      if (this.intersects(item, bounds)) {
        results.push(item);
      }
    });

    if (node.children) {
      node.children.forEach(child => this.queryNode(child, bounds, results));
    }
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );
  }

  remove(id: string): boolean {
    return this.removeFromNode(this.root, id);
  }

  private removeFromNode(node: QuadTreeNode<T>, id: string): boolean {
    // Check items in this node
    const index = node.items.findIndex(item => item.id === id);
    if (index !== -1) {
      node.items.splice(index, 1);
      return true;
    }

    // Check children
    if (node.children) {
      for (const child of node.children) {
        if (this.removeFromNode(child, id)) {
          return true;
        }
      }
    }

    return false;
  }

  update(item: T): void {
    // Simple approach: remove and re-insert
    this.remove(item.id);
    this.insert(item);
  }

  clear(): void {
    this.root = { bounds: this.root.bounds, items: [], children: null };
  }

  // Get all items in the tree
  getAll(): T[] {
    const results: T[] = [];
    this.getAllFromNode(this.root, results);
    return results;
  }

  private getAllFromNode(node: QuadTreeNode<T>, results: T[]): void {
    results.push(...node.items);
    if (node.children) {
      node.children.forEach(child => this.getAllFromNode(child, results));
    }
  }

  // Query for a single point (useful for hit testing)
  queryPoint(x: number, y: number): T[] {
    return this.query({ x: x - 1, y: y - 1, width: 2, height: 2 });
  }
}

// Helper to calculate bounding box of objects with rotation padding
export function calculateBoundingBox(objects: Bounds[]): Bounds {
  if (objects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach(obj => {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
