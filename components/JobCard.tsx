
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Trabajo, Cliente, Vehiculo, JobStatus, Parte, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PrinterIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, EllipsisVerticalIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import CrearTrabajoModal from './CrearTrabajoModal';
import { supabase } from '../supabaseClient';
import { generateClientPDF } from './pdfGenerator';

interface JobCardProps {
    trabajo: Trabajo;
    cliente: Cliente | undefined;
    vehiculo: Vehiculo | undefined;
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
    clientes: Cliente[];
    onDataRefresh: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus, tallerInfo, clientes, onDataRefresh }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Status Menu State
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [menuCoords, setMenuCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded) {
            const timer = setTimeout(() => {
                cardRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    // Close menu on scroll or resize to prevent it from detaching visually
    useEffect(() => {
        if (isStatusMenuOpen) {
            const handleClose = () => setIsStatusMenuOpen(false);
            // Capture scroll events on any parent container
            document.addEventListener('scroll', handleClose, true);
            window.addEventListener('resize', handleClose);
            return () => {
                document.removeEventListener('scroll', handleClose, true);
                window.removeEventListener('resize', handleClose);
            };
        }
    }, [isStatusMenuOpen]);

    const toggleStatusMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isStatusMenuOpen) {
            setIsStatusMenuOpen(false);
            setMenuCoords(null);
        } else {
             if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const menuHeight = 180; // Estimate for ~4 items

                // If space below is limited, open upwards
                if (spaceBelow < menuHeight) {
                    setMenuCoords({
                        bottom: window.innerHeight - rect.top + 4,
                        left: rect.left
                    });
                } else {
                    setMenuCoords({
                        top: rect.bottom + 4,
                        left: rect.left
                    });
                }
                setIsStatusMenuOpen(true);
            }
        }
    };

    const totalPagado = trabajo.partes
        .filter(p => p.nombre === '__PAGO_REGISTRADO__')
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const saldoPendiente = trabajo.costoEstimado - totalPagado;

    const handleGeneratePDF = async () => {
        if (!cliente || !vehiculo) return;
        setIsGeneratingPdf(true);
        try {
            await generateClientPDF(trabajo, cliente, vehiculo, tallerInfo);
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("No se pudo generar el PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };
    
    const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const digits = rawValue.replace(/\D/g, '');

        if (digits === '') {
            setPaymentAmount('');
            return;
        }
        
        const numberValue = parseInt(digits, 10);
        
        const formattedValue = new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS'
        }).format(numberValue / 100);

        setPaymentAmount(formattedValue);
    };

    const handleAddPayment = async () => {
        const digits = paymentAmount.replace(/\D/g, '');
        const amount = digits ? parseInt(digits, 10) / 100 : 0;

        if (amount <= 0) return;

        const newPayment: Parte = {
            nombre: '__PAGO_REGISTRADO__',
            cantidad: 1,
            precioUnitario: amount,
            fecha: new Date().toISOString()
        };

        const updatedPartes = [...trabajo.partes, newPayment];
        
        const { error } = await supabase
            .from('trabajos')
            .update({ partes: updatedPartes })
            .eq('id', trabajo.id);

        if (error) {
            console.error("Error adding payment:", error);
        } else {
            onDataRefresh();
            setPaymentAmount('');
            setIsAddingPayment(false);
        }
    };

    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || isNaN(val)) return '$ 0,00';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
    };
    
    const pagos = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');
    const realParts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
    const hasServices = realParts.some(p => p.isService);

    return (
        <>
            <div ref={cardRef} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-taller-secondary/50 dark:border-taller-secondary transition-all duration-300 ${isExpanded ? 'mb-4' : ''}`}>
                <div className="p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm text-taller-dark dark:text-taller-light">{cliente?.nombre || 'Cliente no encontrado'}</p>
                            <p className="text-xs text-taller-gray dark:text-gray-400">
                                {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.matricula})` : 'Vehículo no encontrado'}
                            </p>
                            {trabajo.kilometraje && (
                                <p className="text-xs text-taller-gray dark:text-gray-400 mt-0.5 font-medium">
                                    {trabajo.kilometraje} km
                                </p>
                            )}
                        </div>
                         <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white">
                            {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <p className="text-sm mt-2">{trabajo.descripcion}</p>
                </div>
                {isExpanded && (
                    <div className="p-3 border-t dark:border-gray-700">
                        <h4 className="font-semibold text-xs mb-2">Detalles:</h4>
                        <ul className="text-xs space-y-1 text-taller-dark dark:text-gray-300 mb-3">
                            {realParts.map((parte, i) => (
                                parte.isCategory ? (
                                    <li key={i} className="font-semibold text-taller-dark dark:text-taller-light pt-2 first:pt-0">
                                        {parte.nombre}
                                    </li>
                                ) : (
                                    <li key={i} className={`flex justify-between pl-2 ${parte.isService ? 'text-blue-700 dark:text-blue-300 font-medium' : ''}`}>
                                        <span className="flex items-center gap-1">
                                            {parte.isService && <WrenchScrewdriverIcon className="h-3 w-3" />}
                                            {parte.cantidad}x {parte.nombre}
                                        </span>
                                        <span>{formatCurrency(parte.cantidad * parte.precioUnitario)}</span>
                                    </li>
                                )
                            ))}
                            
                            {/* Only show "Mano de Obra" separate line if there are NO services listed individually and there IS a cost (Legacy compatibility) */}
                            {!hasServices && trabajo.costoManoDeObra ? (
                                <li className="flex justify-between pt-2 border-t dark:border-gray-600 mt-2">
                                    <span>Mano de Obra</span>
                                    <span>{formatCurrency(trabajo.costoManoDeObra)}</span>
                                </li>
                            ) : null}

                            <li className="flex justify-between font-bold border-t dark:border-gray-600 pt-1 mt-2">
                                <span>Total Estimado</span>
                                <span>{formatCurrency(trabajo.costoEstimado)}</span>
                            </li>
                             {(trabajo.status === JobStatusEnum.EnProceso || trabajo.status === JobStatusEnum.Finalizado) && (
                                <>
                                    <li className="flex justify-between text-green-600 dark:text-green-500">
                                        <span>Total Pagado</span>
                                        <span>{formatCurrency(totalPagado)}</span>
                                    </li>
                                    <li className="flex justify-between font-bold text-red-600 dark:text-red-500">
                                        <span>Saldo Pendiente</span>
                                        <span>{formatCurrency(saldoPendiente)}</span>
                                    </li>
                                </>
                            )}
                        </ul>
                         {(trabajo.status === JobStatusEnum.EnProceso || trabajo.status === JobStatusEnum.Finalizado) && pagos.length > 0 && (
                            <div className="mt-3 pt-3 border-t dark:border-gray-700">
                                <h5 className="font-semibold text-xs mb-2">Historial de Pagos:</h5>
                                <ul className="text-xs space-y-1.5 text-taller-dark dark:text-gray-300">
                                    {pagos.map((pago, index) => (
                                        <li key={index} className="flex justify-between items-center p-2 bg-taller-light dark:bg-gray-700/50 rounded-md">
                                            <span className="text-taller-gray dark:text-gray-400">Pago del {new Date(pago.fecha!).toLocaleDateString('es-ES')}</span>
                                            <span className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(pago.precioUnitario)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                         )}

                         {(trabajo.status === JobStatusEnum.EnProceso || trabajo.status === JobStatusEnum.Finalizado) && (
                             <div className="text-xs space-y-2 mt-4">
                               {isAddingPayment ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="$ 0,00"
                                            value={paymentAmount}
                                            onChange={handlePaymentAmountChange}
                                            className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-taller-dark dark:text-white"
                                        />
                                        <button onClick={handleAddPayment} className="px-3 py-1 bg-green-500 text-white font-semibold rounded hover:bg-green-600">OK</button>
                                        <button onClick={() => setIsAddingPayment(false)} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500">X</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsAddingPayment(true)}
                                        className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-500 hover:underline"
                                    >
                                        <CurrencyDollarIcon className="h-4 w-4" /> Registrar Pago
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                 <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center justify-between">
                    <div className="relative">
                        <button
                            ref={buttonRef}
                            onClick={toggleStatusMenu}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-taller-primary rounded-md shadow-sm hover:bg-taller-secondary transition-colors"
                        >
                            <span>Cambiar Estado</span>
                            <ChevronDownIcon className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                         <button onClick={handleGeneratePDF} disabled={isGeneratingPdf} className="p-1.5 text-taller-gray dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50" title="Imprimir Presupuesto">
                            <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setIsJobModalOpen(true)} className="p-1.5 text-taller-gray dark:text-gray-400 hover:text-taller-secondary dark:hover:text-white" title="Editar Trabajo">
                            <PencilIcon className="h-4 w-4" />
                        </button>
                    </div>
                 </div>
            </div>
            
            {/* Floating Status Menu Portal */}
            {isStatusMenuOpen && menuCoords && createPortal(
                <div className="fixed inset-0 z-50 flex flex-col" style={{ pointerEvents: 'none' }}>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-transparent" 
                        style={{ pointerEvents: 'auto' }} 
                        onClick={() => setIsStatusMenuOpen(false)}
                    />
                    
                    {/* Menu */}
                    <div 
                        className="fixed w-40 bg-white dark:bg-gray-700 rounded-md shadow-lg border dark:border-gray-600 overflow-hidden"
                        style={{ 
                            top: menuCoords.top, 
                            bottom: menuCoords.bottom, 
                            left: menuCoords.left,
                            pointerEvents: 'auto'
                        }}
                    >
                        {Object.values(JobStatusEnum).map((status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    onUpdateStatus(trabajo.id, status);
                                    setIsStatusMenuOpen(false);
                                }}
                                className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-0 ${
                                    status === trabajo.status
                                        ? 'font-bold text-taller-primary bg-blue-50 dark:bg-blue-900/20'
                                        : 'text-taller-dark dark:text-gray-200'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {isJobModalOpen && (
                <CrearTrabajoModal
                    onClose={() => setIsJobModalOpen(false)}
                    onSuccess={() => {
                        setIsJobModalOpen(false);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                    clientes={clientes}
                    trabajoToEdit={trabajo}
                />
            )}
        </>
    );
};

export default JobCard;
