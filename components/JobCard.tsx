import React, { useState, useRef, useEffect } from 'react';
import type { Trabajo, Cliente, Vehiculo, JobStatus, Parte } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, ArrowRightIcon, PrinterIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import CrearTrabajoModal from './CrearTrabajoModal';
import type { TallerInfo } from './TallerDashboard';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';
import autoTable from 'jspdf-autotable';

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

    const totalPagado = trabajo.partes
        .filter(p => p.nombre === '__PAGO_REGISTRADO__')
        .reduce((sum, p) => sum + p.precioUnitario, 0);

    const saldoPendiente = trabajo.costoEstimado - totalPagado;

    const generatePDF = () => {
        const doc = new jsPDF();
        const a4Width = doc.internal.pageSize.getWidth();
        const a4Height = doc.internal.pageSize.getHeight();
        const margin = 15;
        const mainTextColor = '#0f172a'; // taller-dark
        const lightTextColor = '#64748b'; // taller-gray
        const primaryColor = '#1e40af'; // taller-primary
        const lightBgColor = '#f1f5f9'; // taller-light

        // --- HEADER ---
        doc.setFillColor(primaryColor);
        doc.rect(0, 0, a4Width, 30, 'F');
        doc.setTextColor('#FFFFFF');
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(tallerInfo.nombre, margin, 15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${tallerInfo.direccion} | Tel: ${tallerInfo.telefono} | CUIT: ${tallerInfo.cuit}`, margin, 22);

        // --- DOCUMENT TITLE ---
        const docTitle = trabajo.status === JobStatusEnum.Presupuesto ? 'PRESUPUESTO' : 'REMITO';
        doc.setTextColor(mainTextColor);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(docTitle, a4Width - margin, 45, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`N°: ${trabajo.id.substring(0, 8)}`, a4Width - margin, 52, { align: 'right' });
        doc.text(`Fecha: ${new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}`, a4Width - margin, 59, { align: 'right' });

        // --- CLIENT & VEHICLE INFO ---
        doc.setFillColor(lightBgColor);
        doc.rect(margin, 70, a4Width - (margin * 2), 35, 'F');
        
        doc.setTextColor(mainTextColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Cliente:', margin + 5, 78);
        doc.text('Vehículo:', (a4Width / 2), 78);

        doc.setFont('helvetica', 'normal');
        doc.text(cliente?.nombre || 'N/A', margin + 5, 85);
        doc.text(cliente?.telefono || '', margin + 5, 92);
        
        const vehicleText = `${vehiculo?.marca || ''} ${vehiculo?.modelo || ''} (${vehiculo?.año || 'N/A'})`;
        doc.text(vehicleText, (a4Width / 2), 85);
        doc.text(`Matrícula: ${vehiculo?.matricula || 'N/A'}`, (a4Width / 2), 92);

        // --- DESCRIPTION ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Descripción del Trabajo:', margin, 115);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const descLines = doc.splitTextToSize(trabajo.descripcion, a4Width - (margin * 2));
        doc.text(descLines, margin, 122);
        
        const lastDescLineY = 122 + (descLines.length * 5);

        // --- PARTS TABLE ---
        const partesSinPagos = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
        const formatCurrencyPDF = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

        if (partesSinPagos.length > 0) {
            autoTable(doc, {
                startY: lastDescLineY + 5,
                head: [['Cantidad', 'Descripción', 'Precio Unit.', 'Subtotal']],
                body: partesSinPagos.map(p => [
                    p.cantidad,
                    p.nombre,
                    formatCurrencyPDF(p.precioUnitario),
                    formatCurrencyPDF(p.cantidad * p.precioUnitario)
                ]),
                theme: 'grid',
                headStyles: {
                    fillColor: primaryColor,
                    textColor: '#FFFFFF',
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: lightBgColor
                },
                styles: {
                    cellPadding: 2,
                    fontSize: 9,
                }
            });
        }
        
        // --- TOTALS ---
        const finalY = (doc as any).lastAutoTable?.finalY || lastDescLineY + 10;
        const totalPartes = partesSinPagos.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
        
        const totalsX = a4Width / 2;
        const valuesX = a4Width - margin;

        doc.setFontSize(10);
        doc.text(`Subtotal Repuestos:`, totalsX, finalY + 10);
        doc.text(formatCurrencyPDF(totalPartes), valuesX, finalY + 10, { align: 'right' });
        doc.text(`Mano de Obra:`, totalsX, finalY + 17);
        doc.text(formatCurrencyPDF(trabajo.costoManoDeObra || 0), valuesX, finalY + 17, { align: 'right' });
        
        doc.setLineWidth(0.5);
        doc.line(totalsX, finalY + 22, valuesX, finalY + 22);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL:`, totalsX, finalY + 29);
        doc.text(formatCurrencyPDF(trabajo.costoEstimado), valuesX, finalY + 29, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        
        // --- FOOTER ---
        const footerText = trabajo.status === JobStatusEnum.Presupuesto
            ? 'Validez del presupuesto: 30 días.'
            : '¡Gracias por su confianza!';

        doc.setLineWidth(0.2);
        doc.line(margin, a4Height - 20, a4Width - margin, a4Height - 20);
        doc.setFontSize(9);
        doc.setTextColor(lightTextColor);
        doc.text(footerText, a4Width / 2, a4Height - 15, { align: 'center' });

        doc.save(`${docTitle.toLowerCase()}-${cliente?.nombre?.replace(' ', '_') || 'cliente'}.pdf`);
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
    
    const getNextStatus = (currentStatus: JobStatus): JobStatus | null => {
        const statusOrder = [JobStatusEnum.Presupuesto, JobStatusEnum.Programado, JobStatusEnum.EnProceso, JobStatusEnum.Finalizado];
        const currentIndex = statusOrder.indexOf(currentStatus);
        if (currentIndex !== -1 && currentIndex < statusOrder.length - 1) {
            return statusOrder[currentIndex + 1];
        }
        return null;
    };
    
    const nextStatus = getNextStatus(trabajo.status);
    const pagos = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__');

    return (
        <>
            <div ref={cardRef} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-taller-secondary/50 dark:border-taller-secondary transition-all duration-300 ${isExpanded ? 'mb-32' : ''}`}>
                <div className="p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm text-taller-dark dark:text-taller-light">{cliente?.nombre || 'Cliente no encontrado'}</p>
                            <p className="text-xs text-taller-gray dark:text-gray-400">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.matricula})` : 'Vehículo no encontrado'}</p>
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
                            {trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__').map((parte, i) => (
                                <li key={i} className="flex justify-between">
                                    <span>{parte.cantidad}x {parte.nombre}</span>
                                    <span>{formatCurrency(parte.cantidad * parte.precioUnitario)}</span>
                                </li>
                            ))}
                            {trabajo.costoManoDeObra ? (
                                <li className="flex justify-between">
                                    <span>Mano de Obra</span>
                                    <span>{formatCurrency(trabajo.costoManoDeObra)}</span>
                                </li>
                            ) : null}
                            <li className="flex justify-between font-bold border-t dark:border-gray-600 pt-1">
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
                    <div>
                         {nextStatus ? (
                            <button
                                onClick={() => onUpdateStatus(trabajo.id, nextStatus)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-taller-primary rounded-md shadow-sm hover:bg-taller-secondary transition-colors"
                            >
                                <span>Mover a {nextStatus}</span>
                                <ArrowRightIcon className="h-3 w-3" />
                            </button>
                        ) : (
                            <p className="text-xs font-semibold text-green-600 dark:text-green-500">Finalizado</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                         <button onClick={generatePDF} className="p-1.5 text-taller-gray dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Imprimir Presupuesto">
                            <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setIsJobModalOpen(true)} className="p-1.5 text-taller-gray dark:text-gray-400 hover:text-taller-secondary dark:hover:text-white" title="Editar Trabajo">
                            <PencilIcon className="h-4 w-4" />
                        </button>
                    </div>
                 </div>
            </div>
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