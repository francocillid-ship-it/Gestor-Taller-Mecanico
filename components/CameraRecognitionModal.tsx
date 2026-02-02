
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { recognizeVehicleDataFromImage, VehiculoData } from '../gemini';
import { CameraIcon, XMarkIcon, ArrowPathIcon, VideoCameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

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
    const [isPermissionDenied, setIsPermissionDenied] = useState(false);
    const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

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

    const startCamera = useCallback(async () => {
        stopCamera();
        setError(null);
        setIsPermissionDenied(false);
        setDetectedTexts([]);

        let detector: any | null = null;
        if ('TextDetector' in window) {
            detector = new window.TextDetector();
        }

        const detectText = async () => {
            if (!detector || !videoRef.current || videoRef.current.readyState < 2) {
                animationFrameId.current = requestAnimationFrame(detectText);
                return;
            }
            try {
                const texts = await detector.detect(videoRef.current);
                setDetectedTexts(texts);
            } catch (e) { console.error("Text detection failed:", e); }
            animationFrameId.current = requestAnimationFrame(detectText);
        };

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            
            streamRef.current = mediaStream;
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => {
                    if (videoRef.current) setVideoDimensions({ 
                        width: videoRef.current.videoWidth, 
                        height: videoRef.current.videoHeight 
                    });
                };
                await videoRef.current.play();
                
                if (detector) { 
                    animationFrameId.current = requestAnimationFrame(detectText); 
                }
            }
        } catch (err: any) {
            console.error("Error accessing camera:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setIsPermissionDenied(true);
                setError("El acceso a la cámara está bloqueado.");
            } else {
                setError("No se pudo iniciar la cámara. Verifique que no esté en uso.");
            }
        }
    }, [stopCamera]);

    // Intentar arrancar la cámara inmediatamente al abrir
    useEffect(() => {
        if (!capturedImage) {
            startCamera();
        }
        return () => stopCamera();
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
                handleClose();
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
        startCamera();
    };

    const scaleX = videoRef.current ? videoRef.current.clientWidth / videoDimensions.width : 0;
    const scaleY = videoRef.current ? videoRef.current.clientHeight / videoDimensions.height : 0;

    return (
        <div className="fixed inset-0 z-[110] flex justify-center items-center">
             <div 
                className={`fixed inset-0 bg-black/75 transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
                onClick={handleClose}
            />
            <div 
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-full max-w-lg relative text-center z-10 transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
                <button onClick={handleClose} className="absolute top-2 right-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white z-20 bg-white/50 dark:bg-black/50 rounded-full p-1">
                    <XMarkIcon className="h-6 w-6" />
                </button>
                
                <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light mb-2">Escanear Cédula</h2>

                <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden flex flex-col items-center justify-center">
                    {capturedImage ? (
                        <img src={capturedImage} alt="Captura de cédula" className="w-full h-full object-cover" />
                    ) : (
                        <>
                            {isPermissionDenied ? (
                                <div className="p-6 text-center text-white space-y-4">
                                    <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-500" />
                                    <div>
                                        <p className="font-bold text-sm">Permiso de Cámara Denegado</p>
                                        <p className="text-xs text-gray-400 mt-1">Para usar el escáner, debes permitir el acceso en los ajustes de tu navegador:</p>
                                    </div>
                                    <div className="text-[10px] text-left bg-gray-900/50 p-3 rounded border border-gray-700 space-y-2">
                                        <p><strong>Android:</strong> Clic en los 3 puntos ⋮ > Configuración > Configuración de sitios > Cámara > Permitir.</p>
                                        <p><strong>iOS:</strong> Ajustes > Safari > Cámara > Permitir.</p>
                                    </div>
                                    <button 
                                        onClick={startCamera}
                                        className="px-6 py-2 bg-taller-primary text-white font-bold rounded-lg hover:bg-taller-secondary transition-all"
                                    >
                                        Reintentar Autorización
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                                    {detectedTexts.length > 0 && videoDimensions.width > 0 && (
                                        <div className="absolute inset-0 pointer-events-none">
                                            {detectedTexts.map((text, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute border-2 border-taller-primary bg-taller-primary/10 rounded-sm"
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
                                    {!streamRef.current && !error && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/40">
                                            <ArrowPathIcon className="h-8 w-8 animate-spin mb-2" />
                                            <p className="text-xs">Iniciando cámara...</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center text-white z-30">
                            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
                            <p className="font-bold">Analizando Cédula...</p>
                        </div>
                    )}
                </div>

                {error && <p className="text-xs font-bold text-red-500 mt-3 px-4">{error}</p>}
                
                <div className="mt-4 flex justify-center items-center h-16">
                   {error && capturedImage ? (
                         <button
                            onClick={handleRetry}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-taller-primary rounded-full shadow-lg hover:bg-taller-secondary transition-all"
                        >
                            <ArrowPathIcon className="h-5 w-5"/> Reintentar Captura
                        </button>
                    ) : (!capturedImage && streamRef.current) ? (
                        <button
                            onClick={handleCapture}
                            disabled={isLoading}
                            className="w-16 h-16 bg-taller-primary rounded-full border-4 border-white dark:border-gray-700 shadow-xl flex items-center justify-center mx-auto focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary disabled:opacity-50 active:scale-90 transition-all"
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
