"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import Graph3D from "@/components/Graph3D";
import UrlForm from "@/components/UrlForm";
import HandTracker from "@/components/HandTracker";

// --- Timing constants for the visual cursor ---
const HIDE_CURSOR_AFTER_MS = 200; // How long after last pinch move to start fading out
const CURSOR_FADE_DURATION_MS = 300; // Duration of the fade-out animation

const mergeGraphData = (currentGraph, newData) => {
  const currentNodes = currentGraph?.nodes || [];
  const currentLinks = currentGraph?.links || [];
  const newNodes = newData?.nodes || [];
  const newLinks = newData?.links || [];
  const nodes = [...currentNodes];
  newNodes.forEach(n => {
    if (!nodes.some(e => e.id === n.id)) nodes.push(n);
  });
  const links = [...currentLinks];
  newLinks.forEach(l => {
    if (
      !links.some(
        e =>
          (e.source === l.source && e.target === l.target) ||
          (e.source === l.target && e.target === l.source)
      )
    )
      links.push(l);
  });
  return { nodes, links };
};

export default function Home() {
  const [graph, setGraph] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const fgRef = useRef(null);

  // --- NEW state and refs for the DOM visual cursor ---
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [cursorOpacity, setCursorOpacity] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const cursorFadeOutTimerRef = useRef(null);
  const cursorRemoveTimerRef = useRef(null);
  // --- End of NEW state and refs ---

  const handleNewGraphData = (g) => {
    setGraph(prev => mergeGraphData(prev, g));
  };

  const handlePinch = useCallback(({ x, y, double }) => {
    if (!fgRef.current || !graph) return;

    const camera = fgRef.current.camera();
    if (!camera) {
        console.warn("Camera not available from fgRef");
        return;
    }
    const scene = fgRef.current.scene();
    if (!scene) {
        console.warn("Scene not available from fgRef");
        return;
    }

    const raycaster = new THREE.Raycaster();
    const ndc = { x: ((1 - x) - 0.5) * 2, y: -(y - 0.5) * 2 };
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hit = intersects.find(i => i.object.userData?.node);
    if (!hit) return;
    const node = hit.object.userData.node;

    const nodePosition = node.__threeObj ? node.__threeObj.position : { x: node.x || 0, y: node.y || 0, z: node.z || 0 };

    if (double) {
      console.log("Double pinch on node:", node);
      const distance = 150;
      const offsetDistance = distance / Math.sqrt(3);
      fgRef.current.cameraPosition(
        {
          x: nodePosition.x + offsetDistance,
          y: nodePosition.y + offsetDistance,
          z: nodePosition.z + offsetDistance,
        }, 
        nodePosition, 
        1000 
      );
    } else {
      const distance = 60;
      const offsetDistance = distance / Math.sqrt(3);
      fgRef.current.cameraPosition(
        {
          x: nodePosition.x + offsetDistance, 
          y: nodePosition.y + offsetDistance,
          z: nodePosition.z + offsetDistance
        },
        nodePosition, 
        400 
      );
    }
  }, [graph]);

  const handleHoverPinchMove = useCallback(({ x, y }) => {
    let newHoverId = null;
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      const scene = fgRef.current.scene();

      if (camera && scene) {
        const raycaster = new THREE.Raycaster();
        const ndc = { x: ((1 - x) - 0.5) * 2, y: -(y - 0.5) * 2 };
        raycaster.setFromCamera(ndc, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const hit = intersects.find(i => i.object.userData?.node);
        newHoverId = hit ? hit.object.userData.node.id : null;
      } else {
        setCursorOpacity(0);
        if (cursorRemoveTimerRef.current) clearTimeout(cursorRemoveTimerRef.current);
        cursorRemoveTimerRef.current = setTimeout(() => setIsCursorVisible(false), CURSOR_FADE_DURATION_MS);
      }
    }
    if (hoverId !== newHoverId) {
      setHoverId(newHoverId);
    }

    setCursorPosition({ x, y });
    setIsCursorVisible(true);

    requestAnimationFrame(() => {
      setCursorOpacity(1);
    });

    if (cursorFadeOutTimerRef.current) clearTimeout(cursorFadeOutTimerRef.current);
    if (cursorRemoveTimerRef.current) clearTimeout(cursorRemoveTimerRef.current);

    cursorFadeOutTimerRef.current = setTimeout(() => {
      setCursorOpacity(0);

      cursorRemoveTimerRef.current = setTimeout(() => {
        setIsCursorVisible(false);
      }, CURSOR_FADE_DURATION_MS);
    }, HIDE_CURSOR_AFTER_MS);

  }, [hoverId]);

  useEffect(() => {
    if (hoverId !== null) {
      // console.log(`app/page.js: Now hovering over node ID: ${hoverId}`);
    }
  }, [hoverId]);

  useEffect(() => {
    return () => {
      if (cursorFadeOutTimerRef.current) clearTimeout(cursorFadeOutTimerRef.current);
      if (cursorRemoveTimerRef.current) clearTimeout(cursorRemoveTimerRef.current);
    };
  }, []);

  return (
    <>
      <UrlForm onGraph={handleNewGraphData} />
      <Graph3D ref={fgRef} data={graph} hoverId={hoverId} />
      <HandTracker
        onPinch={handlePinch}
        onPinchMove={handleHoverPinchMove}
      />

      {/* --- DOM CURSOR ELEMENT --- */}
      {isCursorVisible && (
        <div
          style={{
            position: 'fixed',
            left: `${cursorPosition.x * 100}%`,
            top: `${cursorPosition.y * 100}%`,
            width: '24px',
            height: '24px',
            backgroundColor: 'rgba(0, 220, 255, 0.4)',
            border: '2px solid rgba(0, 220, 255, 0.8)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: cursorOpacity,
            transition: `opacity ${CURSOR_FADE_DURATION_MS}ms ease-in-out`,
          }}
        />
      )}
      {/* --- END OF DOM CURSOR ELEMENT --- */}
    </>
  );
}