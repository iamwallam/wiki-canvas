"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import Graph3D from "@/components/Graph3D";
import HandTracker from "@/components/HandTracker";
import WelcomePage from "@/components/WelcomePage";

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

  // --- State for Welcome Page and Graph View ---
  const [showWelcomePage, setShowWelcomePage] = useState(true);
  const [isGraphContainerVisible, setIsGraphContainerVisible] = useState(false);

  // --- Visual cursor state ---
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [cursorOpacity, setCursorOpacity] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const cursorFadeOutTimerRef = useRef(null);
  const cursorRemoveTimerRef = useRef(null);
  
  // Ref for two-handed gesture state
  const twoHandBaseMetricsRef = useRef(null);

  const handleNewGraphData = (g) => {
    setGraph(prev => mergeGraphData(prev, g));
  };

  // Function to be called by WelcomePage to load graph
  const loadGraphFromUrl = async (url) => {
    // No need for setIsLoading here as WelcomePage handles its own loading state
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        // This error will be caught by WelcomePage's submit handler
        throw new Error(errorData.error || "Failed to fetch graph data. Please check the URL or try again.");
      }
      const newGraphData = await res.json();
      if (newGraphData.nodes && newGraphData.nodes.length > 0) {
        handleNewGraphData(newGraphData);
        setShowWelcomePage(false); // This will unmount WelcomePage

        // Delay showing graph to allow WelcomePage to unmount and for a smoother visual transition
        setTimeout(() => {
          setIsGraphContainerVisible(true); // Start fading in graph container
        }, 150); // Adjust delay as needed for visual smoothness (e.g., match WelcomePage fade out if it had one)
      } else {
         throw new Error("No graph data found for this URL. It might be a disambiguation page or an invalid link.");
      }
    } catch (error) {
      console.error("Error in loadGraphFromUrl:", error);
      // Re-throw the error so WelcomePage can display it
      throw error;
    }
  };
  
  // Old handlePinch (for fist gestures) is kept but will be commented out from HandTracker props
  const handlePinch = useCallback(({ x, y, double }) => {
    console.log(`Fist gesture detected (double: ${double}) at x: ${x}, y: ${y}. Actions currently disabled.`);
    if (!fgRef.current || !graph) { return; }
    // ... (rest of fist logic remains commented out)
  }, [graph]);

  const handleHoverPinchMove = useCallback(({ x, y, twoHandsDetected }) => {
    if (twoHandsDetected) {
      setIsCursorVisible(false); // Hide cursor if two hands are detected
      setHoverId(null); // Clear hover
      return;
    }

    let calculatedNewHoverId = null;
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      const scene = fgRef.current.scene();
      if (camera && scene) {
        const raycaster = new THREE.Raycaster();
        const ndc = { x: 1 - 2 * x, y: 1 - 2 * y }; // Inverted X for direct mapping
        raycaster.setFromCamera(ndc, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const hit = intersects.find(i => i.object.userData?.node);
        calculatedNewHoverId = hit ? hit.object.userData.node.id : null;
      }
    }

    setHoverId(prevHoverId => {
      if (prevHoverId !== calculatedNewHoverId) {
        return calculatedNewHoverId;
      }
      return prevHoverId;
    });

    const dampingFactor = 0.5; 
    setCursorPosition(prevPos => ({ 
      x: prevPos.x + (x - prevPos.x) * dampingFactor,
      y: prevPos.y + (y - prevPos.y) * dampingFactor 
    }));
    
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
  }, []);

  const handleTwoHandPinchGesture = useCallback(({ hand0, hand1, phase }) => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();

    if (!camera || !controls) return;

    const p0 = new THREE.Vector2(hand0.x, hand0.y); 
    const p1 = new THREE.Vector2(hand1.x, hand1.y); 

    if (phase === 'start') {
      const distance = p0.distanceTo(p1);
      const centroidVec = new THREE.Vector2().addVectors(p0, p1).multiplyScalar(0.5);
      twoHandBaseMetricsRef.current = { distance, centroid: centroidVec };
      controls.saveState(); 
    } else if (phase === 'move' && twoHandBaseMetricsRef.current) {
      const currentDistance = p0.distanceTo(p1);
      const currentCentroid = new THREE.Vector2().addVectors(p0, p1).multiplyScalar(0.5);
      const base = twoHandBaseMetricsRef.current;

      const deltaDistance = currentDistance - base.distance;
      const ZOOM_SENSITIVITY = -300; 
      const zoomAmount = deltaDistance * ZOOM_SENSITIVITY;
      camera.translateZ(zoomAmount); 

      const deltaCentroid = new THREE.Vector2().subVectors(currentCentroid, base.centroid);
      const PAN_SENSITIVITY = 20; // Current pan sensitivity
      let panDistanceFactor = controls.target.distanceTo(camera.position);
      panDistanceFactor = Math.max(0.5, Math.min(panDistanceFactor * 0.02, 20));

      const cameraX = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorldInverse, 0).negate();
      const cameraY = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorldInverse, 1);
      const panOffset = new THREE.Vector3();
      panOffset.addScaledVector(cameraX, -deltaCentroid.x * PAN_SENSITIVITY * panDistanceFactor);
      panOffset.addScaledVector(cameraY, deltaCentroid.y * PAN_SENSITIVITY * panDistanceFactor);
      camera.position.add(panOffset);
      controls.target.add(panOffset);
      
      controls.update(); 
      twoHandBaseMetricsRef.current.distance = currentDistance;
      twoHandBaseMetricsRef.current.centroid.copy(currentCentroid);
    } else if (phase === 'end') {
      twoHandBaseMetricsRef.current = null;
      // controls.reset(); // Optional reset
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cursorFadeOutTimerRef.current) clearTimeout(cursorFadeOutTimerRef.current);
      if (cursorRemoveTimerRef.current) clearTimeout(cursorRemoveTimerRef.current);
    };
  }, []);

  return (
    <>
      {showWelcomePage && <WelcomePage onGraphLoad={loadGraphFromUrl} />}
      
      {!showWelcomePage && graph && ( // Ensure graph data exists before rendering
        <div 
          className={`fixed inset-0 transition-opacity duration-1000 ease-in-out ${isGraphContainerVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          <Graph3D ref={fgRef} data={graph} hoverId={hoverId} />
          <HandTracker
            onHoverPinchMove={handleHoverPinchMove}
            onTwoHandPinchGesture={handleTwoHandPinchGesture}
          />
          {isCursorVisible && (
            <div
              className="fixed w-6 h-6 pointer-events-none z-[10000] bg-blue-500/40 border-2 border-blue-500/80 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-opacity"
              style={{
                left: `${(1 - cursorPosition.x) * 100}%`, // Ensure x is screen coordinate (0-1)
                top: `${cursorPosition.y * 100}%`,    // Ensure y is screen coordinate (0-1)
                opacity: cursorOpacity,
              }}
            />
          )}
        </div>
      )}
    </>
  );
}