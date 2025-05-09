"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback, useState } from "react";
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

export default function Graph3D({ data }) {
  const fg = useRef();
  const camRef = useRef();
  const rafRef = useRef();
  
  // --- START: Re-introducing local state for Option B (Temp Patch) ---
  const [graph, setGraph] = useState(data || dummyData);
  useEffect(() => {
    setGraph(data || dummyData); // Sync local graph with incoming data prop
  }, [data]);
  // --- END: Re-introducing local state ---

  const fetchedUrlsRef = useRef(new Set());
  const lastClickRef = useRef(0);

  // Get sprite from node - wrapping to avoid issues if internal naming changes
  const getSprite = (node) => node.__threeObj;

  // --- START: Local mergeGraph helper for Option B (Temp Patch) ---
  const mergeGraph = (currentGraph, newData) => {
    const currentNodes = currentGraph?.nodes || [];
    const currentLinks = currentGraph?.links || [];
    const newNodesToAdd = newData?.nodes || [];
    const newLinksToAdd = newData?.links || [];

    const combinedNodes = [...currentNodes];
    newNodesToAdd.forEach(newNode => {
      if (!currentNodes.some(existingNode => existingNode.id === newNode.id)) {
        combinedNodes.push(newNode);
      }
    });
    const combinedLinks = [...currentLinks];
    newLinksToAdd.forEach(newLink => {
      const linkExists = currentLinks.some(existingLink =>
        (existingLink.source === newLink.source && existingLink.target === newLink.target) ||
        (existingLink.source === newLink.target && existingLink.target === newLink.source)
      );
      if (!linkExists) {
        combinedLinks.push(newLink);
      }
    });
    return { nodes: combinedNodes, links: combinedLinks };
  };
  // --- END: Local mergeGraph helper ---

  // Update label visibility based on camera distance
  const updateLabels = useCallback(() => {
    if (!camRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      const distance = camRef.current.position.length();
      const near = 400 - 20;
      const far = 800 + 20;
      
      // Reverted to use local 'graph' state due to Option B
      if (!fg.current || !graph || !graph.nodes) return;
      
      graph.nodes.forEach(node => { // Reverted to local 'graph.nodes'
        if (node.type === "image") return;   
        const sprite = getSprite(node);
        if (!sprite) return;
        
        const weight = typeof node.weight === "number" ? node.weight : 0.3;
        
        if (distance < near) {
          sprite.visible = true;
          sprite.textHeight = fontSizeFromWeight(weight);
        } else if (distance < far) {
          sprite.visible = true;
          sprite.textHeight = fontSizeFromWeight(weight) * 0.6;
        } else {
          sprite.visible = node.isCentral === true;
          if (sprite.visible) {
            sprite.textHeight = fontSizeFromWeight(weight) * 0.4;
          }
        }
      });
      
      fg.current.refresh();
    });
  }, [graph, fg, camRef, rafRef]);

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

    fg.current.d3Force("charge").strength(-80);
    fg.current.d3Force("link").distance(60);
    
    return () => {
      if (fg.current) {
        const controls = fg.current.controls();
        if (controls) {
          controls.removeEventListener('change', updateLabels);
        }
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [graph, updateLabels]);

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
    setGraph(prev => mergeGraph(prev, subGraph));
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
          // If we've already built a THREE object for this node, re-use it
          if (node.__threeObj) return node.__threeObj;

          // --- 1️⃣ image sprite branch -------------------------------
          if (node.type === "image") {
            // remote images need CORS-safe loader
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin("anonymous");

            const tex = loader.load(node.thumb, () => {
              // ensure scene refresh after texture finishes loading
              fg.current?.refresh();
            });
            tex.colorSpace = THREE.SRGBColorSpace;     // better colours

            // New material creation for Patch 1
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
            mat.depthWrite = false;
            mat.depthTest  = false;          // ← draw regardless of depth buffer

            const sprite = new THREE.Sprite(mat);

            sprite.scale.set(15, 15);                  // constant screen size
            sprite.frustumCulled = false;    // ← no culling artefacts (NEW for Patch 1)
            sprite.renderOrder = 9999;       // ⬅️  draw last, prevents Z-fighting
            node.__threeObj = sprite;          // 🔑  cache for next render pass
            return sprite;
          }
          // --- 2️⃣ default Wiki label branch -------------------------
          const label = new SpriteText(node.id);
          label.material.depthWrite = false;
          label.color = "white";
          label.textHeight = fontSizeFromWeight(
            typeof node.weight === "number" ? node.weight : 0.3
          );
          return label;
        }}
      />
    </div>
  );
}