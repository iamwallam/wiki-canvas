"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import SpriteText from "three-spritetext";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export default function Graph3D({ data }) {
  const fg = useRef();

  useEffect(() => {
    if (fg.current) fg.current.zoomToFit(400);
  }, [data]);

  return (
    <div className="w-screen h-screen">
      <ForceGraph3D
        ref={fg}
        graphData={
          data || {
            nodes: [...Array(5)].map((_, i) => ({ id: `n${i}` })),
            links: [...Array(4)].map((_, i) => ({ source: "n0", target: `n${i + 1}` })),
          }
        }
        nodeThreeObject={(node) => {
          const sprite = new SpriteText(node.id);
          sprite.material.depthWrite = false;  // avoid z‑fighting
          sprite.textHeight = 8;               // adjust size as needed
          sprite.color = "lightgray";
          return sprite;
        }}
        nodeThreeObjectExtend={false}
      />
    </div>
  );
}