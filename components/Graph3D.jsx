"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { fontSizeFromWeight } from "@/lib/wiki";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

export default function Graph3D({ data }) {
  const fg = useRef();

  useEffect(() => {
    if (!fg.current) return;

    // push nodes apart & lengthen links
    fg.current.d3Force("charge").strength(-80);
    fg.current.d3Force("link").distance(60);
    fg.current.zoomToFit(400);
  }, [data]);

  const dummyData = {
    nodes: [...Array(5)].map((_, i) => ({ id: `n${i}` })),
    links: [...Array(4)].map((_, i) => ({ source: "n0", target: `n${i + 1}` })),
  };

  return (
    <div className="w-screen h-screen">
      <ForceGraph3D
        ref={fg}
        graphData={data || dummyData}
        nodeVal="val"
        nodeThreeObjectExtend={false}
        nodeThreeObject={(node) => {
          const labelText = node.id;
          const label = new SpriteText(labelText);
          label.material.depthWrite = false;
          label.color = "white";
          // use weight if present, else fallback 0.3
          label.textHeight = fontSizeFromWeight(
            typeof node.weight === "number" ? node.weight : 0.3
          );
          return label; // a SpriteText IS a Three object
        }}
      />
    </div>
  );
}