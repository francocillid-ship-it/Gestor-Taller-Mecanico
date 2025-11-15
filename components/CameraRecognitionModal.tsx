import React, { useState, useRef, useEffect, useCallback } from 'react';
import { recognizeVehicleDataFromImage, VehiculoData } from '../gemini';
import { CameraIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface CameraRecognitionModalProps {
    onClose: () => void;
    onDataRecognized: (data: VehiculoData) => void;
}

const CameraRecognitionModal: React.FC<CameraRecognitionModalProps> = ({ onClose, onDataRecognized }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("No se pudo acceder a la cámara. Verifique los permisos.");
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        setIsLoading(true);
        setError(null);

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
        
        // La especificación de toDataURL indica que el segundo parámetro es para la calidad.
        const base64Image = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-full max-w-lg relative text-center">
                <button onClick={onClose} className="absolute top-2 right-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white z-10 bg-white/50 dark:bg-black/50 rounded-full p-1">
                    <XMarkIcon className="h-6 w-6" />
                </button>
                
                <h2 className="text-lg font-bold text-taller-dark dark:text-taller-light mb-2">Escanear Cédula del Vehículo</h2>

                <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center text-white">
                            <ArrowPathIcon className="h-10 w-10 animate-spin mb-2" />
                            <p>Analizando imagen...</p>
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                
                <div className="mt-4">
                    <button
                        onClick={handleCapture}
                        disabled={isLoading}
                        className="w-16 h-16 bg-taller-primary rounded-full border-4 border-white dark:border-gray-600 shadow-lg flex items-center justify-center mx-auto focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-secondary disabled:opacity-50"
                        aria-label="Tomar foto"
                    >
                        <CameraIcon className="h-8 w-8 text-white" />
                    </button>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
        </div>
    );
};

export default CameraRecognitionModal;
