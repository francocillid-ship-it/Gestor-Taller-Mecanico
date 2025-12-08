
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
    fecha?: string; // Para registrar la fecha de los pagos
    isCategory?: boolean;
    isService?: boolean;
    maintenanceType?: string; // Nuevo campo: "oil", "transmission_fluid", etc.
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
    fechaProgramada?: string; // Nuevo campo para la fecha del turno
    kilometraje?: number;
    notaAdicional?: string;
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

export interface Gasto {
    id: string;
    fecha: string;
    descripcion: string;
    monto: number;
}

export interface TallerInfo {
    nombre: string;
    telefono: string;
    direccion: string;
    cuit: string;
    logoUrl?: string;
    pdfTemplate: 'classic' | 'modern';
    // mobileNavStyle eliminado, ahora es siempre bottom_nav
    showLogoOnPdf: boolean;
    showCuitOnPdf?: boolean;
    headerColor?: string;
    appTheme?: string;
    fontSize?: 'small' | 'normal' | 'large';
}