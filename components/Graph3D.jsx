"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";

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
        nodeThreeObjectExtend={true}
        nodeThreeObject={(node) => {
          const group = new THREE.Group();
          // label sprite
          const labelText = node.weight !== undefined
            ? `${node.id} (${node.weight.toFixed(2)})`
            : node.id;
          const label = new SpriteText(labelText);
          label.material.depthWrite = false;
          label.color = "white";
          label.textHeight = 4;
          label.position.set(0, 6, 0);
          group.add(label);
          return group;
        }}
      />
    </div>
  );
}