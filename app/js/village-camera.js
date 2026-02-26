// village-camera.js — Orthographic camera controller for the 3D village
// Pan (click-drag), scroll-wheel zoom, inertia, edge scrolling, soft world bounds

const VillageCamera = (() => {
  let camera = null;
  let domElement = null;
  let worldBounds = { minX: -3, maxX: 27, minZ: -3, maxZ: 27 }; // grid + border

  // Camera target (what we're looking at — world XZ coords)
  let targetX = 12;
  let targetZ = 12;
  let currentX = 12;
  let currentZ = 12;

  // Zoom
  let targetZoom = 1.0;
  let currentZoom = 1.0;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;
  const ZOOM_STEP = 1.1;

  // Frustum base (set from container size)
  let baseFrustumW = 30;
  let baseFrustumH = 20;

  // Dragging
  let isDragging = false;
  let _wasDragging = false;
  let dragStart = { x: 0, y: 0 };     // screen coords at drag start
  let panStart = { x: 0, y: 0 };       // camera target at drag start
  const DRAG_THRESHOLD = 5;            // px before a drag is recognized
  let dragDelta = 0;                   // total movement in px

  // Inertia
  let velocityX = 0;
  let velocityZ = 0;
  const FRICTION = 0.92;
  const INERTIA_MIN = 0.001;

  // Edge scrolling
  const EDGE_ZONE = 30; // px from edge
  const EDGE_SPEED = 12; // world units/sec at edge
  let edgeVelX = 0;
  let edgeVelZ = 0;

  // Easing
  const PAN_LERP = 0.12;
  const ZOOM_LERP = 0.15;

  // Soft bounds spring
  const SPRING_K = 4.0; // spring constant

  // Isometric camera vectors (projected onto XZ plane for mouse movement)
  // Camera looks from upper-right-front. Pan right = +X in screen, which maps to
  // a combination of +worldX and -worldZ. We precompute these.
  const ISO_RIGHT_X = 1.0;   // screen right → world X component
  const ISO_RIGHT_Z = -1.0;  // screen right → world Z component
  const ISO_UP_X = -1.0;     // screen up → world X component
  const ISO_UP_Z = -1.0;     // screen up → world Z component
  // Normalize
  const rLen = Math.sqrt(ISO_RIGHT_X * ISO_RIGHT_X + ISO_RIGHT_Z * ISO_RIGHT_Z);
  const uLen = Math.sqrt(ISO_UP_X * ISO_UP_X + ISO_UP_Z * ISO_UP_Z);
  const rightDir = { x: ISO_RIGHT_X / rLen, z: ISO_RIGHT_Z / rLen };
  const upDir = { x: ISO_UP_X / uLen, z: ISO_UP_Z / uLen };

  // Mouse button state
  let pointerDown = false;
  let middleDown = false;

  function init(cam, element, bounds) {
    camera = cam;
    domElement = element;
    if (bounds) worldBounds = bounds;

    // Calculate initial frustum from container
    updateFrustum();

    // Wire events
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointerleave', onPointerLeave);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function updateFrustum() {
    if (!camera || !domElement) return;
    const w = domElement.clientWidth || 1;
    const h = domElement.clientHeight || 1;
    const aspect = w / h;

    // Base frustum covers the full grid at zoom 1.0
    baseFrustumW = 30;
    baseFrustumH = baseFrustumW / aspect;

    applyFrustum();
  }

  function applyFrustum() {
    const halfW = baseFrustumW / (2 * currentZoom);
    const halfH = baseFrustumH / (2 * currentZoom);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }

  // Convert screen pixel delta to world XZ delta
  function screenToWorld(dx, dy) {
    // Pixels → world units based on current frustum
    const w = domElement.clientWidth || 1;
    const h = domElement.clientHeight || 1;
    const worldPerPixelX = (camera.right - camera.left) / w;
    const worldPerPixelY = (camera.top - camera.bottom) / h;

    // Apply isometric direction mapping
    const wx = dx * worldPerPixelX * rightDir.x + dy * worldPerPixelY * upDir.x;
    const wz = dx * worldPerPixelX * rightDir.z + dy * worldPerPixelY * upDir.z;
    return { x: wx, z: wz };
  }

  function onPointerDown(e) {
    if (e.button === 0) pointerDown = true;
    if (e.button === 1) middleDown = true;
    if (e.button !== 0 && e.button !== 1) return;

    isDragging = false;
    _wasDragging = false;
    dragDelta = 0;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    panStart.x = targetX;
    panStart.y = targetZ;

    // Kill inertia on new drag
    velocityX = 0;
    velocityZ = 0;

    domElement.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!pointerDown && !middleDown) {
      // Edge scrolling — compute edge velocity
      updateEdgeScroll(e);
      return;
    }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragDelta = Math.sqrt(dx * dx + dy * dy);

    if (dragDelta > DRAG_THRESHOLD) {
      isDragging = true;
      domElement.style.cursor = 'grabbing';

      // Convert screen delta to world delta (negate dx to match natural drag feel)
      const worldDelta = screenToWorld(-dx, dy);
      targetX = panStart.x + worldDelta.x;
      targetZ = panStart.y + worldDelta.z;
    }

    // Update edge scroll even while dragging
    updateEdgeScroll(e);
  }

  function onPointerUp(e) {
    if (e.button === 0) pointerDown = false;
    if (e.button === 1) middleDown = false;

    if (isDragging) {
      _wasDragging = true;
      domElement.style.cursor = 'grab';

      // Calculate inertia from recent movement (negate dx to match drag)
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (dragDelta > 10) {
        const worldDelta = screenToWorld(-dx, dy);
        velocityX = (worldDelta.x - (targetX - panStart.x)) * 0.3 || 0;
        velocityZ = (worldDelta.z - (targetZ - panStart.y)) * 0.3 || 0;
      }
    } else {
      _wasDragging = false;
    }

    isDragging = false;
    dragDelta = 0;

    try { domElement.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerLeave(e) {
    // Reset edge scroll velocities — prevents drift when pointer exits container
    edgeVelX = 0;
    edgeVelZ = 0;

    // Also handle pointer state cleanup (same as pointer up)
    pointerDown = false;
    middleDown = false;

    if (isDragging) {
      _wasDragging = true;
      domElement.style.cursor = 'grab';
    } else {
      _wasDragging = false;
    }

    isDragging = false;
    dragDelta = 0;

    try { domElement.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  function onWheel(e) {
    e.preventDefault();

    const direction = e.deltaY > 0 ? -1 : 1;
    const newZoom = targetZoom * Math.pow(ZOOM_STEP, direction);
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    // Zoom toward cursor position
    const rect = domElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Offset from center in screen pixels
    const offX = mx - cx;
    const offY = my - cy;

    // Move target slightly toward cursor when zooming in
    if (direction > 0) {
      const worldOff = screenToWorld(offX * 0.1, offY * 0.1);
      targetX += worldOff.x;
      targetZ += worldOff.z;
    }
  }

  function updateEdgeScroll(e) {
    if (!domElement) { edgeVelX = 0; edgeVelZ = 0; return; }
    const rect = domElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    edgeVelX = 0;
    edgeVelZ = 0;

    // Only edge-scroll when not dragging
    if (isDragging) return;

    // Left edge
    if (mx < EDGE_ZONE) {
      const t = 1 - mx / EDGE_ZONE;
      const worldDelta = screenToWorld(-EDGE_SPEED * t, 0);
      edgeVelX += worldDelta.x;
      edgeVelZ += worldDelta.z;
    }
    // Right edge
    if (mx > w - EDGE_ZONE) {
      const t = 1 - (w - mx) / EDGE_ZONE;
      const worldDelta = screenToWorld(EDGE_SPEED * t, 0);
      edgeVelX += worldDelta.x;
      edgeVelZ += worldDelta.z;
    }
    // Top edge
    if (my < EDGE_ZONE) {
      const t = 1 - my / EDGE_ZONE;
      const worldDelta = screenToWorld(0, -EDGE_SPEED * t);
      edgeVelX += worldDelta.x;
      edgeVelZ += worldDelta.z;
    }
    // Bottom edge
    if (my > h - EDGE_ZONE) {
      const t = 1 - (h - my) / EDGE_ZONE;
      const worldDelta = screenToWorld(0, EDGE_SPEED * t);
      edgeVelX += worldDelta.x;
      edgeVelZ += worldDelta.z;
    }
  }

  function update(deltaTime) {
    if (!camera) return;

    // Apply edge scrolling
    if (Math.abs(edgeVelX) > 0.001 || Math.abs(edgeVelZ) > 0.001) {
      targetX += edgeVelX * deltaTime;
      targetZ += edgeVelZ * deltaTime;
    }

    // Apply inertia
    if (Math.abs(velocityX) > INERTIA_MIN || Math.abs(velocityZ) > INERTIA_MIN) {
      targetX += velocityX;
      targetZ += velocityZ;
      velocityX *= FRICTION;
      velocityZ *= FRICTION;
      if (Math.abs(velocityX) < INERTIA_MIN) velocityX = 0;
      if (Math.abs(velocityZ) < INERTIA_MIN) velocityZ = 0;
    }

    // Soft bounds — spring force when past boundary
    const cx = (worldBounds.minX + worldBounds.maxX) / 2;
    const cz = (worldBounds.minZ + worldBounds.maxZ) / 2;
    const halfW = (worldBounds.maxX - worldBounds.minX) / 2;
    const halfZ = (worldBounds.maxZ - worldBounds.minZ) / 2;

    if (targetX < worldBounds.minX) {
      targetX += (worldBounds.minX - targetX) * SPRING_K * deltaTime;
      velocityX *= 0.8;
    } else if (targetX > worldBounds.maxX) {
      targetX += (worldBounds.maxX - targetX) * SPRING_K * deltaTime;
      velocityX *= 0.8;
    }
    if (targetZ < worldBounds.minZ) {
      targetZ += (worldBounds.minZ - targetZ) * SPRING_K * deltaTime;
      velocityZ *= 0.8;
    } else if (targetZ > worldBounds.maxZ) {
      targetZ += (worldBounds.maxZ - targetZ) * SPRING_K * deltaTime;
      velocityZ *= 0.8;
    }

    // Smooth lerp position
    currentX += (targetX - currentX) * PAN_LERP;
    currentZ += (targetZ - currentZ) * PAN_LERP;

    // Smooth lerp zoom
    currentZoom += (targetZoom - currentZoom) * ZOOM_LERP;
    applyFrustum();

    // Update camera position — keep isometric angle, shift XZ position
    // Camera is positioned along the isometric direction vector from the target
    const camDist = 50; // far enough to see everything
    camera.position.set(
      currentX + camDist * Math.cos(Math.PI / 4),
      camDist * Math.sin(Math.atan(Math.sqrt(2))),  // ~35.264° elevation
      currentZ + camDist * Math.sin(Math.PI / 4)
    );
    camera.lookAt(currentX, 0, currentZ);
  }

  function wasDragging() {
    return _wasDragging;
  }

  function getZoom() {
    return currentZoom;
  }

  function resize() {
    updateFrustum();
  }

  function dispose() {
    if (!domElement) return;
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('pointerleave', onPointerLeave);
    domElement.removeEventListener('wheel', onWheel);
    camera = null;
    domElement = null;
  }

  return { init, update, wasDragging, getZoom, resize, dispose };
})();
