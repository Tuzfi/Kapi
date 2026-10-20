/**
 * Kapi Spatial Index Engine
 * Clean-room reconstruction of Carrier HAP's spatial index architecture:
 * - Carrier.eDesign.Geometry.Search.QuadTree<T>
 * - Carrier.HAP.Configuration.Buildings.SpatialIndex
 */

export class BoundingBox {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get minX() { return this.x; }
    get minY() { return this.y; }
    get maxX() { return this.x + this.width; }
    get maxY() { return this.y + this.height; }

    containsPoint(px, py) {
        return px >= this.minX && px <= this.maxX && py >= this.minY && py <= this.maxY;
    }

    intersects(other) {
        return !(other.maxX < this.minX ||
                 other.minX > this.maxX ||
                 other.maxY < this.minY ||
                 other.minY > this.maxY);
    }

    static fromPoints(points) {
        if (!points || points.length === 0) return new BoundingBox(0, 0, 0, 0);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return new BoundingBox(minX, minY, maxX - minX, maxY - minY);
    }
}

export class QuadTreeNode {
    constructor(bounds, depth = 0, maxDepth = 6, maxItems = 4) {
        this.bounds = bounds;
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.maxItems = maxItems;
        this.items = [];
        this.children = null; // [NW, NE, SW, SE]
    }

    isLeaf() {
        return this.children === null;
    }

    subdivide() {
        const halfW = this.bounds.width / 2;
        const halfH = this.bounds.height / 2;
        const x = this.bounds.x;
        const y = this.bounds.y;
        const nextDepth = this.depth + 1;

        this.children = [
            new QuadTreeNode(new BoundingBox(x, y, halfW, halfH), nextDepth, this.maxDepth, this.maxItems),                 // NW
            new QuadTreeNode(new BoundingBox(x + halfW, y, halfW, halfH), nextDepth, this.maxDepth, this.maxItems),         // NE
            new QuadTreeNode(new BoundingBox(x, y + halfH, halfW, halfH), nextDepth, this.maxDepth, this.maxItems),         // SW
            new QuadTreeNode(new BoundingBox(x + halfW, y + halfH, halfW, halfH), nextDepth, this.maxDepth, this.maxItems)  // SE
        ];

        // Re-distribute items
        const existing = this.items;
        this.items = [];
        for (const item of existing) {
            this.insert(item);
        }
    }

    insert(item) {
        if (!this.bounds.intersects(item.bounds)) {
            return false;
        }

        if (this.isLeaf()) {
            if (this.items.length < this.maxItems || this.depth >= this.maxDepth) {
                this.items.push(item);
                return true;
            }
            this.subdivide();
        }

        let inserted = false;
        for (const child of this.children) {
            if (child.insert(item)) {
                inserted = true;
            }
        }
        return inserted;
    }

    query(searchBounds, results = new Set()) {
        if (!this.bounds.intersects(searchBounds)) {
            return results;
        }

        for (const item of this.items) {
            if (searchBounds.intersects(item.bounds)) {
                results.add(item);
            }
        }

        if (!this.isLeaf()) {
            for (const child of this.children) {
                child.query(searchBounds, results);
            }
        }
        return results;
    }

    clear() {
        this.items = [];
        this.children = null;
    }
}

/**
 * 2D Spatial Index matching Carrier.HAP.Configuration.Buildings.SpatialIndex
 */
export class SpatialIndex {
    constructor(worldBounds = new BoundingBox(-1000, -1000, 2000, 2000)) {
        this.worldBounds = worldBounds;
        this.pointsQuadTree = new QuadTreeNode(worldBounds);
        this.segmentsQuadTree = new QuadTreeNode(worldBounds);
        this.enclosuresQuadTree = new QuadTreeNode(worldBounds);
    }

    rebuild(spaces) {
        this.pointsQuadTree.clear();
        this.segmentsQuadTree.clear();
        this.enclosuresQuadTree.clear();

        for (const space of spaces) {
            // Index enclosure
            const encBounds = BoundingBox.fromPoints(space.polygon);
            this.enclosuresQuadTree.insert({
                id: space.id,
                type: 'enclosure',
                data: space,
                bounds: encBounds
            });

            // Index vertices and segments (walls)
            const pts = space.polygon;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];

                // Point with snap radius (e.g. 10px / 0.5m)
                const ptBox = new BoundingBox(p1.x - 8, p1.y - 8, 16, 16);
                this.pointsQuadTree.insert({
                    id: `${space.id}_pt_${i}`,
                    type: 'point',
                    point: p1,
                    spaceId: space.id,
                    pointIndex: i,
                    bounds: ptBox
                });

                // Segment (wall)
                const segBox = BoundingBox.fromPoints([p1, p2]);
                // Add minimum thickness to bounding box so horizontal/vertical lines intersect easily
                const paddedBox = new BoundingBox(
                    segBox.x - 4,
                    segBox.y - 4,
                    Math.max(segBox.width, 8),
                    Math.max(segBox.height, 8)
                );
                this.segmentsQuadTree.insert({
                    id: `${space.id}_wall_${i}`,
                    type: 'wall',
                    p1: p1,
                    p2: p2,
                    spaceId: space.id,
                    wallIndex: i,
                    bounds: paddedBox
                });
            }
        }
    }

    findNearestPoint(x, y, radius = 12) {
        const searchBox = new BoundingBox(x - radius, y - radius, radius * 2, radius * 2);
        const candidates = Array.from(this.pointsQuadTree.query(searchBox));
        let closest = null;
        let minDistSq = radius * radius;

        for (const item of candidates) {
            const dx = item.point.x - x;
            const dy = item.point.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = item;
            }
        }
        return closest;
    }

    findNearestWall(x, y, maxDistance = 10) {
        const searchBox = new BoundingBox(x - maxDistance, y - maxDistance, maxDistance * 2, maxDistance * 2);
        const candidates = Array.from(this.segmentsQuadTree.query(searchBox));
        let closest = null;
        let minDistance = maxDistance;

        for (const item of candidates) {
            const dist = pointToSegmentDistance(x, y, item.p1.x, item.p1.y, item.p2.x, item.p2.y);
            if (dist < minDistance) {
                minDistance = dist;
                closest = { ...item, distance: dist };
            }
        }
        return closest;
    }

    findEnclosureAt(x, y) {
        const searchBox = new BoundingBox(x - 1, y - 1, 2, 2);
        const candidates = Array.from(this.enclosuresQuadTree.query(searchBox));
        for (const item of candidates) {
            if (isPointInsidePolygon(x, y, item.data.polygon)) {
                return item.data;
            }
        }
        return null;
    }
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
        return Math.hypot(px - x1, py - y1);
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

function isPointInsidePolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
