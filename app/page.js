"use client";
import { useState, useRef, useCallback } from "react";
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
  const [hoverId, setHoverId] = useState(null);
  const fgRef = useRef(null);

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
    const ndc = { x: (x - 0.5) * 2, y: -(y - 0.5) * 2 };
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

  const handlePinchMove = useCallback(({ x, y }) => {
    if (!fgRef.current) return;

    const camera = fgRef.current.camera();
    const scene = fgRef.current.scene();

    if (!camera || !scene) {
      if (hoverId !== null) setHoverId(null);
      return;
    }

    const raycaster = new THREE.Raycaster();
    const ndc = { x: (x - 0.5) * 2, y: -(y - 0.5) * 2 };
    raycaster.setFromCamera(ndc, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hit = intersects.find(i => i.object.userData?.node);

    if (hit) {
      const nodeId = hit.object.userData.node.id;
      if (hoverId !== nodeId) {
        setHoverId(nodeId);
      }
    } else {
      if (hoverId !== null) {
        setHoverId(null);
      }
    }
  }, [hoverId]);

  return (
    <>
      <UrlForm onGraph={handleNewGraphData} />
      <Graph3D ref={fgRef} data={graph} hoverId={hoverId} />
      <HandTracker onPinch={handlePinch} onPinchMove={handlePinchMove} />
    </>
  );
}