"use client";
import { useEffect, useRef } from "react";

export default function HandTracker({ onPinch, onPinchMove }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  // --- REFS for action gesture (now FIST) logic ---
  const isPerformingActionGesture = useRef(false); // MODIFIED: Was isPhysicallyPinched
  const actionGestureTriggerTimer = useRef(null);  // MODIFIED: Was pinchActionTriggerTimer
  const lastActionGestureFireTime = useRef(0);     // MODIFIED: Was lastOnPinchFireTime
  const actionGestureCooldownTimer = useRef(null); // MODIFIED: Was pinchActionCooldownTimer

  // --- CONSTANTS for gesture timing and thresholds ---
  const MIN_ACTION_GESTURE_HOLD_DURATION = 150; // MODIFIED: Adjusted for fist
  const ACTION_GESTURE_COOLDOWN = 300;       // MODIFIED: Adjusted for fist
  const DOUBLE_ACTION_GESTURE_WINDOW = 500;  // MODIFIED: Adjusted for fist

  const FIST_FINGERTIP_TO_WRIST_THRESH = 0.15; // NEW: Threshold for fist detection
  const HOVER_PINCH_THRESH = 0.06; // RENAMED: Was PINCH_THRESH, now specific to hover

  const onResults = (res) => {
    if (!canvasRef.current || !drawingUtilsRef.current) {
      return;
    }

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const now = Date.now();

    let isFistDetected = false;
    let isHoverPinchDetected = false;
    let actionTriggerPoint = null; // To store x,y for the action gesture (e.g., wrist)
    let hoverTriggerPoint = null;  // To store x,y for the hover gesture (e.g., index tip)

    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        const landmarks = res.multiHandLandmarks[0]; // Using the first hand for all logic
        const wrist = landmarks[0];         // WRIST
        const thumbTip = landmarks[4];      // THUMB_TIP
        const indexTip = landmarks[8];      // INDEX_FINGER_TIP
        const middleTip = landmarks[12];    // MIDDLE_FINGER_TIP
        const ringTip = landmarks[16];      // RING_FINGER_TIP
        const pinkyTip = landmarks[20];     // PINKY_FINGER_TIP

        // Define trigger points for gestures
        actionTriggerPoint = { x: wrist.x, y: wrist.y };       // Fist action centered on wrist
        hoverTriggerPoint = { x: indexTip.x, y: indexTip.y };  // Hover centered on index tip

        // --- 1. Fist Detection (for Actions) ---
        const distIndexToWrist = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y, (indexTip.z || 0) - (wrist.z || 0));
        const distMiddleToWrist = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y, (middleTip.z || 0) - (wrist.z || 0));
        const distRingToWrist = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y, (ringTip.z || 0) - (wrist.z || 0));
        const distPinkyToWrist = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y, (pinkyTip.z || 0) - (wrist.z || 0));

        if (
            distIndexToWrist < FIST_FINGERTIP_TO_WRIST_THRESH &&
            distMiddleToWrist < FIST_FINGERTIP_TO_WRIST_THRESH &&
            distRingToWrist < FIST_FINGERTIP_TO_WRIST_THRESH &&
            distPinkyToWrist < FIST_FINGERTIP_TO_WRIST_THRESH
        ) {
            isFistDetected = true;
        }

        // --- 2. Thumb-Index Pinch Detection (for Hover) ---
        const dxHover = indexTip.x - thumbTip.x;
        const dyHover = indexTip.y - thumbTip.y;
        const distHover = Math.hypot(dxHover, dyHover); // No Z for 2D screen pinch hover
        if (distHover < HOVER_PINCH_THRESH) {
            isHoverPinchDetected = true;
        }

        // --- 3. Drawing Logic ---
        // a. Connections
        drawingUtilsRef.current.drawConnectors(canvasCtx, landmarks, drawingUtilsRef.current.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });

        // b. "Other" landmarks (not wrist or any fingertips)
        const landmarkIndicesToExclude = [0, 4, 8, 12, 16, 20]; // Wrist and all 5 fingertips
        const otherNodesToDraw = landmarks.filter((lm, index) => !landmarkIndicesToExclude.includes(index));
        drawingUtilsRef.current.drawLandmarks(canvasCtx, otherNodesToDraw, { color: '#FF0000', radius: 3 });
        
        // c. Wrist landmark (visual feedback for fist gesture base)
        drawingUtilsRef.current.drawLandmarks(canvasCtx, [wrist], { color: isFistDetected ? '#B8860B' : '#FF0000', radius: isFistDetected ? 5 : 3}); // DarkGoldenRod when fist

        // d. Fingertips for Fist Gesture (Index, Middle, Ring, Pinky)
        let fistFingertipsColor = '#FF0000'; // Default Red
        let fistFingertipsRadius = 3;
        if (isFistDetected) {
            fistFingertipsRadius = 5; // Larger when part of a fist
            if (actionGestureCooldownTimer.current) fistFingertipsColor = '#0077FF'; // Blue: Cooldown
            else if (actionGestureTriggerTimer.current) fistFingertipsColor = '#FFA500'; // Orange: Arming
            else fistFingertipsColor = '#FFFF00'; // Yellow: Physically fisted
        }
        drawingUtilsRef.current.drawLandmarks(canvasCtx, [indexTip, middleTip, ringTip, pinkyTip], { color: fistFingertipsColor, radius: fistFingertipsRadius });

        // e. Thumb Tip for Hover Gesture
        let thumbHoverColor = '#FF0000'; // Default Red
        let thumbHoverRadius = 3;
        if (isHoverPinchDetected) {
            thumbHoverColor = '#90EE90'; // Light Green for active hover pinch
            thumbHoverRadius = 4;
        }
        drawingUtilsRef.current.drawLandmarks(canvasCtx, [thumbTip], { color: thumbHoverColor, radius: thumbHoverRadius });

        // f. Index Tip potentially re-colored for Hover
        // If index tip is part of hover and not in a strong fist signal (orange/blue), show hover color.
        if (isHoverPinchDetected && (!isFistDetected || (!actionGestureCooldownTimer.current && !actionGestureTriggerTimer.current))) {
            drawingUtilsRef.current.drawLandmarks(canvasCtx, [indexTip], { color: '#90EE90', radius: 4 });
        }
        // This ensures index tip shows fist color by default if fisted, then hover color if applicable and not conflicting.
    } // End of if (res.multiHandLandmarks) for detection and drawing

    // --- Action Gesture (Fist) Logic ---
    if (!res.multiHandLandmarks?.length) { // Hand lost
        if (isPerformingActionGesture.current) {
            isPerformingActionGesture.current = false;
            if (actionGestureTriggerTimer.current) {
                clearTimeout(actionGestureTriggerTimer.current);
                actionGestureTriggerTimer.current = null;
            }
        }
    } else { // Hand is present
        if (isFistDetected) {
            if (!isPerformingActionGesture.current && !actionGestureCooldownTimer.current) {
                isPerformingActionGesture.current = true;
                if (actionGestureTriggerTimer.current) clearTimeout(actionGestureTriggerTimer.current);
                actionGestureTriggerTimer.current = setTimeout(() => {
                    const eventTime = Date.now();
                    const isDoubleAction = (eventTime - lastActionGestureFireTime.current) < DOUBLE_ACTION_GESTURE_WINDOW;
                    if (onPinch && actionTriggerPoint) {
                        onPinch({ x: actionTriggerPoint.x, y: actionTriggerPoint.y, double: isDoubleAction });
                    }
                    lastActionGestureFireTime.current = eventTime;
                    actionGestureTriggerTimer.current = null;
                    if (actionGestureCooldownTimer.current) clearTimeout(actionGestureCooldownTimer.current);
                    actionGestureCooldownTimer.current = setTimeout(() => {
                        actionGestureCooldownTimer.current = null;
                    }, ACTION_GESTURE_COOLDOWN);
                }, MIN_ACTION_GESTURE_HOLD_DURATION);
            }
        } else { // Not a fist
            if (isPerformingActionGesture.current) { // Was performing a fist, now released
                isPerformingActionGesture.current = false;
                if (actionGestureTriggerTimer.current) { // If it was arming, cancel it
                    clearTimeout(actionGestureTriggerTimer.current);
                    actionGestureTriggerTimer.current = null;
                }
            }
        }

        // --- Hover Gesture (Thumb-Index Pinch) Logic ---
        if (isHoverPinchDetected && onPinchMove && hoverTriggerPoint) {
            onPinchMove({ x: hoverTriggerPoint.x, y: hoverTriggerPoint.y });
        }
    }
    canvasCtx.restore(); // Called once after all drawing and logic
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
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
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
      // MODIFIED: Clear renamed timers on unmount
      if (actionGestureTriggerTimer.current) {
        clearTimeout(actionGestureTriggerTimer.current);
      }
      if (actionGestureCooldownTimer.current) {
        clearTimeout(actionGestureCooldownTimer.current);
      }
    };
  }, [onPinch, onPinchMove]);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '320px',
      height: '240px',
      zIndex: 1000,
      border: '2px dashed blue'
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
          border: '1px solid red',
        }}
        width="320px"
        height="240px"
      />
    </div>
  );
}