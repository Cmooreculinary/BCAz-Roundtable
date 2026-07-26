import { useEffect, useRef, useState } from "react";

/**
 * Rooms are composed in a fixed coordinate space (900×560 scene units) so a
 * chair's position is written once and never has to be re-derived per
 * breakpoint. This hook measures the card and returns the scale that fits that
 * space inside it — the whole room shrinks together, so nothing drifts.
 */
export default function useStageFit(sceneWidth, sceneHeight) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(width / sceneWidth, height / sceneHeight));
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [sceneWidth, sceneHeight]);

  return { ref, scale };
}
