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
            detector = new window.TextDetector();
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
            if (!capturedImage) {
                stopCamera();
            }
        };
    }, [capturedImage, startCamera, stopCamera]);
    
    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
        
        setIsLoading(true);
        setError(null);

        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        setDetectedTexts([]);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const context = canvas.getContext('2d');
        if (!context) {
            setError("Error al procesar la imagen.");
            setIsLoading(false);
            return;
        }
        
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageDataUrl);
        stopCamera();
        
        const base64Image = imageDataUrl.split(',')[1];

        try {
            const data = await recognizeVehicleDataFromImage(base64Image);
            if (Object.keys(data).length === 0) {
                 setError("No se pudo reconocer ningún dato. Intente con una foto más clara y nítida.");
            } else {
                onDataRecognized(data);
            }
        } catch (err: any) {
            setError(err.message || "Ocurrió un error inesperado.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRetry = () => {
        setCapturedImage(null);
        setError(null);
        setIsLoading(false);
    };

    const scaleX = videoRef.current ? videoRef.current.clientWidth / videoDimensions.width : 0;
    const scaleY = videoRef.current ? videoRef.current.clientHeight / videoDimensions.height : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-full max-w-lg relative text-center">
                <button onClick={onClose} className="absolute top-2 right-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white z-10 bg-white/50 dark:bg-black/50 rounded-full p-1">
                    <XMarkIcon className="h-6 w-6" />
                </button>
                
                <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light mb-2">Escanear Cédula del Vehículo</h2>

                <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
                    {capturedImage ? (
                        <img src={capturedImage} alt="Captura de cédula" className="w-full h-full object-cover" />
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                             {detectedTexts.length > 0 && videoDimensions.width > 0 && (
                                <div className="absolute inset-0">
                                    {detectedTexts.map((text, i) => (
                                        <div
                                            key={i}
                                            className="absolute border-2 border-yellow-400 bg-yellow-400/20"
                                            style={{
                                                left: `${text.boundingBox.x * scaleX}px`,
                                                top: `${text.boundingBox.y * scaleY}px`,
                                                width: `${text.boundingBox.width * scaleX}px`,
                                                height: `${text.boundingBox.height * scaleY}px`,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center text-white">
                            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
                            <p>Analizando imagen...</p>
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                
                <div className="mt-4 flex justify-center items-center h-16">
                   {error && capturedImage ? (
                         <button
                            onClick={handleRetry}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-taller-secondary rounded-lg shadow-md hover:bg-taller-primary"
                        >
                            <ArrowPathIcon className="h-5 w-5"/> Reintentar
                        </button>
                    ) : !capturedImage ? (
                        <button
                            onClick={handleCapture}
                            disabled={isLoading}
                            className="w-16 h-16 bg-taller-primary rounded-full border-4 border-white dark:border-gray-600 shadow-lg flex items-center justify-center mx-auto focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary disabled:opacity-50"
                            aria-label="Tomar foto"
                        >
                            <CameraIcon className="h-8 w-8 text-white" />
                        </button>
                    ) : null}
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
        </div>
    );
};

export default CameraRecognitionModal;