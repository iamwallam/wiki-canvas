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
    // Log that the fist gesture was detected
    console.log(`Fist gesture detected (double: ${double}) at x: ${x}, y: ${y}. Actions currently disabled.`);

    // Initial guard clauses remain, in case fgRef or graph is needed for other potential future logic here.
    if (!fgRef.current || !graph) {
      // console.warn("Graph ref or data not available for fist action (actions disabled).");
      return;
    }
    const camera = fgRef.current.camera();
    const scene = fgRef.current.scene();
    if (!camera || !scene) {
      // console.warn("Camera or Scene not available for fist action (actions disabled).");
      return;
    }

    // --- ALL FIST ACTION LOGIC COMMENTED OUT ---
    /*
    const raycaster = new THREE.Raycaster();
    const ndc = { x: 1 - 2 * x, y: 1 - 2 * y };
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hit = intersects.find(i => i.object.userData?.node);

    if (hit) {
      const node = hit.object.userData.node;
      if (double) {
        // Phase 3: Expand Node
        console.log("Double fist on node:", node.id, "(Expand action pending - logic disabled)");
      } else {
        // Phase 2: SINGLE FIST ACTION - ZOOM TO NODE
        console.log("Single fist on node:", node.id, "-> Attempting zoomToNode (logic disabled)");
        // if (fgRef.current && typeof fgRef.current.zoomToNode === 'function') {
        //   fgRef.current.zoomToNode(node, 750); 
        // } else {
        //   console.warn("zoomToNode function not available on fgRef.current.");
        // }
      }
    } else { 
      // NO NODE HIT - Fallback camera movement
      console.log(`Fist action (double: ${double}): No node hit. Fallback camera movement disabled.`);
      // const gazeDirection = new THREE.Vector3();
      // camera.getWorldDirection(gazeDirection);
      // const targetPosition = new THREE.Vector3().addVectors(camera.position, gazeDirection.multiplyScalar(200)); 

      // const duration = double ? 1000 : 400;
      // const distanceFactor = double ? 150 : 60;
      
      // const offsetDirection = new THREE.Vector3(1, 1, 1).normalize();
      // const cameraTargetPosition = new THREE.Vector3().addVectors(targetPosition, offsetDirection.multiplyScalar(distanceFactor));
      
      // if (fgRef.current && typeof fgRef.current.cameraPosition === 'function') {
      //   fgRef.current.cameraPosition(cameraTargetPosition, targetPosition, duration);
      // } else {
      //    console.warn("cameraPosition function not available on fgRef.current for fallback fist action.");
      // }
    }
    */
    // --- END OF COMMENTED OUT FIST ACTION LOGIC ---

  }, [graph]); // Keep `graph` dependency for the initial guard, though not strictly necessary if all logic is out.
               // Could be an empty array [] if the guards are also removed or made unconditional.

  const handleHoverPinchMove = useCallback(({ x, y }) => {
    let calculatedNewHoverId = null;
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      const scene = fgRef.current.scene();

      if (camera && scene) {
        const raycaster = new THREE.Raycaster();
        const ndc = { x: 1 - 2 * x, y: 1 - 2 * y };
        raycaster.setFromCamera(ndc, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const hit = intersects.find(i => i.object.userData?.node);
        calculatedNewHoverId = hit ? hit.object.userData.node.id : null;
      }
    }

    setHoverId(prevHoverId => {
      if (prevHoverId !== calculatedNewHoverId) {
        console.log('[PARENT] hoverId changing. Old:', prevHoverId, 'New:', calculatedNewHoverId);
        return calculatedNewHoverId;
      }
      return prevHoverId;
    });

    // --- Cursor visibility logic ---
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
    // --- End cursor visibility logic ---

  }, []);

  useEffect(() => {
    if (hoverId !== null) {
      // console.log(`app/page.js: Actual hoverId state is now: ${hoverId}`);
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
            left: `${(1 - cursorPosition.x) * 100}%`,
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