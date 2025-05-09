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

  // Ref for two-handed gesture state
  const twoHandBaseMetricsRef = useRef(null); // Stores { distance, centroid, initialCameraQuaternion, initialControlsTarget, etc. }

  const handleNewGraphData = (g) => {
    setGraph(prev => mergeGraphData(prev, g));
  };

  // Old handlePinch (for fist gestures) is kept but will be commented out from HandTracker props
  const handlePinch = useCallback(({ x, y, double }) => {
    console.log(`Fist gesture detected (double: ${double}) at x: ${x}, y: ${y}. Actions currently disabled.`);
    if (!fgRef.current || !graph) { return; }
    const camera = fgRef.current.camera();
    const scene = fgRef.current.scene();
    if (!camera || !scene) { return; }
    // --- ALL FIST ACTION LOGIC REMAINS COMMENTED OUT ---
  }, [graph]);

  const handleHoverPinchMove = useCallback(({ x, y, twoHandsDetected }) => {
    // Only proceed with cursor and hover logic if we don't have two hands detected
    if (twoHandsDetected) {
      setIsCursorVisible(false);
      return;
    }

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

  // --- NEW: Handler for Two-Handed Pinch Gestures ---
  const handleTwoHandPinchGesture = useCallback(({ hand0, hand1, phase }) => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls(); // Assuming OrbitControls

    if (!camera || !controls) {
      console.warn("Camera or Controls not available for two-handed gesture.");
      return;
    }

    console.log("[Pinch Start] Received hand0:", JSON.stringify(hand0), "hand1:", JSON.stringify(hand1));

    const p0 = new THREE.Vector2(hand0.x, hand0.y); 
    const p1 = new THREE.Vector2(hand1.x, hand1.y); 

    console.log("[Pinch Start] Calculated p0:", p0.x, p0.y, "p1:", p1.x, p1.y);

    if (phase === 'start') {
      const distance = p0.distanceTo(p1);
      console.log("[Pinch Start] Calculated distance:", distance);

      const centroidVec = new THREE.Vector2().addVectors(p0, p1).multiplyScalar(0.5);
      console.log("[Pinch Start] Calculated centroid X:", centroidVec.x, "Y:", centroidVec.y);
      
      twoHandBaseMetricsRef.current = {
        distance: distance, 
        centroid: centroidVec, 
      };
      console.log("[Pinch Start] Assigned to twoHandBaseMetricsRef.current:", JSON.stringify(twoHandBaseMetricsRef.current));
      
      // --- UNCOMMENT AND TEST THIS LINE ---
      console.log("[Pinch Start] Attempting controls.saveState()...");
      controls.saveState(); 
      console.log("[Pinch Start] controls.saveState() completed.");
      // --- END OF UNCOMMENTED SECTION ---

      console.log("Two-hand gesture: START processed in page.js (all parts active)");
    } 
    // --- UNCOMMENT 'move' and 'end' phases ---
    else if (phase === 'move' && twoHandBaseMetricsRef.current) {
      console.log("[Pinch Handler] 'move' phase entered."); // Add log for 'move'
      const currentDistance = p0.distanceTo(p1);
      const currentCentroid = new THREE.Vector2().addVectors(p0, p1).multiplyScalar(0.5);
      const base = twoHandBaseMetricsRef.current;

      // --- Zoom Logic (Distance Change) ---
      const deltaDistance = currentDistance - base.distance;
      let ZOOM_SENSITIVITY = -300; // Inverted sensitivity for natural pinch-zoom behavior
      const ZOOM_THRESHOLD = 0.0; // Keep at 0 for now, or small like 0.001 later

      if (Math.abs(deltaDistance) > ZOOM_THRESHOLD) {
          const zoomAmount = deltaDistance * ZOOM_SENSITIVITY;
          console.log(`[Pinch Move] Zooming. DeltaDistance: ${deltaDistance.toFixed(4)}, ZoomAmount (translateZ): ${zoomAmount.toFixed(4)}`);
          camera.translateZ(zoomAmount); 
      }

      // --- Pan Logic (Centroid Movement) ---
      const deltaCentroid = new THREE.Vector2().subVectors(currentCentroid, base.centroid);
      let PAN_SENSITIVITY = 150; // Increased from 10 to 20 for more responsive panning
      const PAN_THRESHOLD = 0.0;

      if (Math.abs(deltaCentroid.x) > PAN_THRESHOLD || Math.abs(deltaCentroid.y) > PAN_THRESHOLD) {
          console.log(`[Pinch Move] Panning, deltaCentroid (raw): dx=${deltaCentroid.x.toFixed(4)}, dy=${deltaCentroid.y.toFixed(4)}`);
          const cameraX = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorldInverse, 0).negate();
          const cameraY = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorldInverse, 1);
          
          // Refined panDistanceFactor:
          // This factor tries to make pan speed consistent regardless of zoom level.
          // It uses the distance to the point the camera is looking at (controls.target).
          let panDistanceFactor = controls.target.distanceTo(camera.position);
          // Clamp the factor to avoid extreme values if too close or too far.
          panDistanceFactor = Math.max(0.5, Math.min(panDistanceFactor * 0.02, 20)); // Tune 0.02 and 20

          console.log(`[Pinch Move] Panning, panDistanceFactor: ${panDistanceFactor.toFixed(4)}`);

          const panOffset = new THREE.Vector3();
          // Note: The sign of deltaCentroid.x might need to be flipped depending on handedness or desired mapping.
          panOffset.addScaledVector(cameraX, -deltaCentroid.x * PAN_SENSITIVITY * panDistanceFactor);
          panOffset.addScaledVector(cameraY, deltaCentroid.y * PAN_SENSITIVITY * panDistanceFactor);
          
          console.log(`[Pinch Move] Panning, panOffset: x=${panOffset.x.toFixed(4)}, y=${panOffset.y.toFixed(4)}, z=${panOffset.z.toFixed(4)}`);

          camera.position.add(panOffset);
          controls.target.add(panOffset);
      }
      
      controls.update(); 

      twoHandBaseMetricsRef.current.distance = currentDistance;
      twoHandBaseMetricsRef.current.centroid.copy(currentCentroid);

    } else if (phase === 'end') {
      console.log("[Pinch Handler] 'end' phase entered.");
      console.log("Two-hand gesture: END processed in page.js");
      twoHandBaseMetricsRef.current = null;
      // controls.reset(); // Optional: Resets to the state saved by saveState()
                          // If you want the camera to stay, don't call reset().
                          // Call controls.update() one last time if not resetting
                          // and if state might have changed that needs final application.
      if(controls && typeof controls.update === 'function' && !twoHandBaseMetricsRef.current /* implying reset wasn't called or we want to finalize */) {
          // It's good practice to call update if controls might have changed
          // but reset() usually handles this implicitly by reverting and updating.
          // If not resetting, a final update might be good.
          // For now, let's test with controls.reset() commented out to see where the gesture leaves the camera.
          // If you enable controls.reset(), it will snap back to where it was at 'start'.
          console.log("[Pinch End] OrbitControls state will remain as is.");
      }
    }
  }, []); // Empty dependency array as fgRef, setters, and refs are stable.

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
        // onPinch={handlePinch} // Old fist gesture handler - COMMENTED OUT
        onHoverPinchMove={handleHoverPinchMove}
        onTwoHandPinchGesture={handleTwoHandPinchGesture} // NEW PROP
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