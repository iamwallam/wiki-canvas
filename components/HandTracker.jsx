"use client";
import { useEffect, useRef } from "react";

export default function HandTracker({
  onHoverPinchMove,
  onTwoHandPinchGesture,
  // onPinch
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsInstanceRef  = useRef(null);
  const cameraInstanceRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  // --- REFS for old action gesture (FIST) logic - COMMENTED OUT ---
  // const isPerformingActionGesture = useRef(false);
  // const actionGestureTriggerTimer = useRef(null);
  // const lastActionGestureFireTime = useRef(0);
  // const actionGestureCooldownTimer = useRef(null);

  // --- CONSTANTS for gesture timing and thresholds ---
  // const MIN_ACTION_GESTURE_HOLD_DURATION = 150;
  // const ACTION_GESTURE_COOLDOWN = 300;
  // const DOUBLE_ACTION_GESTURE_WINDOW = 500;
  // const FIST_FINGERTIP_TO_WRIST_THRESH = 0.15;
  
  const HOVER_PINCH_THRESH = 0.06;

  // --- State Management for Two Hands (NEW) ---
  const handPinchStates = useRef([
    { isPinched: false, x: 0, y: 0, detectedThisFrame: false },
    { isPinched: false, x: 0, y: 0, detectedThisFrame: false }
  ]);
  const twoHandGestureIsActive = useRef(false);

  const onResults = (results) => {
    if (!canvasRef.current || !drawingUtilsRef.current) {
      return;
    }

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.translate(canvasRef.current.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    // const now = Date.now();

    const currentFrameHandData = [
      { isPinched: false, x: 0, y: 0, pinchPointCoords: null, detectedThisFrame: false, landmarks: null },
      { isPinched: false, x: 0, y: 0, pinchPointCoords: null, detectedThisFrame: false, landmarks: null }
    ];

    const twoHandsDetectedThisFrame = results.multiHandLandmarks && results.multiHandLandmarks.length === 2;

    if (results.multiHandLandmarks && drawingUtilsRef.current) {
      for (let i = 0; i < results.multiHandLandmarks.length && i < 2; i++) {
        const landmarks = results.multiHandLandmarks[i];
        currentFrameHandData[i].landmarks = landmarks;
        currentFrameHandData[i].detectedThisFrame = true;

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        if (thumbTip && indexTip) {
          const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
          const isPinchedCurrently = dist < HOVER_PINCH_THRESH;
          
          currentFrameHandData[i].isPinched = isPinchedCurrently;
          currentFrameHandData[i].pinchPointCoords = { x: indexTip.x, y: indexTip.y };
          currentFrameHandData[i].x = indexTip.x;
          currentFrameHandData[i].y = indexTip.y;
        }
      }

      for (let i = 0; i < currentFrameHandData.length; i++) {
        const handData = currentFrameHandData[i];
        if (handData.detectedThisFrame && handData.landmarks) {
          drawingUtilsRef.current.drawConnectors(canvasCtx, handData.landmarks, drawingUtilsRef.current.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
          
          drawingUtilsRef.current.drawLandmarks(canvasCtx, handData.landmarks, { color: '#FF0000', lineWidth: 1, radius: (idx) => (idx === 4 || idx === 8) && handData.isPinched ? 6 : 2 });

          if (handData.isPinched) {
            const pinchColor = '#FFFF00';
            if (handData.landmarks[4]) {
              drawingUtilsRef.current.drawLandmarks(canvasCtx, [handData.landmarks[4]], { color: pinchColor, radius: 6 });
            }
            if (handData.landmarks[8]) {
              drawingUtilsRef.current.drawLandmarks(canvasCtx, [handData.landmarks[8]], { color: pinchColor, radius: 6 });
            }
          }
        }
      }
    }

    const primaryHand = currentFrameHandData[0];

    if (onHoverPinchMove) {
      if (primaryHand.detectedThisFrame && primaryHand.isPinched && primaryHand.pinchPointCoords && !twoHandsDetectedThisFrame) {
        onHoverPinchMove({ 
          x: primaryHand.pinchPointCoords.x, 
          y: primaryHand.pinchPointCoords.y,
          twoHandsDetected: false
        });
      } else if (twoHandsDetectedThisFrame) {
        onHoverPinchMove({ x: 0, y: 0, twoHandsDetected: true });
      } else if (!primaryHand.isPinched && onHoverPinchMove) {
        onHoverPinchMove({ x:0, y:0, twoHandsDetected: false, notPinched: true });
      }
    }

    const hand0Data = currentFrameHandData[0];
    const hand1Data = currentFrameHandData[1];
    
    const hand0Pinched = hand0Data.detectedThisFrame && hand0Data.isPinched && hand0Data.pinchPointCoords;
    const hand1Pinched = hand1Data.detectedThisFrame && hand1Data.isPinched && hand1Data.pinchPointCoords;

    if (hand0Pinched && hand1Pinched && onTwoHandPinchGesture) {
      const gesturePayload = {
        hand0: { x: hand0Data.pinchPointCoords.x, y: hand0Data.pinchPointCoords.y },
        hand1: { x: hand1Data.pinchPointCoords.x, y: hand1Data.pinchPointCoords.y }
      };
      if (!twoHandGestureIsActive.current) {
        twoHandGestureIsActive.current = true;
        onTwoHandPinchGesture({ ...gesturePayload, phase: 'start' });
      } else {
        onTwoHandPinchGesture({ ...gesturePayload, phase: 'move' });
      }
    } else {
      if (twoHandGestureIsActive.current && onTwoHandPinchGesture) {
        twoHandGestureIsActive.current = false;
        const endPayload = {
          hand0: { x: handPinchStates.current[0].x, y: handPinchStates.current[0].y },
          hand1: { x: handPinchStates.current[1].x, y: handPinchStates.current[1].y },
          phase: 'end'
        };
        onTwoHandPinchGesture(endPayload);
      }
    }
    
    for (let i = 0; i < 2; i++) {
      const currentHand = currentFrameHandData[i];
      if (currentHand.detectedThisFrame) {
        handPinchStates.current[i].isPinched = currentHand.isPinched;
        handPinchStates.current[i].x = currentHand.pinchPointCoords ? currentHand.pinchPointCoords.x : handPinchStates.current[i].x;
        handPinchStates.current[i].y = currentHand.pinchPointCoords ? currentHand.pinchPointCoords.y : handPinchStates.current[i].y;
        handPinchStates.current[i].detectedThisFrame = true;
      } else {
        handPinchStates.current[i].isPinched = false;
        handPinchStates.current[i].detectedThisFrame = false;
      }
    }

    canvasCtx.restore();
  };

  useEffect(() => {
    const initializeMediaPipe = async () => {
      if (!videoRef.current) return;

      try {
        const mpHandsModule = await import("@mediapipe/hands");
        const Hands = mpHandsModule.Hands || mpHandsModule.default?.Hands || mpHandsModule.default;

        const mpCameraUtilsModule = await import("@mediapipe/camera_utils");
        const Camera = mpCameraUtilsModule.Camera || mpCameraUtilsModule.default?.Camera || mpCameraUtilsModule.default;

        const mpDrawingUtilsModule = await import("@mediapipe/drawing_utils");
        drawingUtilsRef.current = mpDrawingUtilsModule.default || mpDrawingUtilsModule;

        if (!Hands || !Camera || !drawingUtilsRef.current) {
          console.error("Failed to import one or more MediaPipe modules.");
          return;
        }

        const hands = new Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${mpHandsModule.VERSION}/${f}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        hands.onResults(onResults);
        handsInstanceRef.current = hands;

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && handsInstanceRef.current && canvasRef.current) {
              if (videoRef.current.videoWidth && canvasRef.current.width !== videoRef.current.videoWidth) {
                canvasRef.current.width = videoRef.current.videoWidth;
              }
              if (videoRef.current.videoHeight && canvasRef.current.height !== videoRef.current.videoHeight) {
                canvasRef.current.height = videoRef.current.videoHeight;
              }
              await handsInstanceRef.current.send({ image: videoRef.current });
            }
          },
          width: 320,
          height: 240,
        });
        camera.start();
        cameraInstanceRef.current = camera;

      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    initializeMediaPipe();

    return () => {
      if (cameraInstanceRef.current && typeof cameraInstanceRef.current.stop === 'function') {
        cameraInstanceRef.current.stop();
      }
      if (handsInstanceRef.current && typeof handsInstanceRef.current.close === 'function') {
        handsInstanceRef.current.close();
      }
    };
  }, [onHoverPinchMove, onTwoHandPinchGesture]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '320px',
      height: '240px',
      zIndex: 10000,
      borderRadius: '8px',
      overflow: 'hidden',
      backdropFilter: 'blur(3px)',
    }}>
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
        }}
        width="320px"
        height="240px"
      />
    </div>
  );
}