
import React, { useState, useEffect } from 'react';
import type { Cliente, Trabajo, TallerInfo } from '../types';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import TrabajoListItem from './TrabajoListItem';

interface TrabajoHistorialModalProps {
    trabajos: Trabajo[];
    title: string;
    onClose: () => void;
    cliente: Cliente;
    tallerInfo: TallerInfo | null;
}

const TrabajoHistorialModal: React.FC<TrabajoHistorialModalProps> = ({ trabajos, title, onClose, cliente, tallerInfo }) => {
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = React.useRef<HTMLDivElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    useSwipeToDismiss({
        onDismiss: handleClose,
        modalRef,
        backdropRef
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div
                ref={backdropRef}
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                ref={modalRef}
                className={`bg-white dark:bg-gray-800 w-full app-height-mobile sm:h-full sm:max-h-none sm:max-w-2xl sm:rounded-none shadow-xl flex flex-col relative z-10 transform transition-all duration-300 ease-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="safe-top-padding-portal flex justify-between items-center px-4 pb-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-1">
                        <button onClick={handleClose} className="p-1 -ml-2 text-taller-primary dark:text-taller-light active:bg-gray-200 dark:active:bg-gray-700 rounded-full transition-colors flex items-center pr-2">
                            <ChevronLeftIcon className="h-6 w-6" /> <span className="text-[15px] font-semibold -ml-1">Volver</span>
                        </button>
                    </div>
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light truncate">{title}</h2>
                    <div className="w-16"></div>
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
