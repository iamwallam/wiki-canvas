"use client";
import { useState } from "react";
import Graph3D from "@/components/Graph3D";
import UrlForm from "@/components/UrlForm";

export default function Home() {
  const [graph, setGraph] = useState(null);

  return (
    <>
      <UrlForm onGraph={setGraph} />
      <Graph3D data={graph} />
    </>
  );
}