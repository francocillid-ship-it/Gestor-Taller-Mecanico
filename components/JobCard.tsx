import React, { useState, useRef, useEffect } from 'react';
import type { Trabajo, Cliente, Vehiculo, JobStatus, Parte } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, ArrowPathIcon, PrinterIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import CrearTrabajoModal from './CrearTrabajoModal';
import type { TallerInfo } from './TallerDashboard';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';
import 'jspdf-autotable';

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
                    block: 'nearest',
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

        // Header
        if (tallerInfo.logoUrl) {
            // This is tricky because of CORS. If it's a supabase URL, it might work.
            // For now, let's assume it can be drawn. A try-catch might be better.
            try {
                 // doc.addImage(tallerInfo.logoUrl, 'JPEG', 15, 10, 30, 30);
            } catch (e) {
                console.error("Could not add logo to PDF:", e);
            }
        }
        doc.setFontSize(20);
        doc.text(tallerInfo.nombre, a4Width / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(tallerInfo.direccion, a4Width / 2, 28, { align: 'center' });
        doc.text(`Tel: ${tallerInfo.telefono} | CUIT: ${tallerInfo.cuit}`, a4Width / 2, 36, { align: 'center' });
        
        doc.line(15, 45, a4Width - 15, 45); // horizontal line

        // Job details
        doc.setFontSize(14);
        doc.text(`Presupuesto / Orden de Trabajo N°: ${trabajo.id.substring(0, 8)}`, 15, 55);
        doc.setFontSize(12);
        doc.text(`Fecha: ${new Date(trabajo.fechaEntrada).toLocaleDateString('es-ES')}`, a4Width - 15, 55, { align: 'right' });

        // Client info
        doc.rect(15, 60, a4Width - 30, 25);
        doc.text(`Cliente: ${cliente?.nombre || 'N/A'}`, 20, 68);
        doc.text(`Vehículo: ${vehiculo?.marca || ''} ${vehiculo?.modelo || ''} (${vehiculo?.año || 'N/A'})`, 20, 75);
        doc.text(`Matrícula: ${vehiculo?.matricula || 'N/A'}`, a4Width - 20, 75, { align: 'right' });

        doc.text('Descripción del Problema:', 15, 95);
        const descLines = doc.splitTextToSize(trabajo.descripcion, a4Width - 30);
        doc.text(descLines, 15, 102);

        // Table for parts
        const partesSinPagos = trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__');
        if (partesSinPagos.length > 0) {
            (doc as any).autoTable({
                startY: 120,
                head: [['Cantidad', 'Descripción', 'Precio Unitario', 'Subtotal']],
                body: partesSinPagos.map(p => [
                    p.cantidad,
                    p.nombre,
                    `$ ${p.precioUnitario.toFixed(2)}`,
                    `$ ${(p.cantidad * p.precioUnitario).toFixed(2)}`
                ]),
                theme: 'striped'
            });
        }
        
        // Totals
        const finalY = (doc as any).lastAutoTable.finalY || 120;
        const totalPartes = partesSinPagos.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
        
        doc.setFontSize(12);
        doc.text(`Subtotal Repuestos:`, a4Width - 60, finalY + 10);
        doc.text(`$ ${totalPartes.toFixed(2)}`, a4Width - 15, finalY + 10, { align: 'right' });
        doc.text(`Mano de Obra:`, a4Width - 60, finalY + 18);
        doc.text(`$ ${(trabajo.costoManoDeObra || 0).toFixed(2)}`, a4Width - 15, finalY + 18, { align: 'right' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL:`, a4Width - 60, finalY + 28);
        doc.text(`$ ${trabajo.costoEstimado.toFixed(2)}`, a4Width - 15, finalY + 28, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        doc.save(`presupuesto-${cliente?.nombre}-${vehiculo?.matricula}.pdf`);
    };
    
    const handleAddPayment = async () => {
        const amount = parseFloat(paymentAmount.replace(/[^0-9,-]+/g,"").replace(",", "."));
        if (!amount || amount <= 0) return;

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


    return (
        <>
            <div ref={cardRef} className="bg-white rounded-lg shadow-md border-l-4 border-taller-secondary/50">
                <div className="p-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm text-taller-dark">{cliente?.nombre || 'Cliente no encontrado'}</p>
                            <p className="text-xs text-taller-gray">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.matricula})` : 'Vehículo no encontrado'}</p>
                        </div>
                         <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-taller-gray hover:text-taller-dark">
                            {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <p className="text-sm mt-2">{trabajo.descripcion}</p>
                </div>
                {isExpanded && (
                    <div className="p-3 border-t">
                        <h4 className="font-semibold text-xs mb-2">Detalles:</h4>
                        <ul className="text-xs space-y-1 text-taller-dark mb-3">
                            {trabajo.partes.filter(p => p.nombre !== '__PAGO_REGISTRADO__').map((parte, i) => (
                                <li key={i} className="flex justify-between">
                                    <span>{parte.cantidad}x {parte.nombre}</span>
                                    <span>$ {(parte.cantidad * parte.precioUnitario).toFixed(2)}</span>
                                </li>
                            ))}
                            {trabajo.costoManoDeObra ? (
                                <li className="flex justify-between">
                                    <span>Mano de Obra</span>
                                    <span>$ {trabajo.costoManoDeObra.toFixed(2)}</span>
                                </li>
                            ) : null}
                            <li className="flex justify-between font-bold border-t pt-1">
                                <span>Total Estimado</span>
                                <span>$ {trabajo.costoEstimado.toFixed(2)}</span>
                            </li>
                             <li className="flex justify-between text-green-600">
                                <span>Total Pagado</span>
                                <span>$ {totalPagado.toFixed(2)}</span>
                            </li>
                            <li className="flex justify-between font-bold text-red-600">
                                <span>Saldo Pendiente</span>
                                <span>$ {saldoPendiente.toFixed(2)}</span>
                            </li>
                        </ul>
                         <div className="text-xs space-y-2">
                           {isAddingPayment ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Monto"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                    <button onClick={handleAddPayment} className="px-2 py-1 bg-green-500 text-white rounded">OK</button>
                                    <button onClick={() => setIsAddingPayment(false)} className="px-2 py-1 bg-gray-200 rounded">X</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingPayment(true)}
                                    className="flex items-center gap-1 font-semibold text-green-600 hover:underline"
                                >
                                    <CurrencyDollarIcon className="h-4 w-4" /> Registrar Pago
                                </button>
                            )}
                        </div>
                    </div>
                )}
                 <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                    <div className="relative group">
                        <button className="flex items-center gap-1 text-xs font-semibold text-taller-dark hover:text-taller-primary">
                            <ArrowPathIcon className="h-4 w-4" />
                            {trabajo.status}
                        </button>
                         <div className="absolute bottom-full mb-2 hidden group-hover:block bg-white shadow-lg rounded-md border z-10">
                            {Object.values(JobStatusEnum).map(s => (
                                <button
                                    key={s}
                                    onClick={() => onUpdateStatus(trabajo.id, s)}
                                    className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                         <button onClick={generatePDF} className="p-1.5 text-taller-gray hover:text-blue-600" title="Imprimir Presupuesto">
                            <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setIsJobModalOpen(true)} className="p-1.5 text-taller-gray hover:text-taller-secondary" title="Editar Trabajo">
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