
import React, { useState, useMemo } from 'react';
import type { Vehiculo, Trabajo, Cliente, TallerInfo } from '../types';
import { ChevronDownIcon, DocumentTextIcon, Cog8ToothIcon, WrenchIcon, BookOpenIcon, BeakerIcon, FunnelIcon, EllipsisHorizontalCircleIcon, ChevronUpIcon } from '@heroicons/react/24/solid';
import TrabajoListItem from './TrabajoListItem';
import { MAINTENANCE_TYPES } from '../constants';

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
    category: 'Fluidos' | 'Filtros' | 'Otros';
    lastDate?: Date;
    nextDate?: Date;
    percentage: number;
    status: 'good' | 'warning' | 'overdue' | 'unknown' | 'disabled';
    colorClass: string;
    message: string;
    daysRemaining?: number;
    lastMileage?: number;
    nextMileage?: number;
    lastProductName?: string; // Nombre del producto utilizado
}

interface CategoryGroup {
    id: 'Fluidos' | 'Filtros' | 'Otros';
    icon: React.ElementType;
    items: MaintenanceItemStatus[];
    status: 'good' | 'warning' | 'overdue' | 'unknown';
}

// Subcomponente para manejar el estado de cada ítem individualmente
const MaintenanceItemRow: React.FC<{ item: MaintenanceItemStatus }> = ({ item }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasDetails = !!item.lastProductName && item.status !== 'unknown';

    return (
        <div 
            className={`flex flex-col border-b dark:border-gray-700/50 last:border-0 pb-3 last:pb-0 transition-colors duration-200 ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-md p-2 -mx-2' : ''}`}
            onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        >
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex-1">
                    <div className="flex justify-between mb-1 items-center">
                        <span className="font-medium text-sm text-taller-dark dark:text-taller-light flex items-center gap-2">
                            {item.label}
                            {hasDetails && (
                                <ChevronDownIcon className={`h-3 w-3 text-gray-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            )}
                        </span>
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
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-1.5">
                                <div 
                                    className={`h-1.5 rounded-full ${item.colorClass}`} 
                                    style={{ width: `${item.percentage}%` }}
                                ></div>
                            </div>
                            <div className="flex gap-4 text-xs text-taller-gray dark:text-gray-400">
                                <span>Último: {item.lastDate?.toLocaleDateString('es-ES')}</span>
                                {item.lastMileage && <span>({item.lastMileage} km)</span>}
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-taller-gray dark:text-gray-400 italic">No hay registros recientes.</p>
                    )}
                </div>
            </div>

            {/* Animación de expansión para mostrar el detalle del producto */}
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="pt-2 mt-1 text-xs text-taller-gray dark:text-gray-300 border-t dark:border-gray-700/50 flex items-start gap-2">
                        <WrenchIcon className="h-3.5 w-3.5 text-taller-primary mt-0.5" />
                        <div>
                            <span className="font-semibold text-taller-dark dark:text-taller-light">Producto/Servicio:</span> {item.lastProductName}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MaintenanceCategoryRow: React.FC<{ group: CategoryGroup }> = ({ group }) => {
    const [isOpen, setIsOpen] = useState(false);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'good': return 'bg-green-500';
            case 'warning': return 'bg-yellow-500';
            case 'overdue': return 'bg-red-600';
            default: return 'bg-gray-400';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'good': return 'text-green-700 dark:text-green-400';
            case 'warning': return 'text-yellow-700 dark:text-yellow-400';
            case 'overdue': return 'text-red-700 dark:text-red-400';
            default: return 'text-gray-500 dark:text-gray-400';
        }
    };

    // Resumen de estado para la cabecera
    const summary = useMemo(() => {
        const activeItems = group.items.filter(i => i.status !== 'disabled');
        const unknownCount = activeItems.filter(i => i.status === 'unknown').length;
        const warningCount = activeItems.filter(i => i.status === 'warning').length;
        const overdueCount = activeItems.filter(i => i.status === 'overdue').length;
        const goodCount = activeItems.filter(i => i.status === 'good').length;

        const parts = [];
        if (overdueCount > 0) parts.push(`${overdueCount} vencido(s)`);
        if (warningCount > 0) parts.push(`${warningCount} por vencer`);
        if (goodCount > 0) parts.push(`${goodCount} al día`);
        if (unknownCount > 0 && parts.length === 0) return "Sin información reciente";
        
        return parts.join(', ');
    }, [group.items]);

    // Ocultar grupo si todos los items están deshabilitados
    const allDisabled = group.items.every(i => i.status === 'disabled');
    if (allDisabled) return null;

    return (
        <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800 mb-3 shadow-sm">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 transition-colors z-10 relative"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStatusColor(group.status)}/10`}>
                        <group.icon className={`h-6 w-6 ${getStatusText(group.status)}`} />
                    </div>
                    <div className="text-left">
                        <h5 className="font-bold text-taller-dark dark:text-taller-light text-base">{group.id}</h5>
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${getStatusColor(group.status)}`}></span>
                            <p className="text-xs text-taller-gray dark:text-gray-400">{summary}</p>
                        </div>
                    </div>
                </div>
                <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                </div>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-600 space-y-4">
                        {group.items.filter(i => i.status !== 'disabled').map((item) => (
                            <MaintenanceItemRow key={item.key} item={item} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({ vehiculo, trabajos, onViewHistory, cliente, tallerInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const ultimosTrabajos = trabajos.slice(0, 3);

    const maintenanceGroups = useMemo(() => {
        // Ordenamos trabajos por fecha descendente
        const sortedTrabajos = [...trabajos].sort((a, b) => {
            const dateA = new Date(a.fechaSalida || a.fechaEntrada).getTime();
            const dateB = new Date(b.fechaSalida || b.fechaEntrada).getTime();
            return dateB - dateA;
        });

        const baseMaintenanceConfig = [
            // FLUIDOS (Default interval values)
            { category: 'Fluidos', key: 'oil', label: 'Aceite de Motor', months: 12, mileageInterval: 10000 },
            { category: 'Fluidos', key: 'transmission_fluid', label: 'Aceite Transmisión', months: 48, mileageInterval: 60000 },
            { category: 'Fluidos', key: 'coolant', label: 'Líquido Refrigerante', months: 24, mileageInterval: 40000 },
            { category: 'Fluidos', key: 'brake_fluid', label: 'Líquido de Frenos', months: 24, mileageInterval: 40000 },

            // FILTROS
            { category: 'Filtros', key: 'oil_filter', label: 'Filtro de Aceite', months: 12, mileageInterval: 10000 },
            { category: 'Filtros', key: 'air_filter', label: 'Filtro de Aire', months: 12, mileageInterval: 15000 },
            { category: 'Filtros', key: 'fuel_filter', label: 'Filtro de Combustible', months: 12, mileageInterval: 15000 },
            { category: 'Filtros', key: 'cabin_filter', label: 'Filtro de Habitáculo', months: 12, mileageInterval: 15000 },

            // OTROS
            { category: 'Otros', key: 'timing_belt', label: 'Kit de Distribución', months: 60, mileageInterval: 60000 },
            { category: 'Otros', key: 'brakes', label: 'Frenos', months: 12, mileageInterval: 20000 },
            { category: 'Otros', key: 'spark_plugs', label: 'Bujías', months: 24, mileageInterval: 30000 },
            { category: 'Otros', key: 'battery', label: 'Batería', months: 36, mileageInterval: 0 },
            { category: 'Otros', key: 'tires', label: 'Neumáticos', months: 48, mileageInterval: 50000 },
        ];

        // Find the definition for keyword fallback from constants
        const findTypeDefinition = (key: string) => {
            for (const cat of Object.values(MAINTENANCE_TYPES)) {
                const found = cat.find(c => c.key === key);
                if (found) return found;
            }
            return null;
        };

        const processedItems = baseMaintenanceConfig.map(config => {
            // Check if vehicle has custom config for this item
            const customConfig = vehiculo.maintenance_config?.[config.key];
            
            // If explicitly disabled in config
            if (customConfig && !customConfig.enabled) {
                return {
                    key: config.key,
                    label: config.label,
                    category: config.category as any,
                    percentage: 0,
                    status: 'disabled' as const,
                    colorClass: '',
                    message: 'Desactivado',
                };
            }

            // Use custom values or fallback to default
            const intervalMonths = customConfig ? customConfig.months : config.months;
            const intervalMileage = customConfig ? customConfig.mileage : config.mileageInterval;

            const typeDef = findTypeDefinition(config.key);
            const keywords = typeDef ? typeDef.keywords : [];

            // Updated Logic: Check for Explicit Tag first, then fallback to keywords
            // Also capture the product name (p.nombre)
            let matchingPartName: string | undefined = undefined;

            const lastJob = sortedTrabajos.find(t => 
                t.status === 'Finalizado' && 
                t.partes.some(p => {
                    // Priority 1: Check explicit tag
                    if (p.maintenanceType === config.key) {
                        matchingPartName = p.nombre;
                        return true;
                    }
                    // Priority 2: Check keywords (fallback for legacy data or untagged items)
                    if (!p.maintenanceType && keywords.some(k => p.nombre.toLowerCase().includes(k))) {
                        matchingPartName = p.nombre;
                        return true;
                    }
                    return false;
                })
            );

            const baseItem = {
                key: config.key,
                label: config.label,
                category: config.category as any,
                percentage: 0,
                status: 'unknown' as const,
                colorClass: 'bg-gray-200 dark:bg-gray-600',
                message: 'No registrado',
                lastProductName: undefined
            };

            if (!lastJob) return baseItem;

            // If we found the job but somehow missed the name (rare), double check
            if (!matchingPartName) {
                 const part = lastJob.partes.find(p => p.maintenanceType === config.key || keywords.some(k => p.nombre.toLowerCase().includes(k)));
                 if (part) matchingPartName = part.nombre;
            }

            const serviceDateStr = lastJob.fechaSalida || lastJob.fechaEntrada;
            const serviceDate = new Date(serviceDateStr);
            const today = new Date();
            
            const nextServiceDate = new Date(serviceDate);
            nextServiceDate.setMonth(nextServiceDate.getMonth() + intervalMonths);

            const totalDuration = nextServiceDate.getTime() - serviceDate.getTime();
            const elapsed = today.getTime() - serviceDate.getTime();
            
            let percentage = (elapsed / totalDuration) * 100;
            if (percentage < 0) percentage = 0;

            const daysRemaining = Math.ceil((nextServiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const lastMileage = lastJob.kilometraje || 0;
            const nextMileage = lastMileage > 0 ? lastMileage + intervalMileage : 0;

            let status: 'good' | 'warning' | 'overdue' = 'good';
            let colorClass = 'bg-green-500';
            let message = `${daysRemaining} días restantes`;

            if (daysRemaining <= 0) {
                status = 'overdue';
                colorClass = 'bg-red-600';
                message = 'Vencido por tiempo';
            } else if (daysRemaining <= 30) {
                status = 'warning';
                colorClass = 'bg-yellow-500';
                message = 'Próximo a vencer';
            }

            return {
                ...baseItem,
                lastDate: serviceDate,
                nextDate: nextServiceDate,
                percentage: Math.min(percentage, 100),
                status,
                colorClass,
                message,
                daysRemaining,
                lastMileage,
                nextMileage,
                lastProductName: matchingPartName
            };
        });

        // Agrupar por categorías
        const groups: CategoryGroup[] = [
            { id: 'Fluidos', icon: BeakerIcon, items: [], status: 'good' },
            { id: 'Filtros', icon: FunnelIcon, items: [], status: 'good' },
            { id: 'Otros', icon: EllipsisHorizontalCircleIcon, items: [], status: 'good' }
        ];

        processedItems.forEach(item => {
            const group = groups.find(g => g.id === item.category);
            if (group) group.items.push(item);
        });

        // Calcular estado global del grupo
        groups.forEach(group => {
            const activeItems = group.items.filter(i => i.status !== 'disabled');
            if (activeItems.length === 0) {
                group.status = 'unknown'; // O 'disabled' si prefieres, pero 'unknown' lo oculta o muestra gris
            } else if (activeItems.some(i => i.status === 'overdue')) {
                group.status = 'overdue';
            } else if (activeItems.some(i => i.status === 'warning')) {
                group.status = 'warning';
            } else if (activeItems.every(i => i.status === 'unknown')) {
                group.status = 'unknown';
            } else {
                group.status = 'good';
            }
        });

        return groups;

    }, [trabajos, vehiculo.maintenance_config]);
    
    // Estado global para el indicador mini
    const globalStatus = useMemo(() => {
        // Obtenemos todos los ítems individuales de todos los grupos
        const allItems = maintenanceGroups.flatMap(g => g.items);
        
        // Filtramos solo los que están activos (no disabled)
        const activeItems = allItems.filter(i => i.status !== 'disabled');
        
        // Verificamos si hay ALGÚN dato registrado (status no es unknown)
        const hasAnyRecords = activeItems.some(i => i.status !== 'unknown');

        if (!hasAnyRecords) {
            return 'no_data';
        }

        // Si hay datos, chequeamos prioridades
        if (activeItems.some(i => i.status === 'overdue')) return 'overdue';
        if (activeItems.some(i => i.status === 'warning')) return 'warning';
        
        // Si hay datos y nada está vencido ni en warning
        return 'good';
    }, [maintenanceGroups]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex justify-between items-center text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none z-10 relative"
            >
                <div className="flex-1">
                    <h4 className="font-bold text-lg text-taller-dark dark:text-taller-light">{vehiculo.marca} {vehiculo.modelo} {vehiculo.año ? `(${vehiculo.año})` : ''}</h4>
                    <p className="text-sm text-taller-gray dark:text-gray-400 mb-2">{vehiculo.matricula}</p>
                    
                     {/* Mini indicator (Solo visible cuando está contraído o en transición) */}
                     <div className={`flex items-center gap-2 mt-1 transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                         <span className={`flex h-2.5 w-2.5 rounded-full ${
                             globalStatus === 'overdue' ? 'bg-red-600' : 
                             globalStatus === 'warning' ? 'bg-yellow-500' : 
                             globalStatus === 'good' ? 'bg-green-500' : 
                             'bg-gray-400' // no_data
                         }`}></span>
                         <span className="text-xs text-taller-gray dark:text-gray-400">
                             {globalStatus === 'overdue' ? 'Se requiere mantenimiento' : 
                              globalStatus === 'warning' ? 'Mantenimiento próximo' : 
                              globalStatus === 'good' ? 'Mantenimiento al día' : 
                              'Sin mantenimiento registrado'}
                         </span>
                     </div>
                </div>
                <div className="flex items-center">
                    <span className="text-sm font-semibold text-taller-primary mr-4 hidden sm:inline">{trabajos.length} trabajos</span>
                    <ChevronDownIcon className={`h-6 w-6 text-taller-gray dark:text-gray-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {/* --- MAINTENANCE STATUS SECTION --- */}
                        <div className="mb-6">
                            <h5 className="font-semibold mb-3 text-taller-dark dark:text-taller-light flex items-center gap-2">
                                <BeakerIcon className="h-5 w-5 text-taller-primary"/>
                                Estado de Mantenimiento
                            </h5>
                            
                            <div className="space-y-2">
                                {maintenanceGroups.map(group => (
                                    <MaintenanceCategoryRow key={group.id} group={group} />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6 text-sm bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-600 shadow-sm">
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
                </div>
            </div>
        </div>
    );
};

export default VehicleInfoCard;
