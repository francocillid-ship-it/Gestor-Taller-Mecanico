
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/solid';
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
    const geminiEnabled = isGeminiAvailable();

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
            // We use .select().single() to return the created object immediately
            const { data, error: vehiculoError } = await supabase
                .from('vehiculos')
                .insert({ cliente_id: clienteId, marca, modelo, año: yearNumber, matricula })
                .select()
                .single();

            if (vehiculoError) throw vehiculoError;

            onSuccess(data as Vehiculo);
        } catch (err: any) {
            setError(err.message || 'Error al agregar el vehículo.');
        } finally {
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

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80dvh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">Agregar Vehículo</h2>
                        <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center border-b dark:border-gray-600 pb-2 pt-2">
                             <h3 className="text-md font-semibold text-taller-dark dark:text-taller-light">Datos del Vehículo</h3>
                             {geminiEnabled && (
                                <button type="button" onClick={() => setIsCameraModalOpen(true)} className="flex-shrink-0 self-end sm:self-center flex items-center gap-2 px-3 py-1 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50">
                                    <CameraIcon className="h-4 w-4" /> Escanear Cédula
                                </button>
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
                                <label htmlFor="matricula" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Matrícula</label>
                                <input type="text" id="matricula" value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" required />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <div className="pt-4 flex justify-end space-x-3">
                            <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                Cancelar
                            </button>
                            <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                                {isSubmitting ? 'Guardando...' : 'Guardar Vehículo'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {isCameraModalOpen && (
                <CameraRecognitionModal
                    onClose={() => setIsCameraModalOpen(false)}
                    onDataRecognized={handleDataRecognized}
                />
            )}
        </>
    );
};

export default AddVehicleModal;
