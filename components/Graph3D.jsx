"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback, useState } from "react";
import SpriteText from "three-spritetext";
import { fontSizeFromWeight } from "@/lib/wiki";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

const dummyData = {
  nodes: [],
  links: []
};

export default function Graph3D({ data }) {
  const fg = useRef();
  const camRef = useRef();
  const rafRef = useRef();
  const [graph, setGraph] = useState(dummyData);
  const fetchedUrlsRef = useRef(new Set());
  const lastClickRef = useRef(0);

  const getSprite = (node) => node.__threeObj;

  const updateLabels = useCallback(() => {
    if (!camRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const distance = camRef.current.position.length();
      const near = 380;
      const far = 820;
      if (!fg.current || !graph?.nodes) return;

      graph.nodes.forEach(node => {
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
  }, [graph]);

  const handleEngineStop = useCallback(() => {
    if (!fg.current) return;
    camRef.current = fg.current.camera();
    const controls = fg.current.controls();
    if (controls) {
      controls.addEventListener('change', updateLabels);
      updateLabels();
    }
  }, [updateLabels]);

  useEffect(() => {
    if (!fg.current) return;
    fg.current.d3Force("charge").strength(-80);
    fg.current.d3Force("link").distance(link =>
      typeof link.distance === "number" ? link.distance : 150
    );
    fg.current.zoomToFit(400);

    return () => {
      const controls = fg.current?.controls();
      if (controls) controls.removeEventListener('change', updateLabels);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
    if (now - lastClickRef.current < 300) {
      if (!node.type) expandNode(node);
    }
    lastClickRef.current = now;
  };

  return (
    <div className="w-screen h-screen">
      <ForceGraph3D
        ref={fg}
        graphData={graph}
        nodeVal="val"
        nodeThreeObjectExtend={false}
        onEngineStop={handleEngineStop}
        onNodeClick={handleNodeClick}
        nodeThreeObject={(node) => {
          const labelText = node.id;
          const label = new SpriteText(labelText);
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
