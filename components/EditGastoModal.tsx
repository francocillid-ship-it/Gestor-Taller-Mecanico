
import React, { useState, useEffect } from 'react';
import type { Gasto } from '../types';
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/solid';

interface EditGastoModalProps {
    gasto: Gasto;
    onClose: () => void;
    onUpdateGasto: (gasto: Gasto) => Promise<void>;
}

const CATEGORIAS_GASTO = [
    { id: 'Sueldos', label: 'Sueldos/Planilla' },
    { id: 'Alquiler', label: 'Alquiler/Taller' },
    { id: 'Impuestos', label: 'Impuestos/Tasas' },
    { id: 'Servicios', label: 'Servicios (Luz/Agua)' },
    { id: 'Repuestos', label: 'Repuestos/Insumos' },
    { id: 'Herramientas', label: 'Inversión Herramientas' },
    { id: 'Marketing', label: 'Marketing/Publicidad' },
    { id: 'Otros', label: 'Otros Gastos' },
];

const EditGastoModal: React.FC<EditGastoModalProps> = ({ gasto, onClose, onUpdateGasto }) => {
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState('Otros');
    const [esFijo, setEsFijo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (gasto) {
            setDescripcion(gasto.descripcion);
            setCategoria(gasto.categoria || 'Otros');
            setEsFijo(!!gasto.esFijo);
            const formattedValue = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(gasto.monto);
            setMonto(formattedValue);
        }
        if (!isVisible) {
            const timer = setTimeout(() => setIsVisible(true), 10);
            return () => clearTimeout(timer);
        }
    }, [gasto]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

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
                monto: numericValue,
                categoria,
                esFijo
            });

            setIsSubmitting(false);
            handleClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-0">
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 transform transition-all duration-300 ease-out border border-white/10 ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4 sm:translate-y-0'}`}
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-taller-dark dark:text-taller-light flex items-center">
                        <div className="p-2 bg-taller-primary/10 rounded-lg mr-3">
                            <PencilSquareIcon className="h-6 w-6 text-taller-primary" />
                        </div>
                        Editar Gasto
                    </h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-taller-gray dark:text-gray-400 transition-colors">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="edit-descripcion" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Descripción</label>
                        <input
                            type="text"
                            id="edit-descripcion"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light transition-all outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-monto" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Monto</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                id="edit-monto"
                                value={monto}
                                onChange={handleMontoChange}
                                placeholder="$ 0,00"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light font-mono"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-categoria" className="block text-xs font-bold text-taller-gray dark:text-gray-400 uppercase tracking-wider mb-1">Categoría</label>
                            <select
                                id="edit-categoria"
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-taller-primary focus:border-transparent text-taller-dark dark:text-taller-light outline-none appearance-none"
                            >
                                {CATEGORIAS_GASTO.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <label className="flex items-center group cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={esFijo}
                                    onChange={(e) => setEsFijo(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${esFijo ? 'bg-taller-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${esFijo ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="ml-3 text-sm font-medium text-taller-dark dark:text-taller-light">Es un Gasto Fijo</span>
                        </label>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-3 px-4 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 px-4 bg-taller-primary hover:bg-taller-secondary text-white rounded-xl text-sm font-bold shadow-lg shadow-taller-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditGastoModal;
