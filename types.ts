export enum JobStatus {
  Presupuesto = 'Presupuesto',
  Programado = 'Programado',
  EnProceso = 'En proceso',
  Finalizado = 'Finalizado',
}

export interface Gasto {
  id?: string;
  descripcion: string;
  monto: number;
  fecha: string;
}

export interface Parte {
  id?: string;
  trabajoId?: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Trabajo {
  id: string;
  clienteId: string;
  vehiculoId: string;
  descripcion: string;
  costoEstimado: number;
  costoManoDeObra?: number;
  costoFinal?: number;
  partes: Parte[];
  status: JobStatus;
  fechaEntrada: string;
  fechaSalida?: string;
}

export interface Vehiculo {
  id: string;
  clienteId?: string;
  marca: string;
  modelo: string;
  año: number;
  matricula: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  vehiculos: Vehiculo[];
}

export type UserRole = 'taller' | 'cliente';