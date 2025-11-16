import React from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { XMarkIcon } from '@heroicons/react/24/solid';
import TrabajoListItem from './TrabajoListItem';

interface TrabajoHistorialModalProps {
    trabajos: Trabajo[];
    title: string;
    onClose: () => void;
    cliente: Cliente;
    tallerInfo: TallerInfo | null;
}

const TrabajoHistorialModal: React.FC<TrabajoHistorialModalProps> = ({ trabajos, title, onClose, cliente, tallerInfo }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light">{title}</h2>
                    <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-4 space-y-3">
                    {trabajos.length > 0 ? (
                        trabajos.map(trabajo => {
                            const vehiculo = cliente.vehiculos.find(v => v.id === trabajo.vehiculoId);
                            return <TrabajoListItem key={trabajo.id} trabajo={trabajo} vehiculo={vehiculo} cliente={cliente} tallerInfo={tallerInfo} />;
                        })
                    ) : (
                        <p className="text-center text-taller-gray dark:text-gray-400 py-8">No hay trabajos en este historial.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrabajoHistorialModal;
