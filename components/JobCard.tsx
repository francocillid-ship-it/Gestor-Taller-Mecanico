
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Trabajo, Cliente, Vehiculo, JobStatus, Parte, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PrinterIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, ArrowPathIcon, CalendarIcon, ClockIcon, CheckIcon, ExclamationCircleIcon, ArchiveBoxIcon, ShoppingBagIcon } from '@heroicons/react/24/solid';
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
    isHighlighted?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus, tallerInfo, clientes, onDataRefresh, compactMode, isHighlighted }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState<'items' | 'labor'>('items');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Status Menu State
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false); // Controls CSS animation classes
    const [menuCoords, setMenuCoords] = useState<{ top?: number; bottom?: number; left: number; width: number; placement: 'top' | 'bottom' } | null>(null);
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
    
    // Determine effective view mode derived properties
    // In compact mode, expanded logic means "expand to full card", else "mini card"
    const isCompactMode = compactMode === true;
    const isCollapsedInCompact = isCompactMode && !isExpanded;

    // Lógica para mostrar datos de Presupuesto Rápido si no hay cliente/vehículo real
    const displayClientName = cliente 
        ? `${cliente.nombre} ${cliente.apellido || ''}`.trim() 
        : (trabajo.quickBudgetData ? `${trabajo.quickBudgetData.nombre} ${trabajo.quickBudgetData.apellido || ''}`.trim() : 'Cliente no identificado');

    const displayVehicleInfo = vehiculo 
        ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.matricula})` 
        : (trabajo.quickBudgetData ? `${trabajo.quickBudgetData.marca} ${trabajo.quickBudgetData.modelo} ${trabajo.quickBudgetData.matricula ? `(${trabajo.quickBudgetData.matricula})` : ''}`.trim() : 'Vehículo no identificado');

    const displayVehicleModelOnly = vehiculo 
        ? vehiculo.modelo 
        : (trabajo.quickBudgetData ? trabajo.quickBudgetData.modelo : 'Vehículo');

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

    // Auto-expand if highlighted
    useEffect(() => {
        if (isHighlighted) {
            setIsExpanded(true);
        }
    }, [isHighlighted]);

    useEffect(() => {
        // Apply scroll logic to both normal and compact mode when expanded
        if (isExpanded && cardRef.current) {
            // Esperar a que termine la animación de CSS (300ms)
            const timer = setTimeout(() => {
                const element = cardRef.current;
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                // Asumimos un margen superior seguro (header) de ~80px
                const headerOffset = 80;

                // Condición: Si la parte superior está oculta por el header O la parte inferior se sale de la pantalla
                // Si es Highlighted, forzamos scroll siempre para asegurarnos que se vea
                const isTopHidden = rect.top < headerOffset;
                const isBottomHidden = rect.bottom > windowHeight;

                if (isTopHidden || isBottomHidden || isHighlighted) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [isExpanded, compactMode, isHighlighted]);

    // Close menu on scroll or resize to prevent it from detaching visually
    useEffect(() => {
        if (isStatusMenuOpen) {
            const handleScrollOrResize = () => handleCloseMenu();
            // Capture scroll events on any parent container
            document.addEventListener('scroll', handleScrollOrResize, true);
            window.addEventListener('resize', handleScrollOrResize);
            return () => {
                document.removeEventListener('scroll', handleScrollOrResize, true);
                window.removeEventListener('resize', handleScrollOrResize);
            };
        }
    }, [isStatusMenuOpen]);

    const handleCloseMenu = () => {
        setIsMenuVisible(false); // Start exit animation
        setTimeout(() => {
            setIsStatusMenuOpen(false);
            setMenuCoords(null);
        }, 200); // Wait for duration of transition
    };

    const toggleStatusMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isStatusMenuOpen) {
            handleCloseMenu();
        } else {
             if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const menuHeight = 180; // Estimate for ~4 items

                // If space below is limited, open upwards
                const placement = spaceBelow < menuHeight ? 'top' : 'bottom';

                setMenuCoords({
                    top: placement === 'bottom' ? rect.bottom + 4 : undefined,
                    bottom: placement === 'top' ? window.innerHeight - rect.top + 4 : undefined,
                    left: rect.left,
                    width: rect.width, // Capture button width
                    placement
                });
                setIsStatusMenuOpen(true);
                // Allow DOM to mount before triggering animation
                requestAnimationFrame(() => setIsMenuVisible(true));
            }
        }
    };

    const pagos = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');
    const realParts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');

    // Cálculos de costos desglosados
    // Excluir items pagados directamente por el cliente del costo de repuestos
    const costoRepuestos = realParts
        .filter(p => !p.isService && !p.isCategory && !p.clientPaidDirectly)
        .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

    // Mano de obra: Si hay items de servicio, sumamos solo los NO pagados por cliente
    const servicesSum = realParts
        .filter(p => p.isService && !p.isCategory && !p.clientPaidDirectly)
        .reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);

    const costoManoDeObra = realParts.some(p => p.isService) ? servicesSum : (trabajo.costoManoDeObra || 0);

    const totalA_Cobrar = costoRepuestos + costoManoDeObra;

    // Cálculos de pagos desglosados
    const pagadoItems = pagos
        .filter(p => p.paymentType === 'items')
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const pagadoLabor = pagos
        .filter(p => p.paymentType === 'labor')
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const pagadoGeneral = pagos
        .filter(p => !p.paymentType)
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const totalPagado = pagadoItems + pagadoLabor + pagadoGeneral;
    const saldoPendiente = totalA_Cobrar - totalPagado;

    const handleGeneratePDF = async () => {
        // En presupuestos rápidos el cliente no es un objeto real, pero pdfGenerator puede necesitarlo.
        // Creamos un objeto cliente temporal para el PDF si es un presupuesto rápido
        const pdfClient = cliente || (trabajo.quickBudgetData ? {
            id: 'temp',
            nombre: trabajo.quickBudgetData.nombre,
            apellido: trabajo.quickBudgetData.apellido || '',
            email: '',
            telefono: '',
            vehiculos: []
        } : undefined);

        const pdfVehiculo = vehiculo || (trabajo.quickBudgetData ? {
            id: 'temp',
            marca: trabajo.quickBudgetData.marca,
            modelo: trabajo.quickBudgetData.modelo,
            matricula: trabajo.quickBudgetData.matricula || '',
        } : undefined);

        if (!pdfClient || !pdfVehiculo) return;
        
        setIsGeneratingPdf(true);
        try {
            await generateClientPDF(trabajo, pdfClient as Cliente, pdfVehiculo as Vehiculo, tallerInfo);
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
            fecha: new Date().toISOString(),
            paymentType: paymentType // Guardamos la selección
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
            setPaymentType('items'); // Reset to default
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
    
    const hasServices = realParts.some(p => p.isService);
    
    // Display Logic for Time
    let displayTime = '';
    let displayDate = '';
    if (trabajo.fechaProgramada) {
        const dateObj = new Date(trabajo.fechaProgramada);
        displayDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        displayTime = dateObj.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit', hour12: false});
    }

    // --- CONTAINER CLASSES ---
    const containerClasses = `
        relative
        bg-white dark:bg-gray-800
        rounded-lg
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isCompactMode 
            ? (isExpanded 
                ? 'col-span-2 shadow-lg ring-2 ring-taller-primary/20 z-10' 
                : 'col-span-1 shadow-sm hover:shadow-md cursor-pointer active:scale-[0.98] border border-gray-200 dark:border-gray-700 min-h-[80px]') 
            : `shadow-md border-l-4 ${
                needsScheduling 
                ? 'border-red-500 ring-2 ring-red-100 dark:ring-red-900/20' 
                : (isHighlighted ? 'border-taller-primary ring-2 ring-taller-primary/50' : 'border-taller-secondary/50 dark:border-taller-secondary')
            }`
        }
        ${!isCompactMode && isExpanded ? 'mb-4 ring-2 ring-taller-primary/20 dark:ring-taller-primary/40' : ''}
        ${isHighlighted ? 'animate-pulse-once' : ''} 
    `;

    return (
        <>
            <style>{`
                @keyframes pulse-once {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
                .animate-pulse-once {
                    animation: pulse-once 0.3s ease-out;
                }
            `}</style>
            <div 
                ref={cardRef} 
                className={containerClasses}
                onClick={isCollapsedInCompact ? () => setIsExpanded(true) : undefined}
            >
                <div className={`p-3 ${isCollapsedInCompact ? 'flex flex-col justify-between h-full' : ''}`}>
                    <div 
                        className={`flex justify-between items-start ${!isCollapsedInCompact ? 'cursor-pointer select-none' : ''}`}
                        onClick={(e) => {
                            // If NOT in collapsed-compact mode, this header handles the toggle.
                            // If IS in collapsed-compact mode, parent handles it.
                            if (!isCollapsedInCompact) {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }
                        }}
                    >
                        <div className="flex-1 min-w-0">
                            {/* Client Name */}
                            <div className="flex items-center gap-2">
                                <p className={`font-bold text-taller-dark dark:text-taller-light truncate transition-all duration-300 ${isCollapsedInCompact ? 'text-xs' : 'text-sm'}`}>
                                    {displayClientName}
                                </p>
                                {/* Warning for non-compact view or expanded view */}
                                {!isCollapsedInCompact && needsScheduling && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 animate-pulse">
                                        <ExclamationCircleIcon className="h-3 w-3" /> Falta Agendar
                                    </span>
                                )}
                            </div>
                            
                            {/* Vehicle Info */}
                            <p className={`text-taller-gray dark:text-gray-400 truncate transition-all duration-300 ${isCollapsedInCompact ? 'text-[10px] mt-0.5' : 'text-xs'}`}>
                                {isCollapsedInCompact ? displayVehicleModelOnly : displayVehicleInfo}
                            </p>

                            {/* Full View Date Display (Hidden in collapsed compact mode) */}
                            {!isCollapsedInCompact && isProgramado && trabajo.fechaProgramada && (
                                <p className="text-xs text-taller-primary font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-300">
                                    <ClockIcon className="h-3 w-3" />
                                    {displayDate} - {displayTime}
                                </p>
                            )}
                        </div>

                        {/* Expand Chevron - Only show if NOT in collapsed compact mode (where whole card is click trigger) */}
                        {!isCollapsedInCompact && (
                            <div className="p-1 text-taller-gray dark:text-gray-400 hover:text-taller-dark dark:hover:text-white">
                                {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                            </div>
                        )}
                    </div>

                    {/* Description - Hidden in collapsed compact mode */}
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${!isCollapsedInCompact ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                            <p className="text-sm mt-2">{trabajo.descripcion}</p>
                        </div>
                    </div>

                    {/* Mini View Date Badge - Only visible in collapsed compact mode */}
                    {isCollapsedInCompact && trabajo.fechaProgramada && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CalendarIcon className="h-3 w-3" />
                            <span>{displayDate} {displayTime}</span>
                        </div>
                    )}
                </div>
                
                {/* EXPANDABLE BODY */}
                <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${(!isCompactMode && isExpanded) || (isCompactMode && isExpanded) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
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
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <div className="flex-1 min-w-[130px]">
                                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 truncate">Fecha</label>
                                            <input 
                                                type="date" 
                                                value={scheduleDate} 
                                                onChange={(e) => setScheduleDate(e.target.value)}
                                                className="w-full h-8 text-xs px-2 py-1.5 rounded border dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-taller-primary focus:outline-none appearance-none"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[90px]">
                                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 truncate">Hora (Opcional)</label>
                                            <input 
                                                type="time" 
                                                value={scheduleTime} 
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="w-full h-8 text-xs px-2 py-1.5 rounded border dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-taller-primary focus:outline-none appearance-none"
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
                                {realParts.map((parte, i) => {
                                    const isPaidByClient = parte.clientPaidDirectly;

                                    return parte.isCategory ? (
                                        <li key={i} className="flex justify-between items-center pt-2 first:pt-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-semibold text-taller-dark dark:text-taller-light ${isPaidByClient ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                                                    {parte.nombre}
                                                </span>
                                                {isPaidByClient && <ShoppingBagIcon className="h-3 w-3 text-purple-400" title="Categoría pagada por el cliente" />}
                                            </div>
                                        </li>
                                    ) : (
                                        <li key={i} className={`flex justify-between pl-2 ${parte.isService ? 'text-blue-700 dark:text-blue-300 font-medium' : ''} ${isPaidByClient ? 'opacity-60' : ''}`}>
                                            <span className={`flex items-center gap-1 ${isPaidByClient ? 'line-through decoration-gray-400' : ''}`}>
                                                {parte.isService && <WrenchScrewdriverIcon className="h-3 w-3" />}
                                                {parte.cantidad}x {parte.nombre}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={isPaidByClient ? 'line-through decoration-gray-400' : ''}>
                                                    {formatCurrency(parte.cantidad * parte.precioUnitario)}
                                                </span>
                                                {/* Indicador visual si está pagado por el cliente, pero sin botón de acción */}
                                                {!parte.isService && isPaidByClient && (
                                                    <ShoppingBagIcon className="h-3.5 w-3.5 text-purple-400" title="Pagado por cliente (No computar)" />
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                                
                                {!hasServices && trabajo.costoManoDeObra ? (
                                    <li className="flex justify-between pt-2 border-t dark:border-gray-600 mt-2">
                                        <span>Mano de Obra</span>
                                        <span>{formatCurrency(trabajo.costoManoDeObra)}</span>
                                    </li>
                                ) : null}

                                <li className="flex justify-between text-gray-500 pt-2 border-t dark:border-gray-600 mt-2">
                                    <span>Total Repuestos (Taller)</span>
                                    <span>{formatCurrency(costoRepuestos)}</span>
                                </li>
                                <li className="flex justify-between text-gray-500">
                                    <span>Total Mano de Obra</span>
                                    <span>{formatCurrency(costoManoDeObra)}</span>
                                </li>
                                <li className="flex justify-between font-bold text-taller-dark dark:text-white border-t dark:border-gray-600 pt-1 mt-1">
                                    <span>Total a Cobrar</span>
                                    <span>{formatCurrency(totalA_Cobrar)}</span>
                                </li>
                                
                                {(trabajo.status === JobStatusEnum.EnProceso || trabajo.status === JobStatusEnum.Finalizado) && (
                                    <>
                                        <div className="pt-2 mt-2 border-t dark:border-gray-600">
                                            {pagadoItems > 0 && (
                                                <li className="flex justify-between text-green-600/80 dark:text-green-500/80">
                                                    <span>Pagado (Repuestos)</span>
                                                    <span>{formatCurrency(pagadoItems)}</span>
                                                </li>
                                            )}
                                            {pagadoLabor > 0 && (
                                                <li className="flex justify-between text-green-600/80 dark:text-green-500/80">
                                                    <span>Pagado (Mano Obra)</span>
                                                    <span>{formatCurrency(pagadoLabor)}</span>
                                                </li>
                                            )}
                                            {pagadoGeneral > 0 && (
                                                <li className="flex justify-between text-green-600/80 dark:text-green-500/80">
                                                    <span>Pagado (General)</span>
                                                    <span>{formatCurrency(pagadoGeneral)}</span>
                                                </li>
                                            )}
                                            
                                            <li className="flex justify-between text-green-600 dark:text-green-500 font-semibold border-t dark:border-gray-700 border-dashed mt-1 pt-1">
                                                <span>Total Pagado</span>
                                                <span>{formatCurrency(totalPagado)}</span>
                                            </li>
                                        </div>
                                        
                                        <li className="flex justify-between font-bold text-red-600 dark:text-red-500 mt-1">
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
                                                <div className="flex flex-col">
                                                    <span className="text-taller-gray dark:text-gray-400">
                                                        Pago {new Date(pago.fecha!).toLocaleDateString('es-ES')}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-500 italic">
                                                        {pago.paymentType === 'items' ? '(Repuestos)' : pago.paymentType === 'labor' ? '(Mano de Obra)' : '(General)'}
                                                    </span>
                                                </div>
                                                <span className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(pago.precioUnitario)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(trabajo.status === JobStatusEnum.EnProceso || trabajo.status === JobStatusEnum.Finalizado) && (
                                <div className="text-xs space-y-2 mt-4 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg">
                                {isAddingPayment ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="$ 0,00"
                                                    value={paymentAmount}
                                                    onChange={handlePaymentAmountChange}
                                                    className="w-full px-2 py-1.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-taller-dark dark:text-white"
                                                />
                                            </div>
                                            <div className="flex gap-1 justify-between bg-white dark:bg-gray-800 p-1 rounded border dark:border-gray-600">
                                                <button 
                                                    onClick={() => setPaymentType('items')}
                                                    className={`flex-1 py-1 px-1 text-[10px] sm:text-xs rounded transition-colors flex items-center justify-center gap-1 ${paymentType === 'items' ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    <ArchiveBoxIcon className="h-3 w-3" />
                                                    Repuestos
                                                </button>
                                                <button 
                                                    onClick={() => setPaymentType('labor')}
                                                    className={`flex-1 py-1 px-1 text-[10px] sm:text-xs rounded transition-colors flex items-center justify-center gap-1 ${paymentType === 'labor' ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    <WrenchScrewdriverIcon className="h-3 w-3" />
                                                    M. Obra
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleAddPayment} className="flex-1 px-3 py-1.5 bg-green-500 text-white font-semibold rounded hover:bg-green-600">Registrar</button>
                                                <button onClick={() => setIsAddingPayment(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setIsAddingPayment(true)}
                                            className="w-full flex items-center justify-center gap-1 font-semibold text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 py-1.5 rounded transition-colors"
                                        >
                                            <CurrencyDollarIcon className="h-4 w-4" /> Registrar Nuevo Pago
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Footer Action Bar */}
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
                </div>
            </div>
            
            {/* Floating Status Menu Portal */}
            {isStatusMenuOpen && menuCoords && createPortal(
                <div className="fixed inset-0 z-[9999] flex flex-col" style={{ pointerEvents: 'none' }}>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-transparent" 
                        style={{ pointerEvents: 'auto' }} 
                        onClick={handleCloseMenu}
                    />
                    
                    {/* Menu */}
                    <div 
                        className={`fixed bg-white dark:bg-gray-700 rounded-md shadow-lg border dark:border-gray-600 overflow-hidden transition-all duration-200 ease-out transform
                            ${isMenuVisible
                                ? 'opacity-100 scale-100 translate-y-0'
                                : `opacity-0 scale-95 ${menuCoords.placement === 'bottom' ? '-translate-y-2' : 'translate-y-2'}`
                            }
                            ${menuCoords.placement === 'bottom' ? 'origin-top' : 'origin-bottom'}
                        `}
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
                                    handleCloseMenu();
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
