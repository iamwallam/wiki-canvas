"use client";
import dynamic from "next/dynamic";
import { forwardRef, useImperativeHandle, useEffect, useRef, useCallback, useState, useMemo } from "react";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { fontSizeFromWeight } from "@/lib/wiki";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const dummyData = {
  nodes: [...Array(5)].map((_, i) => ({ id: `n${i}`, url: `https://example.com/node/n${i}` })),
  links: [...Array(4)].map((_, i) => ({ source: "n0", target: `n${i + 1}` })),
};

function Graph3DInner({ data, hoverId }, ref) {
  console.log('[Graph3DInner] Rendering. hoverId:', hoverId);
  const fg = useRef();
  const customOrbitControlsRef = useRef();
  const mountRef = useRef(null);

  useImperativeHandle(ref, () => ({
    camera: () => fg.current?.camera?.(),
    cameraPosition: (...a) => fg.current?.cameraPosition?.(...a),
    zoomToNode: (nodeObj, ms) => fg.current?.zoomToNode?.(nodeObj, ms),
    scene: () => fg.current?.scene?.(),
    controls: () => customOrbitControlsRef.current,
  }));

  const [graph, setGraph] = useState(data || dummyData);
  const fetchedUrlsRef = useRef(new Set());
  const lastClickRef = useRef(0);

  const getSprite = (node) => node.__threeObj;

  const handleEngineStop = useCallback(() => {
    if (!fg.current) return;
    console.log("Graph engine has stopped or initialized.");

    if (fg.current.camera && fg.current.renderer && mountRef.current) {
        const camera = fg.current.camera();
        const rendererDomElement = fg.current.renderer().domElement;

        if (customOrbitControlsRef.current) {
            customOrbitControlsRef.current.dispose();
        }
        
        customOrbitControlsRef.current = new OrbitControls(camera, rendererDomElement);
        customOrbitControlsRef.current.enableDamping = true;
        customOrbitControlsRef.current.dampingFactor = 0.05;
        
        console.log("Custom OrbitControls initialized.");
    } else {
        console.warn("Could not initialize custom OrbitControls: camera, renderer, or mount point not ready.");
    }
  }, []);

  useEffect(() => {
    if (!fg.current) return;
    fg.current.d3Force("charge").strength(-80);
    fg.current.d3Force("link").distance(60);
    fg.current.zoomToFit(400);
    
    return () => {
      if (customOrbitControlsRef.current) {
        customOrbitControlsRef.current.dispose();
        customOrbitControlsRef.current = null;
        console.log("Custom OrbitControls disposed.");
      }
    };
  }, [graph]);

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
    if (now - lastClickRef.current < 300) { 
      if (!node.type) { 
        expandNode(node);
      }
    }
    lastClickRef.current = now;
  };

  const handleNodeThreeObject = useCallback((node) => {
    const labelText = node.id;
    const label = new SpriteText(labelText);
    label.userData = { node }; 
    label.material.depthWrite = false; 
    label.color = "black";
    label.textHeight = fontSizeFromWeight(
      typeof node.weight === "number" ? node.weight : 0.3
    );
    return label;
  }, []);

  const memoizedNodeThreeObjectExtend = useMemo(() => {
    return (threeObj, node, globalScale) => {
      if (!threeObj || !threeObj.hasOwnProperty('color')) {
        return false; 
      }
      const targetColor = (node.id === hoverId) ? "lime" : "black";
      if (threeObj.color !== targetColor) {
        threeObj.color = targetColor;
      }
      return false; 
    };
  }, [hoverId]);

  return (
    <div ref={mountRef} className="w-screen h-screen bg-canvas">
      <ForceGraph3D
        ref={fg}
        graphData={graph || dummyData}
        nodeVal="val"
        onEngineStop={handleEngineStop}
        onNodeClick={handleNodeClick}
        nodeThreeObject={handleNodeThreeObject}
        nodeThreeObjectExtend={memoizedNodeThreeObjectExtend}
        enableZoomInteraction={false}
        enablePanInteraction={false}
        enableRotateInteraction={false}
        enableNodeDrag={false}
        backgroundColor="#F5F5F5"
      />
    </div>
  );
}

export default forwardRef(Graph3DInner);