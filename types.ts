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
}

export interface Trabajo {
    id: string;
    clienteId: string;
    vehiculoId: string;
    descripcion: string;
    partes: Parte[];
    costoManoDeObra?: number;
    costoEstimado: number;
    status: JobStatus;
    fechaEntrada: string;
    fechaSalida?: string;
}

export interface Vehiculo {
    id: string;
    marca: string;
    modelo: string;
    año: number;
    matricula: string;
}

export interface Cliente {
    id: string;
    nombre: string;
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
