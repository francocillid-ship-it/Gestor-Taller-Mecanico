
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Trabajo, Cliente, Vehiculo, TallerInfo } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { supabase } from '../supabaseClient';

// Helper function to convert image URL to Base64 PNG using Canvas
// This solves CORS issues and format compatibility for jsPDF
const getImageDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Critical for loading external images (Supabase)
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };
        img.onerror = (error) => {
            console.error("Error loading image for PDF", error);
            reject(error);
        };
        
        // Cache busting to prevent browser from using a cached non-CORS response
        // Check if url already has params
        const separator = url.includes('?') ? '&' : '?';
        img.src = `${url}${separator}t=${new Date().getTime()}`;
    });
};

export const generateClientPDF = async (
    trabajo: Trabajo,
    cliente: Cliente,
    vehiculo: Vehiculo | undefined,
    tallerInfo: TallerInfo,
    forceDownload: boolean = false
): Promise<void> => {
    const doc = new jsPDF();
    const a4Width = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const mainTextColor = '#0f172a';
    
    // Use user defined color or default to the new sober slate
    const primaryColor = tallerInfo.headerColor || '#334155';
    const lightBgColor = '#f8fafc';
    const lightTextColor = '#64748b';

    // --- CALCULATE SEQUENTIAL NUMBER ---
    let formattedNumber = trabajo.id.substring(0, 8); // Fallback

    if (trabajo.tallerId) {
        try {
            // Count how many jobs exist for this taller created before or at the same time as this one
            const { data: allJobs } = await supabase
                .from('trabajos')
                .select('id, fecha_entrada') // We select minimal fields
                .eq('taller_id', trabajo.tallerId)
                .order('fecha_entrada', { ascending: true })
                .order('id', { ascending: true }); // Deterministic tie-breaker
            
            if (allJobs) {
                const index = allJobs.findIndex(j => j.id === trabajo.id);
                if (index !== -1) {
                    const sequenceNumber = index + 1;
                    formattedNumber = sequenceNumber.toString().padStart(6, '0');
                }
            }
        } catch (e) {
            console.error("Error calculating sequence number", e);
        }
    }

    // --- 1. DRAW BACKGROUND HEADER FIRST ---
    // We draw the background color first so the logo (if transparent) sits ON TOP of it, not under it.
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, a4Width, 30, 'F');

    // --- 2. HANDLE LOGO ---
    let logoOffset = 0;
    
    // Strict check for boolean true
    if (tallerInfo.showLogoOnPdf === true && tallerInfo.logoUrl) {
        try {
            const logoImgData = await getImageDataUrl(tallerInfo.logoUrl);
            const imgProps = doc.getImageProperties(logoImgData);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgHeight = 20;
            const logoWidth = imgHeight * aspectRatio;
            
            // Draw Logo on top of the background
            doc.addImage(logoImgData, 'PNG', margin, 5, logoWidth, 20);
            logoOffset = logoWidth + 5;
        } catch (error) {
            console.error("Could not load logo for PDF:", error);
            // Fail gracefully and continue without logo
        }
    }

    // --- 3. DRAW HEADER TEXT ---
    doc.setTextColor('#FFFFFF');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(tallerInfo.nombre || 'Mi Taller', margin + logoOffset, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const address = tallerInfo.direccion || '';
    const phone = tallerInfo.telefono || '';
    const cuit = tallerInfo.cuit || '';
    doc.text(`${address} | Tel: ${phone} | CUIT: ${cuit}`, margin + logoOffset, 22);


    // --- DOCUMENT TITLE ---
    const docTitle = trabajo.status === JobStatusEnum.Presupuesto ? 'PRESUPUESTO' : 'RECIBO';
    doc.setTextColor(mainTextColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(docTitle, a4Width - margin, 45, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    // Updated Numbering
    doc.text(`N°: ${formattedNumber}`, a4Width - margin, 52, { align: 'right' });
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
    const clientFullName = `${cliente?.nombre} ${cliente?.apellido || ''}`.trim();
    doc.text(clientFullName || 'N/A', margin + 5, 85);
    doc.text(cliente?.telefono || '', margin + 5, 92);
    
    const vehicleText = `${vehiculo?.marca || ''} ${vehiculo?.modelo || ''} (${vehiculo?.año || 'N/A'})`;
    doc.text(vehicleText, (a4Width / 2), 85);
    let vehicleSubText = `Matrícula: ${vehiculo?.matricula || 'N/A'}`;
    if (trabajo.kilometraje) {
        vehicleSubText += ` - KM: ${trabajo.kilometraje}`;
    }
    doc.text(vehicleSubText, (a4Width / 2), 92);

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
            },
            margin: { bottom: 25 }, // Ensure table doesn't hit the very bottom
        });
    }
    
    // --- TOTALS & PAGE BREAK LOGIC ---
    let finalY = (doc as any).lastAutoTable?.finalY || lastDescLineY + 10;
    const totalPagado = trabajo.partes.filter(p => p.nombre === '__PAGO_REGISTRADO__').reduce((sum, p) => sum + p.precioUnitario, 0);
    const tableTotal = partesSinPagos.filter(p => !p.isCategory).reduce((sum, p) => sum + (p.cantidad * p.precioUnitario), 0);
    const isLegacyLabor = !hasServices && trabajo.costoManoDeObra;
    const showPayments = trabajo.status !== JobStatusEnum.Presupuesto && totalPagado > 0;

    // Calculate height needed for the Totals Block
    // Base lines (Subtotal + Total) ~ 25 units
    // Optional Labor ~ 7 units
    // Optional Payments/Balance ~ 14 units
    // Margin buffer ~ 20 units (footer area)
    let requiredHeight = 25; 
    if (isLegacyLabor) requiredHeight += 7;
    if (showPayments) requiredHeight += 14;
    const footerMargin = 25;

    // Check if we need to add a new page
    if (finalY + requiredHeight > pageHeight - footerMargin) {
        doc.addPage();
        finalY = 20; // Start at top of new page
    }
    
    // --- DRAW TOTALS ---
    const totalsX = a4Width / 2;
    const valuesX = a4Width - margin;

    doc.setFontSize(10);
    
    doc.text(`Subtotal:`, totalsX, finalY + 10);
    doc.text(formatCurrencyPDF(tableTotal), valuesX, finalY + 10, { align: 'right' });
    
    let extraOffset = 0;
    // Only show "Mano de Obra" line if it's a legacy record (has cost but no service items)
    if (isLegacyLabor) {
        doc.text(`Mano de Obra:`, totalsX, finalY + 17);
        doc.text(formatCurrencyPDF(trabajo.costoManoDeObra || 0), valuesX, finalY + 17, { align: 'right' });
        extraOffset = 7;
    }
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(primaryColor); // Use primary color for the line
    doc.line(totalsX, finalY + 15 + extraOffset, valuesX, finalY + 15 + extraOffset);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL:`, totalsX, finalY + 22 + extraOffset);
    doc.text(formatCurrencyPDF(trabajo.costoEstimado), valuesX, finalY + 22 + extraOffset, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    finalY += 22 + extraOffset;
    
    if (showPayments) {
        doc.setFontSize(10);
        doc.setTextColor(mainTextColor);
        doc.text(`Total Pagado:`, totalsX, finalY + 7);
        doc.text(formatCurrencyPDF(totalPagado), valuesX, finalY + 7, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text(`Saldo Pendiente:`, totalsX, finalY + 14);
        doc.text(formatCurrencyPDF(trabajo.costoEstimado - totalPagado), valuesX, finalY + 14, { align: 'right' });
    }
    
    // --- FOOTER ON ALL PAGES ---
    const footerText = trabajo.status === JobStatusEnum.Presupuesto
        ? 'Validez del presupuesto: 30 días.'
        : '¡Gracias por su confianza!';
    
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setLineWidth(0.2);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 20, a4Width - margin, pageHeight - 20);
        
        doc.setFontSize(9);
        doc.setTextColor(lightTextColor);
        doc.text(footerText, a4Width / 2, pageHeight - 15, { align: 'center' });
        
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, a4Width - margin, pageHeight - 15, { align: 'right' });
    }

    // --- SAVE / SHARE ---
    // Sanitize filename
    const sanitizedClientName = (cliente?.nombre || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const sanitizedLastName = (cliente?.apellido || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fullSanitizedName = sanitizedLastName ? `${sanitizedClientName}_${sanitizedLastName}` : sanitizedClientName;
    
    const fileName = `${docTitle.toLowerCase()}_${fullSanitizedName}_${formattedNumber}.pdf`;

    if (!forceDownload && navigator.share) {
        try {
            const blob = doc.output('blob');
            const file = new File([blob], fileName, { type: 'application/pdf' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `${docTitle} - ${tallerInfo.nombre}`,
                    text: `Hola ${cliente.nombre}, adjunto el ${docTitle.toLowerCase()} correspondiente.`,
                });
                return; // Stop here if shared successfully
            }
        } catch (error: any) {
            // Ignore AbortError (User cancelled share menu)
            if (error.name !== 'AbortError') {
                console.error("Error sharing PDF via Web Share API, falling back to download.", error);
                doc.save(fileName); // Fallback only on real errors, not cancellation
            }
            return; // Exit
        }
    }
    
    // Fallback to standard download if share not supported or forced download
    doc.save(fileName);
};
