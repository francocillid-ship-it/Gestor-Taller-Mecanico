
import React, { useState } from 'react';
import type { Trabajo, Cliente, Vehiculo } from '../types';
import { JobStatus } from '../types';
import { ChevronDownIcon, ChevronUpIcon, UserCircleIcon, WrenchIcon, ArrowRightIcon, DocumentArrowDownIcon } from '@heroicons/react/24/solid';
import type { TallerInfo } from './TallerDashboard';

// Declare jspdf types for CDN usage
declare const jspdf: any;

interface JobCardProps {
    trabajo: Trabajo;
    cliente?: Cliente;
    vehiculo?: Vehiculo;
    onUpdateStatus: (trabajoId: string, newStatus: JobStatus) => void;
    tallerInfo: TallerInfo;
}

const JobCard: React.FC<JobCardProps> = ({ trabajo, cliente, vehiculo, onUpdateStatus, tallerInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const totalPartes = trabajo.partes.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
    const costoFinal = totalPartes + (trabajo.costoManoDeObra || 0);

    const getNextStatus = (): JobStatus | null => {
        switch (trabajo.status) {
            case JobStatus.Presupuesto: return JobStatus.Programado;
            case JobStatus.Programado: return JobStatus.EnProceso;
            case JobStatus.EnProceso: return JobStatus.Finalizado;
            default: return null;
        }
    };
    
    const nextStatus = getNextStatus();

    const handleDownloadPDF = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        const isQuote = trabajo.status !== JobStatus.Finalizado;
        const title = isQuote ? 'Presupuesto' : 'Recibo de Trabajo';
        const filename = `${title}-${cliente?.nombre}-${vehiculo?.marca}_${vehiculo?.modelo}.pdf`.replace(/\s+/g, '_');
        
        // --- Header ---
        if (tallerInfo.logoUrl) {
            try {
                // Note: CORS issues might prevent image loading from a different origin.
                // Ensure Supabase Storage bucket has permissive CORS settings for your app's domain.
                doc.addImage(tallerInfo.logoUrl, 'PNG', 15, 15, 30, 30);
            } catch (e) {
                console.error("Could not add logo to PDF. This might be a CORS issue.", e);
            }
        }
        
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


        // --- Client Info ---
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

        // --- Details Table ---
        const tableColumn = ["Item / Descripción", "Cantidad", "P/U", "Total"];
        const tableRows = [];
        
        tableRows.push([trabajo.descripcion, '', '', '']);

        trabajo.partes.forEach(parte => {
            const parteData = [
                `  - ${parte.nombre}`,
                parte.cantidad,
                new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(parte.precioUnitario),
                new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(parte.cantidad * parte.precioUnitario),
            ];
            tableRows.push(parteData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 85,
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
        });

        // --- Totals ---
        const finalY = doc.previousAutoTable.finalY;
        const totalPartes = trabajo.partes.reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
        const manoDeObra = trabajo.costoManoDeObra || 0;
        const totalGeneral = isQuote ? trabajo.costoEstimado : costoFinal;

        doc.setFontSize(10);
        doc.text(`Subtotal Partes:`, 150, finalY + 10, { align: 'right' });
        doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalPartes), 200, finalY + 10, { align: 'right' });
        
        doc.text(`Mano de Obra:`, 150, finalY + 16, { align: 'right' });
        doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(manoDeObra), 200, finalY + 16, { align: 'right' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL:`, 150, finalY + 24, { align: 'right' });
        doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalGeneral), 200, finalY + 24, { align: 'right' });

        doc.save(filename);
    }


    return (
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
                Estimado: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trabajo.costoEstimado)}
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    <div>
                        <h5 className="text-sm font-semibold mb-2 flex items-center"><WrenchIcon className="h-4 w-4 mr-2"/>Detalles del Trabajo</h5>
                        <ul className="text-xs space-y-1 text-taller-gray">
                            {trabajo.partes.map((parte, index) => (
                                <li key={index} className="flex justify-between">
                                    <span>{parte.nombre} x{parte.cantidad}</span>
                                    <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(parte.precioUnitario * parte.cantidad)}</span>
                                </li>
                            ))}
                             <li className="flex justify-between font-bold pt-1">
                                <span>Mano de obra</span>
                                <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trabajo.costoManoDeObra || 0)}</span>
                            </li>
                            <li className="flex justify-between font-bold text-taller-dark border-t pt-1 mt-1">
                                <span>Total</span>
                                 <span>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(costoFinal)}</span>
                            </li>
                        </ul>
                    </div>
                     <button
                        onClick={handleDownloadPDF}
                        className="w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-taller-primary bg-taller-light border border-taller-primary/50 rounded-lg shadow-sm hover:bg-blue-100 focus:outline-none transition-colors"
                    >
                        <DocumentArrowDownIcon className="h-4 w-4"/>
                        Descargar PDF
                    </button>
                </div>
            )}
             {nextStatus && (
                <button
                    onClick={() => onUpdateStatus(trabajo.id, nextStatus)}
                    className="mt-4 w-full text-sm flex items-center justify-center gap-2 px-3 py-1.5 font-semibold text-white bg-taller-secondary rounded-lg shadow-sm hover:bg-taller-primary focus:outline-none transition-colors"
                >
                    Mover a {nextStatus} <ArrowRightIcon className="h-4 w-4"/>
                </button>
            )}
        </div>
    );
};

export default JobCard;