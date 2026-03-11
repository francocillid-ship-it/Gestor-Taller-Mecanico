import React, { useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Wallet, UserCircle } from 'lucide-react';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import type { EntidadFinanciera, TransaccionEntidad } from '../types';

interface EntidadLedgerModalProps {
    entidad: EntidadFinanciera;
    transacciones: TransaccionEntidad[];
    onClose: () => void;
    onAddTransaccionClick: (entidad: EntidadFinanciera) => void;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const EntidadLedgerModal: React.FC<EntidadLedgerModalProps> = ({
    entidad,
    transacciones,
    onClose,
    onAddTransaccionClick
}) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    const backdropRef = React.useRef<HTMLDivElement>(null);

    useSwipeToDismiss({
        onDismiss: onClose,
        modalRef,
        backdropRef,
        enabled: true
    });

    // We owe them = Positive saldo
    const weOweThem = entidad.saldo_actual > 0;
    const theyOweUs = entidad.saldo_actual < 0;
    const isBalanced = entidad.saldo_actual === 0;

    const filteredTransacciones = useMemo(() => {
        return transacciones
            .filter(t => t.entidad_id === entidad.id)
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [transacciones, entidad.id]);

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4">
            <div
                ref={backdropRef}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            <div
                ref={modalRef}
                className="w-full sm:max-w-xl bg-taller-light dark:bg-taller-dark rounded-t-3xl sm:rounded-3xl shadow-2xl relative flex flex-col h-[90vh] sm:h-[85vh] transition-transform duration-300 translate-x-full animate-in slide-in-from-right"
            >
                {/* Handle for mobile swipe */}
                <div className="w-full h-1.5 flex justify-center mt-3 sm:hidden shrink-0">
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                </div>

                {/* Header Profile Section */}
                <div className="p-6 pb-8 border-b border-gray-100 dark:border-gray-800 shrink-0 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-taller-primary/10 rounded-2xl">
                                <UserCircle className="h-8 w-8 text-taller-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-taller-dark dark:text-taller-light tracking-tight">{entidad.nombre}</h2>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-taller-gray mt-1">
                                    {entidad.tipo}
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors outline-none focus:ring-2 focus:ring-taller-primary relative -top-2">
                            <X className="h-6 w-6 text-taller-gray" />
                        </button>
                    </div>

                    <div className={`p-5 rounded-2xl flex items-center justify-between shadow-sm
                        ${isBalanced ? 'bg-gray-100 dark:bg-gray-800 text-taller-gray' :
                            weOweThem ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}
                    >
                        <div className="flex items-center gap-3">
                            <Wallet className="h-6 w-6" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                                    {isBalanced ? 'Saldo Saldado' :
                                        weOweThem ? 'Saldo Deudor (Le debemos)' :
                                            'Saldo a Favor (Nos debe)'}
                                </p>
                                <p className="text-2xl font-black font-mono">
                                    {formatCurrency(Math.abs(entidad.saldo_actual))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ledger Content */}
                <div className="flex-1 overflow-y-auto overscroll-none scrollbar-hide bg-gray-50/50 dark:bg-gray-900/50 p-6">
                    <h3 className="text-sm font-black text-taller-dark dark:text-taller-light tracking-tight mb-4 flex items-center justify-between">
                        Historial de Movimientos
                        <span className="text-[10px] font-bold text-taller-gray bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded-full">{filteredTransacciones.length}</span>
                    </h3>

                    <div className="space-y-3">
                        {filteredTransacciones.length > 0 ? (
                            filteredTransacciones.map(t => (
                                <div key={t.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-xl mt-0.5
                                            ${t.tipo === 'deuda' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                            {t.tipo === 'deuda' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-taller-dark dark:text-taller-light">{t.descripcion}</p>
                                            <p className="text-[10px] font-bold text-taller-gray uppercase tracking-wider mt-1.5">
                                                {new Date(t.fecha).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-base font-black font-mono tracking-tight text-right
                                        ${t.tipo === 'deuda' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {t.tipo === 'deuda' ? '+' : '-'}{formatCurrency(t.monto)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 px-4">
                                <p className="text-taller-gray font-medium text-sm">No hay movimientos registrados para esta cuenta.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 sm:rounded-b-3xl pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-none">
                    <button
                        onClick={() => onAddTransaccionClick(entidad)}
                        className="w-full bg-taller-dark dark:bg-taller-light text-taller-light dark:text-taller-dark py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        Registrar Movimiento
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EntidadLedgerModal;
