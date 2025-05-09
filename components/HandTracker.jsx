"use client";
import { useEffect, useRef } from "react";

export default function HandTracker({ onPinch, onPinchMove }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  // --- MODIFIED/NEW REFS and constants for pinch action logic ---
  const isPhysicallyPinched = useRef(false);    // Tracks raw physical state of pinch
  const pinchActionTriggerTimer = useRef(null); // Timer to delay firing onPinch
  const lastOnPinchFireTime = useRef(0);        // Timestamp of when the last onPinch ACTION was fired
  const pinchActionCooldownTimer = useRef(null);// Timer for cooldown after an onPinch action

  const MIN_PINCH_HOLD_DURATION = 150; // ms - Pinch must be held this long to be considered an "action"
  const PINCH_ACTION_COOLDOWN = 500;   // ms - Minimum time between two separate onPinch "action" events
  const DOUBLE_PINCH_WINDOW = 550;     // ms - Max time between two onPinch actions to be a double pinch
  // --- End of MODIFIED/NEW REFS and constants ---

  const onResults = (res) => {
    if (!canvasRef.current || !drawingUtilsRef.current) {
      return;
    }

    const canvasCtx = canvasRef.current.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    const now = Date.now(); // Get current time

    // Initialize variables for pinch state and landmark coordinates
    let currentlyPinched = false;
    let firstHandTipIForLogic = null; // To store index tip coords for pinch/move logic

    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
        // Calculate pinch state based on the first detected hand
        const firstHandLandmarks = res.multiHandLandmarks[0];
        const tipI = firstHandLandmarks[8];                         // index-tip
        const tipT = firstHandLandmarks[4];                         // thumb-tip
        firstHandTipIForLogic = tipI; // Store for use in onPinch and onPinchMove

        const dx = tipI.x - tipT.x;
        const dy = tipI.y - tipT.y;
        const dist = Math.hypot(dx, dy);

        const PINCH_THRESH = 0.04; // Using the adjusted threshold
        currentlyPinched = dist < PINCH_THRESH;

        // --- MODIFIED DRAWING LOGIC STARTS ---
        // Iterate through all detected hands for drawing purposes
        for (const landmarks of res.multiHandLandmarks) {
            // 1. Draw connections
            drawingUtilsRef.current.drawConnectors(canvasCtx, landmarks, drawingUtilsRef.current.HAND_CONNECTIONS, {
                color: '#00FF00', // Green lines
                lineWidth: 5,
            });

            // 2. Isolate landmark points for specific coloring
            const thumbTipLandmark = landmarks[4];    // THUMB_TIP
            const indexTipLandmark = landmarks[8];    // INDEX_FINGER_TIP
            // Filter out thumb and index tips to draw them separately
            const otherLandmarks = landmarks.filter((lm, index) => index !== 4 && index !== 8);

            // 3. Draw "other" landmarks with default color
            drawingUtilsRef.current.drawLandmarks(canvasCtx, otherLandmarks, {
                color: '#FF0000', // Default Red
                radius: 3,
            });

            // 4. Determine color and radius for thumb and index fingertips
            let tipColor = '#FF0000'; // Default Red for tips
            let tipRadius = 3;        // Default radius for tips

            // Use the 'currentlyPinched' state (derived from the first hand) for tip coloring.
            // This is acceptable as maxNumHands is 1.
            if (currentlyPinched) {
                tipRadius = 5; // Make active tips slightly larger for emphasis

                if (pinchActionCooldownTimer.current) {
                    tipColor = '#0077FF'; // Blue: Action Cooldown
                } else if (pinchActionTriggerTimer.current) {
                    tipColor = '#FFA500'; // Orange: Action Arming
                } else {
                    tipColor = '#FFFF00'; // Yellow: Physically Pinched (but not arming/cooldown)
                }
            }

            // 5. Draw thumb tip with its determined color and radius
            if (thumbTipLandmark) {
                drawingUtilsRef.current.drawLandmarks(canvasCtx, [thumbTipLandmark], {
                    color: tipColor,
                    radius: tipRadius,
                });
            }

            // 6. Draw index finger tip with its determined color and radius
            if (indexTipLandmark) {
                drawingUtilsRef.current.drawLandmarks(canvasCtx, [indexTipLandmark], {
                    color: tipColor,
                    radius: tipRadius,
                });
            }
        }
        // --- MODIFIED DRAWING LOGIC ENDS ---
    }

    // --- Pinch and Action Logic (uses 'currentlyPinched' and 'firstHandTipIForLogic') ---
    if (!res.multiHandLandmarks?.length) { // Handles hand loss if it was previously pinched
      if (isPhysicallyPinched.current) {
        isPhysicallyPinched.current = false;
        if (pinchActionTriggerTimer.current) {
          clearTimeout(pinchActionTriggerTimer.current);
          pinchActionTriggerTimer.current = null;
        }
      }
    } else { // Hands are present, continue with pinch move and action logic
      // --- Continuous onPinchMove for hover/cursor ---
      if (currentlyPinched && onPinchMove && firstHandTipIForLogic) {
        onPinchMove({ x: firstHandTipIForLogic.x, y: firstHandTipIForLogic.y });
      }

      // --- Logic for discrete onPinch actions (single/double) ---
      if (currentlyPinched) {
        if (!isPhysicallyPinched.current && !pinchActionCooldownTimer.current) {
          isPhysicallyPinched.current = true;
          if (pinchActionTriggerTimer.current) clearTimeout(pinchActionTriggerTimer.current);
          pinchActionTriggerTimer.current = setTimeout(() => {
            const eventTime = Date.now();
            const isDoublePinch = (eventTime - lastOnPinchFireTime.current) < DOUBLE_PINCH_WINDOW;
            if (onPinch && firstHandTipIForLogic) { // Ensure firstHandTipIForLogic is available
              onPinch({ x: firstHandTipIForLogic.x, y: firstHandTipIForLogic.y, double: isDoublePinch });
            }
            lastOnPinchFireTime.current = eventTime;
            pinchActionTriggerTimer.current = null;
            if (pinchActionCooldownTimer.current) clearTimeout(pinchActionCooldownTimer.current);
            pinchActionCooldownTimer.current = setTimeout(() => {
              pinchActionCooldownTimer.current = null;
            }, PINCH_ACTION_COOLDOWN);
          }, MIN_PINCH_HOLD_DURATION);
        }
      } else { // Not currentlyPinched (physically)
        if (isPhysicallyPinched.current) {
          isPhysicallyPinched.current = false;
          if (pinchActionTriggerTimer.current) {
            clearTimeout(pinchActionTriggerTimer.current);
            pinchActionTriggerTimer.current = null;
          }
        }
      }
    }
    canvasCtx.restore();
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
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
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

    // MODIFIED: Added cleanup for new timers
    return () => {
      if (cameraRef.current && typeof cameraRef.current.stop === 'function') {
        cameraRef.current.stop();
      }
      if (handsRef.current && typeof handsRef.current.close === 'function') {
        handsRef.current.close();
      }
      // Clear any pending timers when the component unmounts
      if (pinchActionTriggerTimer.current) {
        clearTimeout(pinchActionTriggerTimer.current);
      }
      if (pinchActionCooldownTimer.current) {
        clearTimeout(pinchActionCooldownTimer.current);
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