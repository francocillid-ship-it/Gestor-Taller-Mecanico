
import React, { useState, useRef, useEffect } from 'react';
import type { Trabajo, Vehiculo, Cliente, TallerInfo } from '../types';
import { CurrencyDollarIcon, CalendarDaysIcon, ChevronDownIcon, PrinterIcon, WrenchScrewdriverIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { generateClientPDF } from './pdfGenerator';

interface TrabajoListItemProps {
    trabajo: Trabajo;
    vehiculo?: Vehiculo;
    cliente: Cliente;
    tallerInfo: TallerInfo | null;
}

const getStatusStyles = (status: string) => {
    switch (status) {
        case 'Presupuesto':
            return { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300' };
        case 'Programado':
            return { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300' };
        case 'En Proceso':
            return { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-800 dark:text-orange-300' };
        case 'Finalizado':
            return { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300' };
        default:
            return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300' };
    }
};

const formatCurrency = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
};

const TrabajoListItem: React.FC<TrabajoListItemProps> = ({ trabajo, vehiculo, cliente, tallerInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when expanded with conditional logic
    useEffect(() => {
        if (isExpanded && cardRef.current) {
            const timer = setTimeout(() => {
                const element = cardRef.current;
                if (!element) return;

                const rect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                // Header offset (approx for sticky header in client portal or fixed nav in dashboard)
                const headerOffset = 80;

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
    }, [isExpanded]);
    
    const statusStyles = getStatusStyles(trabajo.status);
    
    const totalPagado = trabajo.partes
        .filter(p => p.nombre === '__PAGO_REGISTRADO__')
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const saldoPendiente = trabajo.costoEstimado - totalPagado;
    const pagos = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');
    const realParts = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
    const hasServices = realParts.some(p => p.isService);

    const handleGeneratePDF = async () => {
        if (!tallerInfo || !cliente || !vehiculo) {
            alert("Faltan datos para generar el PDF. Contacte al taller.");
            return;
        }
        setIsGeneratingPdf(true);
        try {
            await generateClientPDF(trabajo, cliente, vehiculo, tallerInfo, true);
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("No se pudo generar el PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div ref={cardRef} className="bg-white dark:bg-gray-800/80 rounded-lg shadow border dark:border-gray-700 overflow-hidden scroll-mt-24 transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 text-left focus:outline-none z-10 relative bg-inherit"
            >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                        {vehiculo && (
                            <p className="font-bold text-taller-primary text-sm">{vehiculo.marca} {vehiculo.modelo}</p>
                        )}
                        <p className="font-semibold text-taller-dark dark:text-taller-light">{trabajo.descripcion}</p>
                    </div>
                    <div className="flex items-center self-end sm:self-start flex-shrink-0">
                        <span className={`mt-1 sm:mt-0 px-2 py-1 text-xs font-semibold rounded-full ${statusStyles.bg} ${statusStyles.text}`}>
                            {trabajo.status}
                        </span>
                        <ChevronDownIcon className={`h-5 w-5 text-taller-gray dark:text-gray-400 ml-2 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2 text-xs text-taller-gray dark:text-gray-400">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <CalendarDaysIcon className="h-4 w-4" />
                            <span>{new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}</span>
                        </div>
                        {trabajo.kilometraje && (
                            <div className="flex items-center gap-1.5">
                                <MapPinIcon className="h-4 w-4" />
                                <span>{trabajo.kilometraje} km</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        <span className="font-medium text-taller-dark dark:text-gray-300">{formatCurrency(trabajo.costoEstimado)}</span>
                    </div>
                </div>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h4 className="font-semibold text-xs mb-2 text-taller-dark dark:text-taller-light">Detalles del Trabajo:</h4>
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
                        </ul>
                        
                        {pagos.length > 0 && (
                            <div className="mt-3 pt-3 border-t dark:border-gray-700">
                                <h5 className="font-semibold text-xs mb-2 text-taller-dark dark:text-taller-light">Historial de Pagos:</h5>
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

                        <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-1 text-xs">
                            <div className="flex justify-between font-bold text-taller-dark dark:text-taller-light">
                                <span>Total Estimado</span>
                                <span>{formatCurrency(trabajo.costoEstimado)}</span>
                            </div>
                            <div className="flex justify-between text-green-600 dark:text-green-500">
                                <span>Total Pagado</span>
                                <span>{formatCurrency(totalPagado)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-red-600 dark:text-red-500">
                                <span>Saldo Pendiente</span>
                                <span>{formatCurrency(saldoPendiente)}</span>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={handleGeneratePDF} 
                                disabled={!tallerInfo || isGeneratingPdf} 
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-taller-secondary rounded-lg shadow-sm hover:bg-taller-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PrinterIcon className="h-4 w-4"/>
                                {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrabajoListItem;
