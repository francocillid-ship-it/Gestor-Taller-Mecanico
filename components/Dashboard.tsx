import React, { useMemo, useState } from 'react';
import type { Gasto, Trabajo } from '../types';
import { JobStatus } from '../types';
import { ArrowUpIcon, ArrowDownIcon, BanknotesIcon, PlusCircleIcon } from '@heroicons/react/24/solid';

interface DashboardProps {
    trabajos: Trabajo[];
    gastos: Gasto[];
    onAddGasto: (gasto: Omit<Gasto, 'id' | 'fecha'>) => Promise<void>;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-taller-gray">{title}</p>
            <p className="text-2xl font-bold text-taller-dark">{value}</p>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ trabajos, gastos, onAddGasto }) => {
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const stats = useMemo(() => {
        const ingresos = trabajos
            .filter(t => t.status === JobStatus.Finalizado && t.costoManoDeObra)
            .reduce((sum, t) => sum + (t.costoManoDeObra || 0), 0);

        const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
        const beneficioNeto = ingresos - totalGastos;
        
        return { ingresos, totalGastos, beneficioNeto };
    }, [trabajos, gastos]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    };
    
    const handleAddGasto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (descripcion && monto && !isSubmitting) {
            setIsSubmitting(true);
            await onAddGasto({ descripcion, monto: parseFloat(monto) });
            setDescripcion('');
            setMonto('');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 pb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Ingresos (Mano de Obra)" value={formatCurrency(stats.ingresos)} icon={<ArrowUpIcon className="h-6 w-6 text-white"/>} color="bg-green-500"/>
                <StatCard title="Gastos Totales" value={formatCurrency(stats.totalGastos)} icon={<ArrowDownIcon className="h-6 w-6 text-white"/>} color="bg-red-500"/>
                <StatCard title="Beneficio Neto" value={formatCurrency(stats.beneficioNeto)} icon={<BanknotesIcon className="h-6 w-6 text-white"/>} color="bg-taller-primary"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-4 flex items-center"><PlusCircleIcon className="h-6 w-6 mr-2 text-taller-primary"/>Añadir Gasto Manual</h3>
                    <form onSubmit={handleAddGasto} className="space-y-4">
                        <div>
                            <label htmlFor="descripcion" className="block text-sm font-medium text-taller-gray">Descripción</label>
                            <input type="text" id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                        <div>
                            <label htmlFor="monto" className="block text-sm font-medium text-taller-gray">Monto (€)</label>
                            <input type="number" id="monto" value={monto} onChange={e => setMonto(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-taller-primary focus:border-taller-primary sm:text-sm" required/>
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-taller-primary hover:bg-taller-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-taller-primary disabled:opacity-50">
                            {isSubmitting ? 'Añadiendo...' : 'Añadir Gasto'}
                        </button>
                    </form>
                </div>
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold mb-4">Gastos Recientes</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-taller-gray">
                            <thead className="text-xs text-taller-dark uppercase bg-taller-light">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Fecha</th>
                                    <th scope="col" className="px-6 py-3">Descripción</th>
                                    <th scope="col" className="px-6 py-3 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastos.slice(0, 5).map(gasto => (
                                    <tr key={gasto.id} className="bg-white border-b">
                                        <td className="px-6 py-4">{new Date(gasto.fecha).toLocaleDateString('es-ES')}</td>
                                        <td className="px-6 py-4 font-medium text-taller-dark">{gasto.descripcion}</td>
                                        <td className="px-6 py-4 text-right font-semibold">{formatCurrency(gasto.monto)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;