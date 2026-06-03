"use client";

import { useEffect, useState } from "react";

type TooltipState = {
  text: string;
  left: number;
  top: number;
  placement: "top" | "bottom";
};

const tooltipMaxWidth = 260;
const viewportMargin = 16;

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    function getTooltipTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return null;
      }

      return target.closest<HTMLElement>("[data-tooltip]");
    }

    function showTooltip(target: HTMLElement) {
      const text = target.dataset.tooltip?.trim();

      if (!text) {
        setTooltip(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const placement = window.innerHeight - rect.bottom < 96 ? "top" : "bottom";
      const minLeft = Math.min(viewportMargin + tooltipMaxWidth / 2, window.innerWidth / 2);
      const maxLeft = Math.max(window.innerWidth - viewportMargin - tooltipMaxWidth / 2, minLeft);
      const left = Math.min(Math.max(rect.left + rect.width / 2, minLeft), maxLeft);
      const top = placement === "bottom" ? rect.bottom + 8 : rect.top - 8;

      setTooltip({
        text,
        left,
        top,
        placement
      });
    }

    function handlePointerOver(event: PointerEvent) {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        return;
      }

      const target = getTooltipTarget(event.target);

      if (target) {
        showTooltip(target);
      }
    }

    function handlePointerOut(event: PointerEvent) {
      const target = getTooltipTarget(event.target);

      if (!target) {
        return;
      }

      const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;

      if (!nextTarget || !target.contains(nextTarget)) {
        setTooltip(null);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = getTooltipTarget(event.target);

      if (target) {
        showTooltip(target);
      }
    }

    function hideTooltip() {
      setTooltip(null);
    }

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", hideTooltip);
      window.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, []);

  if (!tooltip) {
    return null;
  }

  return (
    <div
      className={`global-tooltip ${tooltip.placement}`}
      role="tooltip"
      style={{
        left: tooltip.left,
        top: tooltip.top
      }}
    >
      {tooltip.text}
    </div>
  );
}
