"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { fontSizeFromWeight } from "@/lib/wiki";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

export default function Graph3D({ data }) {
  const fg = useRef();
  const camRef = useRef();
  const rafRef = useRef();

  // Get sprite from node - wrapping to avoid issues if internal naming changes
  const getSprite = (node) => node.__threeObj;

  // Update label visibility based on camera distance
  const updateLabels = useCallback(() => {
    if (!camRef.current) return;
    
    // Cancel any existing RAF to prevent multiple updates in same frame
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    // Schedule update on next animation frame
    rafRef.current = requestAnimationFrame(() => {
      // Calculate distance from camera to center (origin)
      const distance = camRef.current.position.length();
      
      // Add small hysteresis buffer to prevent flickering
      const near = 400 - 20;
      const far = 800 + 20;
      
      if (!fg.current || !data || !data.nodes) return;
      
      data.nodes.forEach(node => {
        const sprite = getSprite(node);
        if (!sprite) return;
        
        const weight = typeof node.weight === "number" ? node.weight : 0.3;
        
        // Apply different LOD levels based on distance
        if (distance < near) {
          // Close view: full size labels
          sprite.visible = true;
          sprite.textHeight = fontSizeFromWeight(weight);
        } else if (distance < far) {
          // Medium view: smaller labels
          sprite.visible = true;
          sprite.textHeight = fontSizeFromWeight(weight) * 0.6;
        } else {
          // Far view: hide labels for non-central nodes
          sprite.visible = node.isCentral === true;
          if (sprite.visible) {
            sprite.textHeight = fontSizeFromWeight(weight) * 0.4;
          }
        }
      });
      
      // Refresh graph to apply changes
      fg.current.refresh();
    });
  }, [data]);

  const handleEngineStop = useCallback(() => {
    if (!fg.current) return;
    // Get camera reference once graph is ready
    camRef.current = fg.current.camera();
    
    // Get controls and add change listener for camera movement
    const controls = fg.current.controls();
    if (controls) {
      controls.addEventListener('change', updateLabels);
      // Run initial labels update
      updateLabels();
    }
  }, [updateLabels]);

  useEffect(() => {
    if (!fg.current) return;

    // push nodes apart & lengthen links
    fg.current.d3Force("charge").strength(-80);
    fg.current.d3Force("link").distance(60);
    fg.current.zoomToFit(400);
    
    // Cleanup function
    return () => {
      // Remove event listener when component unmounts
      if (fg.current) {
        const controls = fg.current.controls();
        if (controls) {
          controls.removeEventListener('change', updateLabels);
        }
      }
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [data, updateLabels]);

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
        onEngineStop={handleEngineStop}
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