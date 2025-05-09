"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export default function Graph3D() {
  const fgRef = useRef();
  useEffect(() => {
    if (fgRef.current) fgRef.current.zoomToFit(400);
  }, []);
  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={{
        nodes: [...Array(5)].map((_, id) => ({ id })),
        links: [
          { source: 0, target: 1 },
          { source: 0, target: 2 },
          { source: 0, target: 3 },
          { source: 0, target: 4 }
        ]
      }}
    />
  );
}