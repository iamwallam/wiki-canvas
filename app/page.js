"use client";
import { useState, useRef } from "react";
import * as THREE from "three";
import Graph3D from "@/components/Graph3D";
import UrlForm from "@/components/UrlForm";
import HandTracker from "@/components/HandTracker";

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
  const fgRef = useRef(null);

  const handleNewGraphData = (g) => {
    setGraph(prev => mergeGraphData(prev, g));
  };

  const handlePinch = ({ x, y, double }) => {
    if (!fgRef.current || !graph) return;
    const camera = fgRef.current.camera();
    const raycaster = new THREE.Raycaster();
    const ndc = { x: (x - 0.5) * 2, y: -(y - 0.5) * 2 };
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(fgRef.current.scene().children, true);
    const hit = intersects.find(i => i.object.userData?.node);
    if (!hit) return;
    const node = hit.object.userData.node;

    // Ensure the node has its 3D coordinates (fx, fy, fz might be set by the physics engine)
    // These might be node.x, node.y, node.z after the layout engine runs.
    // If node.__threeObj is available and represents the node's mesh, its position can be used.
    const nodePosition = node.__threeObj ? node.__threeObj.position : { x: node.x || 0, y: node.y || 0, z: node.z || 0 };

    if (double) {
      // fgRef.current.emit("nodeDoublePinch", node); // 'emit' might also need to be exposed via useImperativeHandle
      // For 'emit', you'd typically handle this by calling a method exposed by Graph3D
      // or by having Graph3D use a prop callback for such events.
      // If 'nodeDoublePinch' is a custom event for react-force-graph, you might need to call
      // a method on fgRef.current that internally calls the graph's emit.
      // For now, let's assume you want to do something like focus or a different interaction.
      // Example: A wider zoom or reset
      console.log("Double pinch on node:", node);
      const distance = 150; // Distance for double pinch zoom
      const offsetDistance = distance / Math.sqrt(3); // So the camera isn't AT the node.
      // A more sophisticated approach would be to move the camera along the vector from current camera position to the node.
      fgRef.current.cameraPosition(
        {
          x: nodePosition.x + offsetDistance,
          y: nodePosition.y + offsetDistance,
          z: nodePosition.z + offsetDistance,
        }, // camera position
        nodePosition, // lookAt ({ x, y, z })
        1000 // transition duration in ms
      );
    } else {
      // Single pinch: Zoom to the node
      const distance = 60; // Desired distance from the node
      const offsetDistance = distance / Math.sqrt(3); // Distribute distance along axes
      // A more sophisticated approach would calculate the offset based on current camera angle,
      // or maintain current camera orientation and just move closer.
      // For simplicity, we set a position slightly offset from the node.
      fgRef.current.cameraPosition(
        {
          x: nodePosition.x + offsetDistance, // Position camera slightly away from the node
          y: nodePosition.y + offsetDistance,
          z: nodePosition.z + offsetDistance
        },
        nodePosition, // Look at the node
        400 // transition duration
      );
    }
  };

  return (
    <>
      <UrlForm onGraph={handleNewGraphData} />
      <Graph3D ref={fgRef} data={graph} />
      <HandTracker onPinch={handlePinch} />
    </>
  );
}