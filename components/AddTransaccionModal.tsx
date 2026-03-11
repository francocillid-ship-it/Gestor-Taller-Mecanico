import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight, FileText, Calendar } from 'lucide-react';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import type { EntidadFinanciera, TransaccionEntidad } from '../types';

interface AddTransaccionModalProps {
    entidad: EntidadFinanciera;
    onClose: () => void;
    onAdd: (transaccion: Omit<TransaccionEntidad, 'id' | 'taller_id' | 'entidad_id'>) => void;
}

const AddTransaccionModal: React.FC<AddTransaccionModalProps> = ({ entidad, onClose, onAdd }) => {
    const [tipo, setTipo] = useState<'deuda' | 'pago'>('deuda');
    const [monto, setMonto] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    const modalRef = React.useRef<HTMLDivElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);

    useSwipeToDismiss({
        onDismiss: onClose,
        modalRef,
        backdropRef,
        enabled: true
    });

    const isDeuda = tipo === 'deuda';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numMonto = parseFloat(monto);
        if (isNaN(numMonto) || numMonto <= 0 || !descripcion.trim() || !fecha) return;

        onAdd({
            tipo,
            monto: numMonto,
            descripcion: descripcion.trim(),
            fecha: new Date(`${fecha}T12:00:00`).toISOString() // Avoid timezone offset issues
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
            <div
                ref={backdropRef}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div
                ref={modalRef}
                className="w-full sm:max-w-md bg-taller-light dark:bg-taller-dark rounded-t-3xl sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] transition-transform duration-300 translate-x-full sm:translate-x-0 sm:translate-y-full animate-in slide-in-from-right sm:slide-in-from-bottom"
            >
                {/* Handle for mobile swipe */}
                <div className="w-full h-1.5 flex justify-center mt-3 sm:hidden shrink-0">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>

                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-taller-dark dark:text-taller-light tracking-tight">Registar Movimiento</h2>
                        <p className="text-sm font-medium text-taller-gray">{entidad.nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0 outline-none focus:ring-2 focus:ring-taller-primary">
                        <X className="h-6 w-6 text-taller-gray" />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-none scrollbar-hide flex-1">
                    <form id="add-transaccion-form" onSubmit={handleSubmit} className="p-6 space-y-6">

                        {/* Tipo de Transacción */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setTipo('deuda')}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${tipo === 'deuda' ? 'border-rose-500 bg-rose-500/5 text-rose-500' : 'border-gray-100 dark:border-gray-800 text-taller-gray hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <ArrowUpRight className="h-6 w-6 mb-1" />
                                <span className="text-sm font-bold">Sumar Deuda</span>
                                <span className="text-[10px] opacity-70">Aumenta el saldo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTipo('pago')}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${tipo === 'pago' ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500' : 'border-gray-100 dark:border-gray-800 text-taller-gray hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                <ArrowDownRight className="h-6 w-6 mb-1" />
                                <span className="text-sm font-bold">Registar Pago</span>
                                <span className="text-[10px] opacity-70">Reduce el saldo</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="text-lg font-bold">$</span> Monto *
                            </label>
                            <input
                                required
                                type="number"
                                min="0.01"
                                step="any"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                className={`w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 rounded-2xl outline-none text-xl font-bold font-mono transition-all
                                ${monto && isDeuda ? 'border-rose-200 focus:border-rose-500 text-rose-600' : ''}
                                ${monto && !isDeuda ? 'border-emerald-200 focus:border-emerald-500 text-emerald-600' : ''}
                                ${!monto ? 'border-gray-200 dark:border-gray-700 focus:border-taller-primary text-taller-dark dark:text-taller-light' : ''}`}
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2 flex items-center gap-2">
                                <FileText className="w-3 h-3" /> Concepto / Descripción *
                            </label>
                            <input
                                required
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-taller-primary outline-none text-sm font-bold text-taller-dark dark:text-taller-light transition-all"
                                placeholder={isDeuda ? "Ej: Repuestos filtro aire, Adelanto quincena" : "Ej: Pago en efectivo, Transferencia"}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-taller-gray uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Fecha *
                            </label>
                            <input
                                required
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-taller-primary outline-none text-sm font-bold text-taller-dark dark:text-taller-light transition-all"
                            />
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 sm:rounded-b-3xl pb-safe">
                    <button
                        type="submit"
                        form="add-transaccion-form"
                        disabled={!monto || !descripcion.trim()}
                        className={`w-full text-white py-4 rounded-2xl font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg
                        ${isDeuda ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
                    >
                        {isDeuda ? 'Confirmar Deuda' : 'Confirmar Pago'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddTransaccionModal;
