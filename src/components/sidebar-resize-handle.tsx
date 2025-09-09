"use client";

import { useEffect, useRef, useState } from "react";

export function SidebarResizeHandle() {
  const dragging = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const x = Math.max(160, Math.min(e.clientX, 420));
      const wrapper = document.querySelector<HTMLElement>(
        '[data-slot="sidebar-wrapper"]',
      );
      if (wrapper) wrapper.style.setProperty("--sidebar-width", `${x}px`);
    }
    function onMouseUp() {
      dragging.current = false;
      setVisible(false);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      className="fixed inset-y-0 left-0 z-40 w-2 cursor-col-resize select-none hidden md:block"
      onMouseDown={() => {
        dragging.current = true;
        setVisible(true);
      }}
      style={{ pointerEvents: "auto" }}
      aria-hidden
    >
      {visible && <div className="absolute inset-y-0 right-0 w-px bg-border" />}
    </div>
  );
}
