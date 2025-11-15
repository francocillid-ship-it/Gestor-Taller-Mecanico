import React, { useState, useRef, useEffect, useCallback } from 'react';
import { recognizeVehicleDataFromImage, VehiculoData } from '../gemini';
import { CameraIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

// Type definition for the browser's experimental TextDetector API
interface DetectedText {
    boundingBox: DOMRectReadOnly;
    rawValue: string;
}
declare global {
    interface Window {
        TextDetector: new () => {
            detect: (image: ImageBitmapSource) => Promise<DetectedText[]>;
        };
    }
}


interface CameraRecognitionModalProps {
    onClose: () => void;
    onDataRecognized: (data: VehiculoData) => void;
}

const CameraRecognitionModal: React.FC<CameraRecognitionModalProps> = ({ onClose, onDataRecognized }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
    }, []);

    const startCamera = useCallback(() => {
        let isMounted = true;

        if (streamRef.current) {
            return;
        }

        setError(null);
        setDetectedTexts([]);

        let detector: any | null = null;
        if ('TextDetector' in window) {
            try {
               detector = new window.TextDetector();
            } catch(e) {
                console.warn("TextDetector not supported or failed to initialize.", e);
            }
        }

        const detectText = async () => {
            if (!isMounted || !detector || !videoRef.current || videoRef.current.readyState < 2) {
                if (isMounted) animationFrameId.current = requestAnimationFrame(detectText);
                return;
            }
            try {
                const texts = await detector.detect(videoRef.current);
                if (isMounted) setDetectedTexts(texts);
            } catch (e) { console.error("Text detection failed:", e); }
            if (isMounted) animationFrameId.current = requestAnimationFrame(detectText);
        };

        const initCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (!isMounted) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = mediaStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.onloadedmetadata = () => {
                        if (videoRef.current) setVideoDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
                    };
                    await videoRef.current.play();
                    if (detector) { animationFrameId.current = requestAnimationFrame(detectText); }
                }
            } catch (err) {
                if (isMounted) setError("No se pudo acceder a la cámara. Verifique los permisos.");
            }
        };

        initCamera();

        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!capturedImage) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [capturedImage, startCamera, stopCamera]);
    
    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
        
        setIsLoading(true);
        setError(null);

        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        setDetectedTexts([]);

