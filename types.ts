
export type UserRole = 'taller' | 'cliente';

export enum JobStatus {
    Presupuesto = 'Presupuesto',
    Programado = 'Programado',
    EnProceso = 'En Proceso',
    Finalizado = 'Finalizado',
}

export interface Parte {
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    fecha?: string;
    isCategory?: boolean;
    isService?: boolean;
    maintenanceType?: string;
    paymentType?: 'items' | 'labor';
    clientPaidDirectly?: boolean;
}

export interface Pago {
    monto: number;
    fecha: string;
}

export interface Trabajo {
    id: string;
    tallerId: string;
    clienteId: string;
    vehiculoId: string;
    descripcion: string;
    partes: Parte[];
    costoManoDeObra?: number;
    costoEstimado: number;
    status: JobStatus;
    fechaEntrada: string;
    fechaSalida?: string;
    fechaProgramada?: string;
    kilometraje?: number;
    notaAdicional?: string;
    // Campos para Presupuesto Rápido
    isQuickBudget?: boolean;
    quickBudgetData?: {
        nombre: string;
        apellido?: string;
        marca: string;
        modelo: string;
        matricula?: string;
    };
    expiresAt?: string;
}

export interface MaintenanceItemConfig {
    months: number;
    mileage: number;
    enabled: boolean;
}

export interface MaintenanceConfig {
    [key: string]: MaintenanceItemConfig;
}

export interface Vehiculo {
    id: string;
    marca: string;
    modelo: string;
    año?: number;
    matricula: string;
    numero_chasis?: string;
    numero_motor?: string;
    maintenance_config?: MaintenanceConfig;
}

export interface Cliente {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    vehiculos: Vehiculo[];
}

export enum GastoCategoria {
    Sueldos = 'Sueldos',
    Alquiler = 'Alquiler',
    Impuestos = 'Impuestos',
    Servicios = 'Servicios',
    Repuestos = 'Repuestos',
    Herramientas = 'Herramientas',
    Marketing = 'Marketing',
    Otros = 'Otros'
}

export interface Gasto {
    id: string;
    fecha: string;
    descripcion: string;
    monto: number;
    categoria: GastoCategoria;
    esFijo: boolean;
}

export interface TallerInfo {
    nombre: string;
    telefono: string;
    direccion: string;
    cuit: string;
    logoUrl?: string;
    pdfTemplate: 'classic' | 'modern';
    showLogoOnPdf: boolean;
    showCuitOnPdf?: boolean;
    headerColor?: string;
    fontSize?: 'small' | 'normal' | 'large';
}
