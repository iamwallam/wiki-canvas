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
        console.warn("Camera not available from fgRef for pinch");
        return;
    }
    const scene = fgRef.current.scene();
    if (!scene) {
        console.warn("Scene not available from fgRef for pinch");
        return;
    }

    const raycaster = new THREE.Raycaster();
    // NDC calculation: current is { x: 1 - 2 * x, y: 1 - 2 * y }
    // If HandTracker x,y are 0-1 (top-left origin), canonical is: { x: x * 2 - 1, y: 1 - y * 2 }
    const ndc = { x: 1 - 2 * x, y: 1 - 2 * y };
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hit = intersects.find(i => i.object.userData?.node);
    
    let targetPosition;
    if (hit) {
        const node = hit.object.userData.node;
        targetPosition = node.__threeObj ? node.__threeObj.position.clone() : new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0);
        // console.log("Pinch target node:", node.id);
    } else {
        // Fallback: if no node is hit, zoom towards a point in front of the camera.
        const gazeDirection = new THREE.Vector3();
        camera.getWorldDirection(gazeDirection);
        targetPosition = new THREE.Vector3().addVectors(camera.position, gazeDirection.multiplyScalar(200)); // Target 200 units ahead
        // console.warn("Pinch gesture did not hit a node; targeting point in space.");
    }

    const duration = double ? 1000 : 400;
    const distanceFactor = double ? 150 : 60; // Determines how far the camera is offset

    // Calculate camera offset based on a direction (e.g., diagonally up-right-back from target)
    // This is a simple offset; you might want a more sophisticated one based on current camera orientation.
    const offsetDirection = new THREE.Vector3(1, 1, 1).normalize();
    const cameraTargetPosition = new THREE.Vector3().addVectors(targetPosition, offsetDirection.multiplyScalar(distanceFactor));

    fgRef.current.cameraPosition(
      cameraTargetPosition, 
      targetPosition, 
      duration 
    );
  }, [graph]);

  const handleHoverPinchMove = useCallback(({ x, y }) => {
    let calculatedNewHoverId = null;
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      const scene = fgRef.current.scene();

      if (camera && scene) {
        const raycaster = new THREE.Raycaster();
        // NDC calculation: current is { x: 1 - 2 * x, y: 1 - 2 * y }
        // If HandTracker x,y are 0-1 (top-left origin), canonical is: { x: x * 2 - 1, y: 1 - y * 2 }
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

  }, []); // Empty dependency array: fgRef is stable, setters are stable.

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