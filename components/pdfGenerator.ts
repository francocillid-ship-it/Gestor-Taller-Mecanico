
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajo, Cliente, Vehiculo, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';

export const generateClientPDF = async (
    trabajo: Trabajo,
    cliente: Cliente,
    vehiculo: Vehiculo | undefined,
    tallerInfo: TallerInfo
): Promise<void> => {
    const doc = new jsPDF();
    const a4Width = doc.internal.pageSize.getWidth();
    const margin = 15;
    const mainTextColor = '#0f172a';
    const primaryColor = '#1e40af';
    const lightBgColor = '#f1f5f9';
    const lightTextColor = '#64748b';

    // --- HEADER ---
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, a4Width, 30, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');

    const renderHeaderText = (logoOffset = 0) => {
        doc.setFontSize(20);
        doc.text(tallerInfo.nombre || 'Mi Taller', margin + logoOffset, 15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const address = tallerInfo.direccion || '';
        const phone = tallerInfo.telefono || '';
        const cuit = tallerInfo.cuit || '';
        doc.text(`${address} | Tel: ${phone} | CUIT: ${cuit}`, margin + logoOffset, 22);
    };

    if (tallerInfo.showLogoOnPdf && tallerInfo.logoUrl) {
        try {
            const response = await fetch(tallerInfo.logoUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            
            const imageBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const imgProps = doc.getImageProperties(imageBase64);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgHeight = 20;
            const imgWidth = imgHeight * aspectRatio;

            doc.addImage(imageBase64, 'PNG', margin, 5, imgWidth, imgHeight);
            renderHeaderText(imgWidth + 5);
        } catch (error) {
            console.error("Could not add logo to PDF, rendering without it.", error);
            renderHeaderText();
        }
    } else {
        renderHeaderText();
    }

    // --- DOCUMENT TITLE ---
    const docTitle = trabajo.status === JobStatusEnum.Presupuesto ? 'PRESUPUESTO' : 'RECIBO';
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
    const hasServices = partesSinPagos.some(p => p.isService);
    const formatCurrencyPDF = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

    if (partesSinPagos.some(p => p.nombre)) {
        const body = partesSinPagos.map(p => {
            if (p.isCategory) {
                return [{ 
                    content: p.nombre, 
                    colSpan: 4, 
                    styles: { fontStyle: 'bold', fillColor: '#f1f5f9', textColor: '#0f172a', halign: 'left' }
                }];
            } else if (p.nombre) {
                // Removed [SERVICIO] prefix as requested
                const description = p.nombre;
                return [
                    p.cantidad,
                    description,
                    formatCurrencyPDF(p.precioUnitario),
                    formatCurrencyPDF(p.cantidad * p.precioUnitario)
                ];
            }
            return null;
        }).filter(row => row !== null);


        autoTable(doc, {
            startY: lastDescLineY + 5,
            head: [['Cantidad', 'Descripción', 'Precio Unit.', 'Subtotal']],
            body: body as any,
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
    let finalY = (doc as any).lastAutoTable?.finalY || lastDescLineY + 10;
    const totalPagado = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__').reduce((sum, p) => sum + p.precioUnitario, 0);
    
    const totalsX = a4Width / 2;
    const valuesX = a4Width - margin;

    doc.setFontSize(10);
    
    // Calculate subtotal of items listed in table
    const tableTotal = partesSinPagos.filter(p => !p.isCategory).reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
    
    doc.text(`Subtotal:`, totalsX, finalY + 10);
    doc.text(formatCurrencyPDF(tableTotal), valuesX, finalY + 10, { align: 'right' });
    
    let extraOffset = 0;
    // Only show "Mano de Obra" line if it's a legacy record (has cost but no service items)
    if (!hasServices && trabajo.costoManoDeObra) {
        doc.text(`Mano de Obra:`, totalsX, finalY + 17);
        doc.text(formatCurrencyPDF(trabajo.costoManoDeObra || 0), valuesX, finalY + 17, { align: 'right' });
        extraOffset = 7;
    }
    
    doc.setLineWidth(0.5);
    doc.line(totalsX, finalY + 15 + extraOffset, valuesX, finalY + 15 + extraOffset);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL:`, totalsX, finalY + 22 + extraOffset);
    doc.text(formatCurrencyPDF(trabajo.costoEstimado), valuesX, finalY + 22 + extraOffset, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    finalY += 22 + extraOffset;
    
    if (trabajo.status !== JobStatusEnum.Presupuesto && totalPagado > 0) {
        doc.setFontSize(10);
        doc.setTextColor(mainTextColor);
        doc.text(`Total Pagado:`, totalsX, finalY + 7);
        doc.text(formatCurrencyPDF(totalPagado), valuesX, finalY + 7, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text(`Saldo Pendiente:`, totalsX, finalY + 14);
        doc.text(formatCurrencyPDF(trabajo.costoEstimado - totalPagado), valuesX, finalY + 14, { align: 'right' });
    }
    
    // --- FOOTER ---
    const footerText = trabajo.status === JobStatusEnum.Presupuesto
        ? 'Validez del presupuesto: 30 días.'
        : '¡Gracias por su confianza!';

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 20, a4Width - margin, pageHeight - 20);
    doc.setFontSize(9);
    doc.setTextColor(lightTextColor);
    doc.text(footerText, a4Width / 2, pageHeight - 15, { align: 'center' });

    doc.save(`${docTitle.toLowerCase()}-${cliente?.nombre?.replace(' ', '_') || 'cliente'}.pdf`);
};
