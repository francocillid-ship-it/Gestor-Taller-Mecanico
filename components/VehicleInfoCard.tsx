
import React, { useState, useMemo } from 'react';
import type { Vehiculo, Trabajo, Cliente, TallerInfo } from '../types';
import { ChevronDownIcon, DocumentTextIcon, Cog8ToothIcon, WrenchIcon, BookOpenIcon, BeakerIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import TrabajoListItem from './TrabajoListItem';

interface VehicleInfoCardProps {
    vehiculo: Vehiculo;
    trabajos: Trabajo[];
    onViewHistory: () => void;
    cliente: Cliente;
    tallerInfo: TallerInfo | null;
}

interface MaintenanceItemStatus {
    key: string;
    label: string;
    lastDate?: Date;
    nextDate?: Date;
    percentage: number;
    status: 'good' | 'warning' | 'overdue' | 'unknown';
    colorClass: string;
    textClass: string;
    message: string;
    daysRemaining?: number;
    lastMileage?: number;
    nextMileage?: number;
}

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({ vehiculo, trabajos, onViewHistory, cliente, tallerInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const ultimosTrabajos = trabajos.slice(0, 3);

    const maintenanceStatusList = useMemo(() => {
        // Ordenamos trabajos por fecha descendente (más reciente primero)
        const sortedTrabajos = [...trabajos].sort((a, b) => {
            const dateA = new Date(a.fechaSalida || a.fechaEntrada).getTime();
            const dateB = new Date(b.fechaSalida || b.fechaEntrada).getTime();
            return dateB - dateA;
        });

        const maintenanceConfig = [
            { 
                key: 'oil', 
                label: 'Aceite y Filtro', 
                months: 6,
                mileageInterval: 5000,
                keywords: ['aceite', 'filtro aceite'] 
            },
            { 
                key: 'air_filter', 
                label: 'Filtro de Aire', 
                months: 12,
                mileageInterval: 10000,
                keywords: ['filtro aire', 'filtro de aire'] 
            },
            { 
                key: 'fuel_filter', 
                label: 'Filtro de Combustible', 
                months: 12,
                mileageInterval: 10000,
                keywords: ['filtro nafta', 'filtro de nafta', 'filtro combustible', 'filtro de combustible', 'filtro gasoil'] 
            },
             { 
                key: 'brakes', 
                label: 'Frenos', 
                months: 12,
                mileageInterval: 30000,
                keywords: ['frenos', 'pastillas', 'discos', 'cinta'] 
            },
            { 
                key: 'coolant', 
                label: 'Líquido Refrigerante', 
                months: 24, // 2 años
                mileageInterval: 40000,
                keywords: ['refrigerante', 'anticongelante', 'agua radiador', 'coolant'] 
            }
        ];

        return maintenanceConfig.map(config => {
            // Buscar el último trabajo que coincida con las keywords
            const lastJob = sortedTrabajos.find(t => 
                t.status === 'Finalizado' && 
                (
                    config.keywords.some(k => t.descripcion.toLowerCase().includes(k)) ||
                    t.partes.some(p => config.keywords.some(k => p.nombre.toLowerCase().includes(k)))
                )
            );

            if (!lastJob) {
                return {
                    key: config.key,
                    label: config.label,
                    percentage: 0,
                    status: 'unknown',
                    colorClass: 'bg-gray-200 dark:bg-gray-600',
                    textClass: 'text-gray-500 dark:text-gray-400',
                    message: 'No registrado',
                } as MaintenanceItemStatus;
            }

            const serviceDateStr = lastJob.fechaSalida || lastJob.fechaEntrada;
            const serviceDate = new Date(serviceDateStr);
            const today = new Date();
            
            // Cálculo de fechas
            const nextServiceDate = new Date(serviceDate);
            nextServiceDate.setMonth(nextServiceDate.getMonth() + config.months);

            const totalDuration = nextServiceDate.getTime() - serviceDate.getTime();
            const elapsed = today.getTime() - serviceDate.getTime();
            
            let percentage = (elapsed / totalDuration) * 100;
            if (percentage < 0) percentage = 0;

            const daysRemaining = Math.ceil((nextServiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // Cálculo de kilometraje
            const lastMileage = lastJob.kilometraje || 0;
            const nextMileage = lastMileage > 0 ? lastMileage + config.mileageInterval : 0;

            let status: 'good' | 'warning' | 'overdue' = 'good';
            let colorClass = 'bg-green-500';
            let textClass = 'text-green-700 dark:text-green-400';
            let message = `${daysRemaining} días restantes`;

            if (daysRemaining <= 0) {
                status = 'overdue';
                colorClass = 'bg-red-600';
                textClass = 'text-red-700 dark:text-red-400';
                message = 'Vencido por tiempo';
            } else if (daysRemaining <= 30) {
                status = 'warning';
                colorClass = 'bg-yellow-500';
                textClass = 'text-yellow-700 dark:text-yellow-400';
                message = 'Próximo a vencer';
            }

            return {
                key: config.key,
                label: config.label,
                lastDate: serviceDate,
                nextDate: nextServiceDate,
                percentage: Math.min(percentage, 100),
                status,
                colorClass,
                textClass,
                message,
                daysRemaining,
                lastMileage: lastMileage,
                nextMileage: nextMileage
            } as MaintenanceItemStatus;
        });

    }, [trabajos]);
    
    // Check if any service is overdue for the main indicator
    const globalStatus = useMemo(() => {
        if (maintenanceStatusList.some(s => s.status === 'overdue')) return 'overdue';
        if (maintenanceStatusList.some(s => s.status === 'warning')) return 'warning';
        return 'good';
    }, [maintenanceStatusList]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none"
            >
                <div className="flex-1">
                    <h4 className="font-bold text-lg text-taller-dark dark:text-taller-light">{vehiculo.marca} {vehiculo.modelo} ({vehiculo.año})</h4>
                    <p className="text-sm text-taller-gray dark:text-gray-400 mb-2">{vehiculo.matricula}</p>
                    
                     {/* Mini indicator */}
                     {!isExpanded && (
                         <div className="flex items-center gap-2 mt-1">
                             <span className={`flex h-2.5 w-2.5 rounded-full ${
                                 globalStatus === 'overdue' ? 'bg-red-600' : 
                                 globalStatus === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                             }`}></span>
                             <span className="text-xs text-taller-gray dark:text-gray-400">
                                 {globalStatus === 'overdue' ? 'Mantenimiento Pendiente' : 
                                  globalStatus === 'warning' ? 'Mantenimiento Próximo' : 'Mantenimiento al día'}
                             </span>
                         </div>
                     )}
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4 hidden sm:inline">{trabajos.length} trabajos</span>
                    <ChevronDownIcon className={`h-6 w-6 text-taller-gray dark:text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    
                    {/* --- MAINTENANCE STATUS SECTION --- */}
                    <div className="mb-6 bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                        <h5 className="font-semibold mb-4 text-taller-dark dark:text-taller-light flex items-center gap-2">
                            <BeakerIcon className="h-5 w-5 text-taller-primary"/>
                            Estado de Mantenimiento
                        </h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {maintenanceStatusList.map((item) => (
                                <div key={item.key} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border dark:border-gray-600 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-medium text-sm text-taller-dark dark:text-taller-light">{item.label}</span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                item.status === 'good' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                item.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                                                item.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                                'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                                            }`}>
                                                {item.status === 'unknown' ? 'Sin Datos' : item.message}
                                            </span>
                                        </div>
                                        
                                        {item.status !== 'unknown' ? (
                                            <>
                                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-2">
                                                    <div 
                                                        className={`h-1.5 rounded-full ${item.colorClass}`} 
                                                        style={{ width: `${item.percentage}%` }}
                                                    ></div>
                                                </div>
                                                <div className="flex flex-col gap-1 text-xs text-taller-gray dark:text-gray-400 mt-2">
                                                    <div className="flex justify-between">
                                                        <span>Realizado:</span>
                                                        <span className="font-medium">{item.lastDate?.toLocaleDateString('es-ES')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Km Registrados:</span>
                                                        <span className="font-medium">{item.lastMileage && item.lastMileage > 0 ? `${item.lastMileage} km` : 'No registrado'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-taller-gray dark:text-gray-400 italic mb-2">No hay registros recientes.</p>
                                        )}
                                    </div>

                                    {item.status !== 'unknown' && (
                                        <div className="mt-3 pt-2 border-t dark:border-gray-700/50 text-xs">
                                            <p className="text-taller-dark dark:text-gray-300 mb-1">
                                                <span className="font-semibold text-taller-primary dark:text-blue-300">Próximo Servicio:</span>
                                            </p>
                                            <div className="flex justify-between">
                                                <span>Fecha est.:</span>
                                                <span>{item.nextDate?.toLocaleDateString('es-ES')}</span>
                                            </div>
                                             {item.nextMileage && item.nextMileage > 0 && (
                                                <div className="flex justify-between font-medium text-taller-dark dark:text-taller-light mt-0.5">
                                                    <span>A los:</span>
                                                    <span>{item.nextMileage} km</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 text-sm">
                        <div className="flex items-start">
                            <DocumentTextIcon className="h-5 w-5 mr-3 mt-0.5 text-taller-gray dark:text-gray-400 flex-shrink-0"/>
                            <div>
                                <p className="font-semibold text-taller-dark dark:text-taller-light">Nº Chasis</p>
                                <p className="text-taller-gray dark:text-gray-300">{vehiculo.numero_chasis || 'No especificado'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                             <Cog8ToothIcon className="h-5 w-5 mr-3 mt-0.5 text-taller-gray dark:text-gray-400 flex-shrink-0"/>
                            <div>
                                <p className="font-semibold text-taller-dark dark:text-taller-light">Nº Motor</p>
                                <p className="text-taller-gray dark:text-gray-300">{vehiculo.numero_motor || 'No especificado'}</p>
                            </div>
                        </div>
                    </div>

                    <h5 className="font-semibold mb-3 text-taller-dark dark:text-taller-light flex items-center gap-2">
                        <WrenchIcon className="h-5 w-5 text-taller-gray dark:text-gray-400"/>
                        Últimas Reparaciones
                    </h5>
                    <div className="space-y-3">
                        {ultimosTrabajos.length > 0 ? (
                            ultimosTrabajos.map(trabajo => <TrabajoListItem key={trabajo.id} trabajo={trabajo} cliente={cliente} tallerInfo={tallerInfo} vehiculo={vehiculo} />)
                        ) : (
                            <p className="text-sm text-taller-gray dark:text-gray-400 pl-7">No hay reparaciones recientes para este vehículo.</p>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={onViewHistory}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-taller-secondary bg-blue-50 border border-taller-secondary/50 rounded-lg shadow-sm hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-500/50 dark:hover:bg-blue-900/50"
                        >
                           <BookOpenIcon className="h-4 w-4"/>
                            Ver Historial del Vehículo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehicleInfoCard;
