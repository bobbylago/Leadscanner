/*
 * Joystick — a draggable virtual thumbstick.
 *
 * Reports a normalized vector on every move:
 *   { x, y, magnitude, angle }
 *   - x:  -1 (left)  ..  +1 (right)
 *   - y:  -1 (up)    ..  +1 (down)   (screen coordinates)
 *   - magnitude: 0..1  (how far the knob is pushed)
 *   - angle: radians, atan2(y, x)
 *
 * Works with mouse, touch and pen via Pointer Events.
 */
(function () {
  "use strict";

  class Joystick {
    /**
     * @param {HTMLElement} base  the outer ring element
     * @param {HTMLElement} knob  the inner draggable knob element
     * @param {object} handlers   { onChange(vec), onStart(), onEnd() }
     */
    constructor(base, knob, handlers = {}) {
      this.base = base;
      this.knob = knob;
      this.onChange = handlers.onChange || function () {};
      this.onStart = handlers.onStart || function () {};
      this.onEnd = handlers.onEnd || function () {};

      this.active = false;
      this.pointerId = null;
      this.vector = { x: 0, y: 0, magnitude: 0, angle: 0 };

      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);

      this.base.addEventListener("pointerdown", this._onDown);
      window.addEventListener("pointermove", this._onMove);
      window.addEventListener("pointerup", this._onUp);
      window.addEventListener("pointercancel", this._onUp);
    }

    get radius() {
      // Maximum travel of the knob center from the base center.
      return this.base.clientWidth / 2;
    }

    _center() {
      const r = this.base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    _onDown(e) {
      if (this.active) return;
      this.active = true;
      this.pointerId = e.pointerId;
      this.base.setPointerCapture?.(e.pointerId);
      this.base.classList.add("is-active");
      this.onStart();
      this._update(e.clientX, e.clientY);
    }

    _onMove(e) {
      if (!this.active || e.pointerId !== this.pointerId) return;
      this._update(e.clientX, e.clientY);
    }

    _onUp(e) {
      if (!this.active || e.pointerId !== this.pointerId) return;
      this.active = false;
      this.pointerId = null;
      this.base.classList.remove("is-active");
      this._reset();
      this.onEnd();
    }

    _update(clientX, clientY) {
      const center = this._center();
      let dx = clientX - center.x;
      let dy = clientY - center.y;

      const dist = Math.hypot(dx, dy);
      const max = this.radius;
      // Clamp the knob inside the ring.
      if (dist > max) {
        dx = (dx / dist) * max;
        dy = (dy / dist) * max;
      }

      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;

      const magnitude = Math.min(dist / max, 1);
      this.vector = {
        x: dx / max,
        y: dy / max,
        magnitude,
        angle: Math.atan2(dy, dx),
      };
      this.onChange(this.vector);
    }

    _reset() {
      this.knob.style.transform = "translate(0px, 0px)";
      this.vector = { x: 0, y: 0, magnitude: 0, angle: 0 };
      this.onChange(this.vector);
    }

    /** Programmatically set the vector (used by keyboard control). */
    setVector(x, y) {
      const mag = Math.min(Math.hypot(x, y), 1);
      if (mag > 0) {
        const a = Math.atan2(y, x);
        x = Math.cos(a) * mag;
        y = Math.sin(a) * mag;
      }
      this.knob.style.transform = `translate(${x * this.radius}px, ${y * this.radius}px)`;
      this.vector = { x, y, magnitude: mag, angle: Math.atan2(y, x) };
      this.onChange(this.vector);
    }
  }

  window.Joystick = Joystick;
})();
