
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Trabajo, Cliente, Vehiculo, JobStatus, Parte, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PrinterIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, ArrowPathIcon, CalendarIcon, ClockIcon, CheckIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
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
    compactMode?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus, tallerInfo, clientes, onDataRefresh, compactMode }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Status Menu State
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    // Added 'width' to coordinates state
    const [menuCoords, setMenuCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    // Schedule Editing State
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleNote, setScheduleNote] = useState('');
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    
    const cardRef = useRef<HTMLDivElement>(null);

    const isProgramado = trabajo.status === JobStatusEnum.Programado;
    // Un trabajo "necesita agenda" si está en Programado pero NO tiene fecha programada asignada
    const needsScheduling = isProgramado && !trabajo.fechaProgramada;
    
    // Determine effective view mode
    // If not in compact mode, expanded logic is just accordion.
    // If in compact mode, expanded logic means "expand to full card", else "mini card"
    const isMiniView = compactMode && !isExpanded;

    useEffect(() => {
        // Initialize fields based on existing data
        if (trabajo) {
            // Use fechaProgramada if available (for scheduling), otherwise don't default to anything for the inputs if it's pending
            const targetDate = trabajo.fechaProgramada ? new Date(trabajo.fechaProgramada) : null;
            
            if (targetDate) {
                // Format YYYY-MM-DD
                const yyyy = targetDate.getFullYear();
                const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDate.getDate()).padStart(2, '0');
                setScheduleDate(`${yyyy}-${mm}-${dd}`);
                
                // Format HH:MM
                const hh = String(targetDate.getHours()).padStart(2, '0');
                const min = String(targetDate.getMinutes()).padStart(2, '0');
                setScheduleTime(`${hh}:${min}`);
            } else {
                setScheduleDate('');
                setScheduleTime('');
            }

            setScheduleNote(trabajo.notaAdicional || '');
        }
    }, [trabajo]);

    useEffect(() => {
        if (isExpanded && cardRef.current && !compactMode) {
            // Esperar a que termine la animación de CSS (300ms)
            const timer = setTimeout(() => {
                const element = cardRef.current;
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                // Asumimos un margen superior seguro (header) de ~80px
                const headerOffset = 80;

                // Condición: Si la parte superior está oculta por el header O la parte inferior se sale de la pantalla
                const isTopHidden = rect.top < headerOffset;
                const isBottomHidden = rect.bottom > windowHeight;

                if (isTopHidden || isBottomHidden) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [isExpanded, compactMode]);

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
                        left: rect.left,
                        width: rect.width // Capture button width
                    });
                } else {
                    setMenuCoords({
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width // Capture button width
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

    const handleSaveSchedule = async () => {
        setIsSavingSchedule(true);
        try {
            if (!scheduleDate) {
                 alert("Debes seleccionar una fecha.");
                 setIsSavingSchedule(false);
                 return;
            }
            
            // Combine Date and Time
            const newDate = new Date(`${scheduleDate}T${scheduleTime || '00:00'}:00`);
            
            const { error } = await supabase
                .from('trabajos')
                .update({ 
                    fecha_programada: newDate.toISOString(),
                    nota_adicional: scheduleNote 
                })
                .eq('id', trabajo.id);

            if (error) throw error;
            onDataRefresh();
        } catch (error) {
            console.error("Error updating schedule:", error);
            alert("Error al actualizar la agenda.");
        } finally {
            setIsSavingSchedule(false);
        }
    };
    
    const formatCurrency = (val: number | undefined) => {
        if (val === undefined || isNaN(val)) return '$ 0,00';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
    };
    
    const pagos = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');
    const realParts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
    const hasServices = realParts.some(p => p.isService);

    const clientFullName = cliente ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() : 'Cliente no encontrado';
    
    // Display Logic for Time
    let displayTime = '';
    let displayDate = '';
    if (trabajo.fechaProgramada) {
        const dateObj = new Date(trabajo.fechaProgramada);
        displayDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        displayTime = dateObj.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit', hour12: false});
    }

    // --- MINI VIEW (Condensed Grid Item) ---
    if (isMiniView) {
        return (
            <div 
                onClick={() => setIsExpanded(true)}
                className="col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] flex flex-col justify-between min-h-[80px]"
            >
                <div>
                    <p className="font-bold text-xs text-taller-dark dark:text-taller-light truncate">{clientFullName}</p>
                    <p className="text-[10px] text-taller-gray dark:text-gray-400 truncate mt-0.5">
                        {vehiculo ? `${vehiculo.modelo}` : 'S/D'}
                    </p>
                </div>
                {trabajo.fechaProgramada && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{displayDate} {displayTime}</span>
                    </div>
                )}
            </div>
        );
    }

    // --- FULL VIEW (Expanded) ---
    // If compactMode is active, this expanded view MUST be col-span-2 to take full width of the grid row
    const containerClasses = compactMode 
        ? "col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 border-taller-secondary ring-2 ring-taller-primary/20 animate-in fade-in zoom-in-95 duration-200"
        : `bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 transition-all duration-300 scroll-mt-4 
           ${isExpanded ? 'mb-4 ring-2 ring-taller-primary/20 dark:ring-taller-primary/40' : ''}
           ${needsScheduling ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-900/20' : 'border-taller-secondary/50 dark:border-taller-secondary'}`;

    return (
        <>
            <div ref={cardRef} className={containerClasses}>
                <div className="p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-sm text-taller-dark dark:text-taller-light">{clientFullName}</p>
                                {needsScheduling && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 animate-pulse">
                                        <ExclamationCircleIcon className="h-3 w-3" /> Falta Agendar
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-taller-gray dark:text-gray-400">
                                {vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.matricula})` : 'Vehículo no encontrado'}
                            </p>
                            {isProgramado && trabajo.fechaProgramada && (
                                <p className="text-xs text-taller-primary font-medium mt-1 flex items-center gap-1">
                                    <ClockIcon className="h-3 w-3" />
                                    {displayDate} - {displayTime}
                                </p>
                            )}
                        </div>
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }} 
                            className="p-1 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white"
                        >
                            {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <p className="text-sm mt-2">{trabajo.descripcion}</p>
                </div>
                
                {/* 
                   In CompactMode, expanded means "Show Full Card" logic immediately. 
                   In StandardMode, expanded triggers the accordion animation.
                   We reuse logic but ensure visibility.
                */}
                <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${(isExpanded || compactMode) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                        <div className="p-3 border-t dark:border-gray-700">
                            
                            {/* --- SECCIÓN DE AGENDA (Solo en Programado) --- */}
                            {isProgramado && (
                                <div className={`mb-4 p-3 rounded-lg border dark:border-gray-600 ${needsScheduling ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className={`font-semibold text-xs flex items-center gap-1 ${needsScheduling ? 'text-red-700 dark:text-red-300' : 'text-taller-dark dark:text-taller-light'}`}>
                                            <CalendarIcon className="h-3.5 w-3.5"/> 
                                            {needsScheduling ? '⚠️ Asignar Fecha del Turno' : 'Agenda del Turno'}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div className="min-w-0">
                                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 truncate">Fecha</label>
                                            <input 
                                                type="date" 
                                                value={scheduleDate} 
                                                onChange={(e) => setScheduleDate(e.target.value)}
                                                className="w-full text-xs px-2 py-1.5 rounded border dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-taller-primary focus:outline-none"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 truncate">Hora (Opcional)</label>
                                            <input 
                                                type="time" 
                                                value={scheduleTime} 
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="w-full text-xs px-2 py-1.5 rounded border dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-taller-primary focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Nota de Agenda (Opcional)</label>
                                        <textarea
                                            value={scheduleNote}
                                            onChange={(e) => setScheduleNote(e.target.value)}
                                            placeholder="Ej: Traer llave de tuerca, llamar antes..."
                                            rows={2}
                                            className="w-full text-xs px-2 py-1.5 rounded border dark:border-gray-600 bg-white dark:bg-gray-700"
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={handleSaveSchedule}
                                            disabled={isSavingSchedule}
                                            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white rounded transition-colors disabled:opacity-50 ${needsScheduling ? 'bg-red-600 hover:bg-red-700' : 'bg-taller-primary hover:bg-taller-secondary'}`}
                                        >
                                            {isSavingSchedule ? <ArrowPathIcon className="h-3 w-3 animate-spin"/> : <CheckIcon className="h-3 w-3"/>}
                                            {needsScheduling ? 'Confirmar Fecha' : 'Actualizar Agenda'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <h4 className="font-semibold text-xs mb-2">Detalles Económicos:</h4>
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
                                
                                {!hasServices && trabajo.costoManoDeObra ? (
                                    <li className="flex justify-between pt-2 border-t dark:border-gray-600 mt-2">
                                        <span>Mano de Obra</span>
                                        <span>{formatCurrency(trabajo.costoManoDeObra)}</span>
                                    </li>
                                ) : null}

                                <li className="flex justify-between font-bold border-t dark:border-gray-600 pt-1 mt-2">
                                    <span>{trabajo.status === JobStatusEnum.Presupuesto ? 'Total Estimado' : 'Total'}</span>
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
                    </div>
                </div>

                 <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center justify-between rounded-b-lg">
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
                            {isGeneratingPdf ? <ArrowPathIcon className="h-4 w-4 animate-spin"/> : <PrinterIcon className="h-4 w-4" />}
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
                        className="fixed bg-white dark:bg-gray-700 rounded-md shadow-lg border dark:border-gray-600 overflow-hidden"
                        style={{ 
                            top: menuCoords.top, 
                            bottom: menuCoords.bottom, 
                            left: menuCoords.left,
                            width: menuCoords.width, // Match button width
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
                                        ? 'font-bold text-taller-primary bg-blue-50 dark:bg-blue-600/30 dark:text-white'
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
