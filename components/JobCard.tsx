import React, { useState, useMemo } from 'react';
import type { Trabajo, Cliente, Vehiculo, Parte, Pago } from '../types';
import { JobStatus } from '../types';
import { ChevronDownIcon, ChevronUpIcon, ArrowRightIcon, DocumentArrowDownIcon, PencilIcon, BanknotesIcon } from '@heroicons/react/24/solid';
import type { TallerInfo } from './TallerDashboard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CrearTrabajoModal from './CrearTrabajoModal';
import { supabase } from '../supabaseClient';


interface JobCardProps {
    trabajo: Trabajo;
    cliente?: Cliente;
    vehiculo?: Vehiculo;
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
    clientes: Cliente[];
    onDataRefresh: () => void;
}

const PAGO_ID = '__PAGO_REGISTRADO__';

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus, tallerInfo, clientes, onDataRefresh }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [pagoMonto, setPagoMonto] = useState('');
    const [isAddingPago, setIsAddingPago] = useState(false);
    
    const pagos = useMemo((): Pago[] =>
        trabajo.partes
            .filter(p => p.nombre === PAGO_ID)
            .map(p => ({
                fecha: p.fecha!,
                monto: p.precioUnitario
            })),
        [trabajo.partes]
    );

    const partesReales = useMemo(() =>
        trabajo.partes.filter(p => p.nombre !== PAGO_ID),
        [trabajo.partes]
    );

    const totalPartes = partesReales.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
    const costoFinal = totalPartes + (trabajo.costoManoDeObra || 0);
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
    const saldoPendiente = costoFinal - totalPagado;

    const getNextStatus = (): JobStatus | null => {
        switch (trabajo.status) {
            case JobStatus.Presupuesto: return JobStatus.Programado;
            case JobStatus.Programado: return JobStatus.EnProceso;
            case JobStatus.EnProceso: return JobStatus.Finalizado;
            default: return null;
        }
    };
    
    const nextStatus = getNextStatus();
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
    };

    const handlePagoMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const digits = rawValue.replace(/\D/g, '');

        if (digits === '') {
            setPagoMonto('');
            return;
        }
        
        const numberValue = parseInt(digits, 10);
        const formattedValue = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numberValue / 100);
        setPagoMonto(formattedValue);
    };

    const handleAddPago = async () => {
        const digits = pagoMonto.replace(/\D/g, '');
        const numericValue = parseInt(digits, 10) / 100;
        if (isNaN(numericValue) || numericValue <= 0) return;

        setIsAddingPago(true);
        try {
            const nuevoPago: Parte = {
                nombre: PAGO_ID,
                cantidad: 1,
                precioUnitario: numericValue,
                fecha: new Date().toISOString(),
            };

            const partesActualizadas = [...trabajo.partes, nuevoPago];

            const { error } = await supabase
                .from('trabajos')
                .update({ partes: partesActualizadas })
                .eq('id', trabajo.id);

            if (error) throw error;
            
            setPagoMonto('');
            onDataRefresh();
        } catch (error: any) {
            console.error("Error adding payment:", error.message);
        } finally {
            setIsAddingPago(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);

        try {
            const doc = new jsPDF();
            
            const isQuote = trabajo.status !== JobStatus.Finalizado;
            const title = isQuote ? 'Presupuesto' : 'Recibo de Trabajo';
            const filename = `${title}-${cliente?.nombre}-${vehiculo?.marca}_${vehiculo?.modelo}.pdf`.replace(/\s+/g, '_');
            
            const template = tallerInfo.pdfTemplate || 'classic';

            const tableColumn = ["Item / Descripción", "Cantidad", "P/U", "Total"];
            const tableRows: (string|number)[][] = [];
            
            tableRows.push([trabajo.descripcion, '', '', '']);

            partesReales.forEach(parte => {
                const parteData = [
                    `  - ${parte.nombre}`,
                    parte.cantidad,
                    formatCurrency(parte.precioUnitario),
                    formatCurrency(parte.cantidad * parte.precioUnitario),
                ];
                tableRows.push(parteData);
            });
            
            const manoDeObra = trabajo.costoManoDeObra || 0;
            const totalGeneral = isQuote ? trabajo.costoEstimado : costoFinal;

            if (template === 'classic' && tallerInfo.logoUrl) {
                try {
                    const response = await fetch(tallerInfo.logoUrl);
                    const blob = await response.blob();
                    const base64data = await new Promise<string | null>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    if (base64data) {
                        doc.addImage(base64data, 'PNG', 15, 15, 30, 30);
                    }
                } catch (e) {
                    console.error("Could not add logo to PDF.", e);
                }
            }

            if (template === 'modern') {
                const primaryColor = '#1e40af';
                doc.setFillColor(primaryColor);
                doc.rect(0, 0, 210, 30, 'F');
                doc.setFontSize(22);
                doc.setTextColor('#FFFFFF');
                doc.setFont('helvetica', 'bold');
                doc.text(title, 20, 20);
                doc.setFontSize(10);
                doc.setTextColor('#FFFFFF');
                doc.setFont('helvetica', 'normal');
                doc.text(tallerInfo.nombre, 200, 12, { align: 'right' });
                doc.text(tallerInfo.direccion, 200, 18, { align: 'right' });
                doc.text(`Tel: ${tallerInfo.telefono}`, 200, 24, { align: 'right' });
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 20, 45);
                doc.text(`Presupuesto #${trabajo.id.substring(0, 8)}`, 20, 51);
                doc.setFillColor(241, 245, 249);
                doc.rect(15, 60, 180, 25, 'F');
                doc.setFontSize(12);
                doc.setTextColor(primaryColor);
                doc.setFont('helvetica', 'bold');
                doc.text('Cliente', 20, 67);
                doc.text('Vehículo', 110, 67);
                doc.setFontSize(10);
                doc.setTextColor(50);
                doc.setFont('helvetica', 'normal');
                doc.text(cliente?.nombre || 'N/A', 20, 74);
                doc.text(`${vehiculo?.marca} ${vehiculo?.modelo} (${vehiculo?.año})`, 110, 74);
                doc.text(`Matrícula: ${vehiculo?.matricula}`, 110, 80);
                autoTable(doc, { head: [tableColumn], body: tableRows, startY: 90, theme: 'striped', headStyles: { fillColor: primaryColor } });
                const finalY = (doc as any).lastAutoTable.finalY;
                doc.setFontSize(10);
                doc.text(`Subtotal Partes:`, 160, finalY + 10, { align: 'right' });
                doc.text(formatCurrency(totalPartes), 200, finalY + 10, { align: 'right' });
                doc.text(`Mano de Obra:`, 160, finalY + 16, { align: 'right' });
                doc.text(formatCurrency(manoDeObra), 200, finalY + 16, { align: 'right' });
                doc.setLineWidth(0.5);
                doc.line(140, finalY + 20, 200, finalY + 20);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`TOTAL:`, 160, finalY + 26, { align: 'right' });
                doc.text(formatCurrency(totalGeneral), 200, finalY + 26, { align: 'right' });
            } else {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(tallerInfo.nombre, 50, 20);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(tallerInfo.direccion, 50, 26);
                doc.text(`Tel: ${tallerInfo.telefono}`, 50, 32);
                doc.text(`CUIT: ${tallerInfo.cuit}`, 50, 38);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 200, 25, { align: 'right' });
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 200, 32, { align: 'right' });
                doc.text(`Presupuesto #${trabajo.id.substring(0, 8)}`, 200, 38, { align: 'right' });
                doc.setLineWidth(0.5);
                doc.line(15, 55, 200, 55);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Cliente', 15, 62);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.text(cliente?.nombre || 'N/A', 15, 68);
                doc.text(cliente?.email || 'N/A', 15, 74);
                doc.setFont('helvetica', 'bold');
                doc.text('Vehículo', 105, 62);
                doc.setFont('helvetica', 'normal');
                doc.text(`${vehiculo?.marca} ${vehiculo?.modelo} (${vehiculo?.año})`, 105, 68);
                doc.text(`Matrícula: ${vehiculo?.matricula}`, 105, 74);
                doc.line(15, 80, 200, 80);
                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 85,
                    theme: 'striped',
                    headStyles: { fillColor: [30, 64, 175] },
                });
                const finalY = (doc as any).lastAutoTable.finalY;
                doc.setFontSize(10);
                doc.text(`Subtotal Partes:`, 150, finalY + 10, { align: 'right' });
                doc.text(formatCurrency(totalPartes), 200, finalY + 10, { align: 'right' });
                doc.text(`Mano de Obra:`, 150, finalY + 16, { align: 'right' });
                doc.text(formatCurrency(manoDeObra), 200, finalY + 16, { align: 'right' });
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`TOTAL:`, 150, finalY + 24, { align: 'right' });
                doc.text(formatCurrency(totalGeneral), 200, finalY + 24, { align: 'right' });
            }
            
            doc.save(filename);
        } catch (error: any) {
            console.error("Error generating PDF:", error);
            alert("No se pudo generar el PDF. Un componente necesario no se cargó correctamente. Por favor, refresque la página y vuelva a intentarlo.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <>
            <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-taller-primary">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-bold text-taller-dark">{vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'Vehículo no encontrado'}</h4>
                        <p className="text-sm text-taller-gray">{cliente?.nombre}</p>
                    </div>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-taller-gray hover:text-taller-dark">
                        {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                    </button>
                </div>
                <p className="text-sm my-2 text-taller-dark">{trabajo.descripcion}</p>
                <div className="text-sm font-semibold text-taller-primary mt-1">
                    Estimado: {formatCurrency(trabajo.costoEstimado)}
                </div>
                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        <div>
                            <h5 className="text-sm font-semibold mb-2">Detalles del Trabajo</h5>
                            <ul className="text-xs space-y-1 text-taller-gray">
                                {partesReales.map((parte, index) => (
                                    <li key={index} className="flex justify-between">
                                        <span>{parte.nombre} x{parte.cantidad}</span>
                                        <span>{formatCurrency(parte.precioUnitario * parte.cantidad)}</span>
                                    </li>
                                ))}
                                <li className="flex justify-between font-bold pt-1">
                                    <span>Mano de obra</span>
                                    <span>{formatCurrency(trabajo.costoManoDeObra || 0)}</span>
                                </li>
                                <li className="flex justify-between font-bold text-taller-dark border-t pt-1 mt-1">
                                    <span>Total</span>
                                    <span>{formatCurrency(costoFinal)}</span>
                                </li>
                            </ul>
                        </div>
                        
                        {(trabajo.status === JobStatus.EnProceso || trabajo.status === JobStatus.Finalizado) && (
                            <div className="pt-3 border-t">
                                <h5 className="text-sm font-semibold mb-2 flex items-center"><BanknotesIcon className="h-5 w-5 mr-2 text-green-600"/>Gestión de Pagos</h5>
                                <div className="text-xs space-y-1 mb-3">
                                    {pagos.map((pago, index) => (
                                        <div key={index} className="flex justify-between items-center bg-gray-50 p-1 rounded">
                                            <span>Pago del {new Date(pago.fecha).toLocaleDateString('es-ES')}</span>
                                            <span className="font-semibold">{formatCurrency(pago.monto)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold pt-1 text-green-700">
                                        <span>Total Pagado</span>
                                        <span>{formatCurrency(totalPagado)}</span>
                                    </div>
                                    <div className={`flex justify-between font-bold pt-1 ${saldoPendiente > 0 ? 'text-red-600' : 'text-taller-dark'}`}>
                                        <span>Saldo Pendiente</span>
                                        <span>{formatCurrency(saldoPendiente)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Monto del pago"
                                        value={pagoMonto}
                                        onChange={handlePagoMontoChange}
                                        className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm"
                                    />
                                    <button 
                                        onClick={handleAddPago} 
                                        disabled={isAddingPago}
                                        className="px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 focus:outline-none disabled:opacity-50"
                                    >
                                        {isAddingPago ? '...' : 'Añadir'}
                                    </button>
                                </div>
                            </div>
                        )}

                         <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 focus:outline-none transition-colors"
                        >
                            <PencilIcon className="h-4 w-4"/>
                            Modificar Datos
                        </button>
                    </div>
                )}
                <div className="mt-4 flex flex-col space-y-2">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf}
                        className="w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-taller-primary bg-taller-light border border-taller-primary/50 rounded-lg shadow-sm hover:bg-blue-100 focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <DocumentArrowDownIcon className="h-4 w-4"/>
                        {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                    </button>
                    {nextStatus && (
                        <button
                            onClick={() => onUpdateStatus(trabajo.id, nextStatus)}
                            className="w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-white bg-taller-secondary rounded-lg shadow-sm hover:bg-taller-primary focus:outline-none transition-colors"
                        >
                            Mover a {nextStatus} <ArrowRightIcon className="h-4 w-4"/>
                        </button>
                    )}
                </div>
            </div>
            {isEditModalOpen && (
                <CrearTrabajoModal
                    clientes={clientes}
                    trabajoToEdit={trabajo}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={() => {
                        setIsEditModalOpen(false);
                        onDataRefresh();
                    }}
                    onDataRefresh={onDataRefresh}
                />
            )}
        </>
    );
};

export default JobCard;