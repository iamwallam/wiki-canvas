"use client";
import { useEffect, useRef } from "react";

export default function HandTracker({ onPinch, onPinchMove }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const drawingUtilsRef = useRef(null);
  const pinchState = useRef(false);   // current pinch flag
  const lastPinch = useRef(0);        // for double-pinch timing

  /* Pinch detection + callback  */
  const onResults = (res) => {
    if (!canvasRef.current || !drawingUtilsRef.current) {
      return;
    }

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (res.multiHandLandmarks) {
      for (const landmarks of res.multiHandLandmarks) {
        drawingUtilsRef.current.drawConnectors(canvasCtx, landmarks, drawingUtilsRef.current.HAND_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 5,
        });
        drawingUtilsRef.current.drawLandmarks(canvasCtx, landmarks, {
          color: '#FF0000',
          lineWidth: 2,
          radius: 3,
        });
      }
    }
    canvasCtx.restore();

    if (!res.multiHandLandmarks?.length) {
      pinchState.current = false;
      return;
    }
    const lm = res.multiHandLandmarks[0];       // first hand
    const tipI = lm[8];                         // index-tip
    const tipT = lm[4];                         // thumb-tip
    const dx = tipI.x - tipT.x;
    const dy = tipI.y - tipT.y;
    const dist = Math.hypot(dx, dy);

    const PINCH_THRESH = 0.03;                  // tune
    const isPinched = dist < PINCH_THRESH;

    if (isPinched) {
      if (onPinchMove) {
        onPinchMove({ x: tipI.x, y: tipI.y });
      }

      /* rising edge = pinch-start */
      if (!pinchState.current) {
        const now = Date.now();
        const doubleTap = now - lastPinch.current < 350;
        if (onPinch) {
          onPinch({ x: tipI.x, y: tipI.y, double: doubleTap });
        }
        lastPinch.current = now;
      }
    }
    pinchState.current = isPinched;
  };

  useEffect(() => {
    const initializeMediaPipe = async () => {
      if (!videoRef.current) return;

      try {
        // Dynamically import the modules
        // We'll assume the package root correctly exports the class constructor
        // as a 'Hands' property on the default export, or as a named export
        // that dynamic import can resolve.
        const mpHands = await import("@mediapipe/hands");
        const Hands = mpHands.Hands || mpHands.default?.Hands || mpHands.default; // Attempt to find the Hands class

        const mpCameraUtils = await import("@mediapipe/camera_utils");
        const Camera = mpCameraUtils.Camera || mpCameraUtils.default?.Camera || mpCameraUtils.default; // Attempt to find the Camera class

        const mpDrawingUtils = await import("@mediapipe/drawing_utils");
        drawingUtilsRef.current = mpDrawingUtils;

        if (!Hands) {
          console.error("Failed to import Hands class from @mediapipe/hands");
          return;
        }
        if (!Camera) {
          console.error("Failed to import Camera class from @mediapipe/camera_utils");
          return;
        }
        if (!drawingUtilsRef.current) {
          console.error("Failed to import from @mediapipe/drawing_utils");
          return;
        }

        const handsInstance = new Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });

        handsInstance.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        handsInstance.onResults(onResults);
        handsRef.current = handsInstance;

        const cameraInstance = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && handsRef.current && canvasRef.current) {
              if (videoRef.current.videoWidth && canvasRef.current.width !== videoRef.current.videoWidth) {
                canvasRef.current.width = videoRef.current.videoWidth;
              }
              if (videoRef.current.videoHeight && canvasRef.current.height !== videoRef.current.videoHeight) {
                canvasRef.current.height = videoRef.current.videoHeight;
              }
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        cameraInstance.start();
        cameraRef.current = cameraInstance;

      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initializeMediaPipe();

    return () => {
      if (cameraRef.current && typeof cameraRef.current.stop === 'function') {
        cameraRef.current.stop();
      }
      if (handsRef.current && typeof handsRef.current.close === 'function') {
        handsRef.current.close();
      }
    };
  }, [onPinch, onPinchMove]);

  return (
    <div style={{ position: 'relative', width: '640px', height: '480px' }}>
      <video
        ref={videoRef}
        style={{
          display: "none",
        }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: '1px solid lightgray',
        }}
        width="640px"
        height="480px"
      />
    </div>
  );
}