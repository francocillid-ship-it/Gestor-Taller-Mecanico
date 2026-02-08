
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { XMarkIcon, CameraIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { isGeminiAvailable, VehiculoData } from '../gemini';
import CameraRecognitionModal from './CameraRecognitionModal';
import type { Vehiculo } from '../types';

interface AddVehicleModalProps {
    onClose: () => void;
    onSuccess: (newVehicle?: Vehiculo) => void;
    clienteId: string;
}

const AddVehicleModal: React.FC<AddVehicleModalProps> = ({ onClose, onSuccess, clienteId }) => {
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [año, setAño] = useState('');
    const [matricula, setMatricula] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Check dynamic availability
    const [geminiEnabled, setGeminiEnabled] = useState(isGeminiAvailable());

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    useEffect(() => {
        setGeminiEnabled(isGeminiAvailable());
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        let yearNumber: number | null = null;
        if (año.trim() !== '') {
            yearNumber = parseInt(año);
            if (isNaN(yearNumber) || yearNumber <= 1900 || yearNumber > new Date().getFullYear() + 2) {
                setError('Por favor, ingrese un año válido para el vehículo.');
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const { data, error: vehiculoError } = await supabase
                .from('vehiculos')
                .insert({
                    cliente_id: clienteId,
                    marca: marca.toUpperCase(),
                    modelo: modelo.toUpperCase(),
                    año: yearNumber,
                    matricula: matricula.toUpperCase()
                })
                .select()
                .single();

            if (vehiculoError) throw vehiculoError;

            setIsVisible(false);
            setTimeout(() => onSuccess(data as Vehiculo), 300);
        } catch (err: any) {
            setError(err.message || 'Error al agregar el vehículo.');
            setIsSubmitting(false);
        }
    };

    const handleDataRecognized = (data: VehiculoData) => {
        if (data.marca) setMarca(data.marca.toUpperCase());
        if (data.modelo) setModelo(data.modelo.toUpperCase());
        if (data.año) setAño(data.año);
        if (data.matricula) setMatricula(data.matricula.toUpperCase());
        setIsCameraModalOpen(false);
    };

    const submitForm = () => {
        const form = document.getElementById('vehicle-form') as HTMLFormElement;
        if (form) {
            if (form.requestSubmit) form.requestSubmit();
            else form.submit();
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center sm:p-4">
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                className={`bg-white dark:bg-gray-800 w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'}`}
            >
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">Agregar Vehículo</h2>
                    <button onClick={handleClose} className="p-2 -mr-2 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
                    <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-4 pb-24 sm:pb-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center border-b dark:border-gray-600 pb-2 pt-2">
                            <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Datos del Vehículo</h3>
                            {geminiEnabled ? (
                                <button type="button" onClick={() => setIsCameraModalOpen(true)} className="flex-shrink-0 self-end sm:self-center flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50">
                                    <CameraIcon className="h-4 w-4" /> Escanear Cédula
                                </button>
                            ) : (
                                <span className="text-[10px] text-taller-gray italic flex items-center gap-1 self-end sm:self-center">
                                    <SparklesIcon className="h-3 w-3 text-taller-primary" /> IA no configurada en Ajustes
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="marca" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Marca</label>
                                <input type="text" id="marca" value={marca} onChange={e => setMarca(e.target.value.toUpperCase())} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required />
                            </div>
                            <div>
                                <label htmlFor="modelo" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Modelo</label>
                                <input type="text" id="modelo" value={modelo} onChange={e => setModelo(e.target.value.toUpperCase())} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required />
                            </div>
                            <div>
                                <label htmlFor="año" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Año (Opcional)</label>
                                <input type="number" id="año" value={año} onChange={e => setAño(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="matricula" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula (Opcional)</label>
                                <input type="text" id="matricula" value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </form>
                </div>

                <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800 flex gap-3 shrink-0 z-10 safe-area-bottom">
                    <button type="button" onClick={handleClose} className="flex-1 justify-center py-3 px-4 border border-gray-300 dark:border-gray-500 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                        Cancelar
                    </button>
                    <button type="button" onClick={submitForm} disabled={isSubmitting} className="flex-[2] justify-center py-3 px-6 border border-transparent rounded-xl shadow-lg shadow-taller-primary/30 text-sm font-bold text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                        {isSubmitting ? 'Guardando...' : 'Guardar Vehículo'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(
        <>
            {modalContent}
            {isCameraModalOpen && (
                <CameraRecognitionModal
                    onClose={() => setIsCameraModalOpen(false)}
                    onDataRecognized={handleDataRecognized}
                />
            )}
            <style>{`
                .safe-area-bottom {
                    padding-bottom: var(--safe-bottom);
                }
                @media (min-width: 640px) {
                    .safe-area-bottom {
                        padding-bottom: 1rem;
                    }
                }
            `}</style>
        </>,
        document.body
    );
};

export default AddVehicleModal;
