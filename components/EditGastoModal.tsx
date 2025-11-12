import React, { useState, useEffect } from 'react';
import type { Gasto } from '../types';
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/solid';

interface EditGastoModalProps {
    gasto: Gasto;
    onClose: () => void;
    onUpdateGasto: (gasto: Gasto) => Promise<void>;
}

const EditGastoModal: React.FC<EditGastoModalProps> = ({ gasto, onClose, onUpdateGasto }) => {
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (gasto) {
            setDescripcion(gasto.descripcion);
            const formattedValue = new Intl.NumberFormat('es-AR', { 
                style: 'currency', 
                currency: 'ARS'
            }).format(gasto.monto);
            setMonto(formattedValue);
        }
    }, [gasto]);

    const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const digits = rawValue.replace(/\D/g, '');

        if (digits === '') {
            setMonto('');
            return;
        }
        
        const numberValue = parseInt(digits, 10);
        
        const formattedValue = new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS'
        }).format(numberValue / 100);

        setMonto(formattedValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (descripcion && monto && !isSubmitting) {
            setIsSubmitting(true);
            
            const digits = monto.replace(/\D/g, '');
            const numericValue = parseInt(digits, 10) / 100;

            await onUpdateGasto({
                ...gasto,
                descripcion,
                monto: numericValue
            });
            
            setIsSubmitting(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light flex items-center">
                        <PencilSquareIcon className="h-6 w-6 mr-2 text-taller-primary"/>
                        Editar Gasto
                    </h2>
                    <button onClick={onClose} className="text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"><XMarkIcon className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="edit-descripcion" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Descripción</label>
                        <input 
                            type="text" 
                            id="edit-descripcion" 
                            value={descripcion} 
                            onChange={e => setDescripcion(e.target.value)} 
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-monto" className="block text-sm font-medium text-taller-gray dark:text-gray-400">Monto</label>
                        <input 
                            type="text"
                            inputMode="decimal"
                            id="edit-monto" 
                            value={monto} 
                            onChange={handleMontoChange} 
                            placeholder="$ 0,00"
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary text-taller-dark dark:text-taller-light sm:text-sm" 
                            required
                        />
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary disabled:opacity-50">
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditGastoModal;