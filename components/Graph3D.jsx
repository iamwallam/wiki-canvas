"use client";
import dynamic from "next/dynamic";
import { forwardRef, useImperativeHandle, useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { fontSizeFromWeight } from "@/lib/wiki";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const dummyData = {
  nodes: [...Array(5)].map((_, i) => ({ id: `n${i}`, url: `https://example.com/node/n${i}` })),
  links: [...Array(4)].map((_, i) => ({ source: "n0", target: `n${i + 1}` })),
};

function Graph3DInner({ data, hoverId }, ref) {
  const fg = useRef();

  useImperativeHandle(ref, () => ({
    camera: () => fg.current?.camera?.(),
    cameraPosition: (...a) => fg.current?.cameraPosition?.(...a),
    zoomToNode: (...a) => fg.current?.zoomToNode?.(...a),
    scene: () => fg.current?.scene?.(),
    controls: () => fg.current?.controls?.()
  }));

  const camRef = useRef();
  const rafRef = useRef();
  const [graph, setGraph] = useState(data || dummyData);
  const fetchedUrlsRef = useRef(new Set());
  const lastClickRef = useRef(0);

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
      
      if (!fg.current || !graph || !graph.nodes) return;
      
      graph.nodes.forEach(node => {
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
  }, [graph]);

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
  }, [graph, updateLabels]);

  useEffect(() => {
    setGraph(data || dummyData);
  }, [data]);

  const mergeGraph = ({ nodes, links }) => {
    setGraph(prev => ({
      nodes: [...prev.nodes, ...nodes.filter(n => !prev.nodes.find(p => p.id === n.id))],
      links: [...prev.links, ...links.filter(l => !prev.links.find(p => p.source === l.source && p.target === l.target))]
    }));
  };

  const expandNode = async (node) => {
    if (fetchedUrlsRef.current.has(node.url)) return;
    fetchedUrlsRef.current.add(node.url);
    
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: node.url })
    });
    
    if (!res.ok) return console.error(await res.text());
    const subGraph = await res.json();
    mergeGraph(subGraph);
  };

  const handleNodeClick = (node) => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) { // double-click (<300 ms)
      if (!node.type) { // Wikipedia nodes only
        expandNode(node);
      }
    }
    lastClickRef.current = now;
  };

  return (
    <div className="w-screen h-screen">
      <ForceGraph3D
        ref={fg}
        graphData={graph || dummyData}
        nodeVal="val"
        nodeThreeObjectExtend={false}
        onEngineStop={handleEngineStop}
        onNodeClick={handleNodeClick}
        nodeThreeObject={(node) => {
          const labelText = node.id;
          const label = new SpriteText(labelText);
          label.userData = { node };
          label.material.depthWrite = false;

          if (node.id === hoverId) {
            label.color = "lime";
          } else {
            label.color = "white";
          }

          label.textHeight = fontSizeFromWeight(
            typeof node.weight === "number" ? node.weight : 0.3
          );
          return label;
        }}
      />
    </div>
  );
}

export default forwardRef(Graph3DInner);